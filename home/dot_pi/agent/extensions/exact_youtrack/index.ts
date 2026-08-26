import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
	withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SUMMARY_LENGTH = 120;
const DEFAULT_FIELDS =
	"id,idReadable,summary,description,state(name),assignee(name),project(name,shortName),created,updated";
const DEFAULT_CREDENTIAL_FILE = join(homedir(), "Documents", ".secrets", "youtrack-key");

const ListProjectsParams = Type.Object({});

const SearchIssuesParams = Type.Object({
	query: Type.Optional(
		Type.String({
			description: "YouTrack search query. Defaults to sorting by most recently updated.",
			default: "sort by: updated desc",
		}),
	),
	top: Type.Optional(
		Type.Integer({
			description: "Maximum number of issues to return. Defaults to 50.",
			minimum: 1,
			maximum: 100,
			default: 50,
		}),
	),
	skip: Type.Optional(
		Type.Integer({
			description: "Number of issues to skip for pagination. Defaults to 0.",
			minimum: 0,
			default: 0,
		}),
	),
});

const IssueParam = Type.Object({
	issue: Type.String({
		description: "Issue id or idReadable, for example 3-380 or DCMS-62.",
	}),
});

const CreateIssueParams = Type.Object({
	summary: Type.String({ description: "Issue summary (title)." }),
	description: Type.Optional(Type.String({ description: "Issue description (body). Optional." })),
	projectId: Type.Optional(
		Type.String({ description: "Internal project id, for example 0-7. Provide this or projectShortName." }),
	),
	projectShortName: Type.Optional(
		Type.String({ description: "Project short name, for example DCMS. Provide this or projectId." }),
	),
});

const UpdateIssueParams = Type.Object({
	issue: Type.String({
		description: "Issue id or idReadable, for example 3-380 or DCMS-62.",
	}),
	summary: Type.Optional(Type.String({ description: "New issue summary (title). Optional." })),
	description: Type.Optional(Type.String({ description: "New issue description (body). Optional." })),
});

const AddCommentParams = Type.Object({
	issue: Type.String({
		description: "Issue id or idReadable, for example 3-380 or DCMS-62.",
	}),
	text: Type.String({ description: "Comment text. Must not be empty." }),
});

const RunCommandParams = Type.Object({
	query: Type.String({
		description:
			"The command to apply, for example State {In Progress}, assignee luca.nori, for me, or tag frontend. Multi-word values must be wrapped in braces.",
	}),
	issues: Type.Array(
		Type.String({
			description: "Issue id or idReadable, for example 3-380 or DCMS-62.",
		}),
		{
			description: "One or more target issues.",
			minItems: 1,
		},
	),
	silent: Type.Optional(
		Type.Boolean({
			description: "Apply without sending notifications. Defaults to false.",
			default: false,
		}),
	),
	comment: Type.Optional(Type.String({ description: "Optional comment to add with the command." })),
});

type JsonRecord = Record<string, unknown>;

interface OutputArtifact {
	text: string;
	fullOutputPath?: string;
	truncation?: {
		totalLines: number;
		outputLines: number;
		totalBytes: number;
		outputBytes: number;
	};
}

interface YouTrackCredential {
	baseUrl: string;
	token: string;
	source: string;
}

function asRecord(value: unknown): JsonRecord | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as JsonRecord)
		: undefined;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function singleLine(value: unknown): string | undefined {
	const text = asString(value);
	return text?.replace(/\s+/g, " ");
}

async function getYouTrackCredential(): Promise<YouTrackCredential> {
	const envUrl = process.env.YOUTRACK_URL?.trim() || process.env.YT_URL?.trim();
	const envToken = process.env.YOUTRACK_TOKEN?.trim() || process.env.YT_TOKEN?.trim();

	let fileUrl: string | undefined;
	let fileToken: string | undefined;
	if (!envUrl || !envToken) {
		try {
			const metadata = await stat(DEFAULT_CREDENTIAL_FILE);
			if (!metadata.isFile()) throw new Error("path is not a regular file");
			if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
				throw new Error(
					`permissions are too open (${(metadata.mode & 0o777).toString(8)}); run chmod 600`,
				);
			}
			const lines = (await readFile(DEFAULT_CREDENTIAL_FILE, "utf8"))
				.split(/\r?\n/)
				.map((line) => line.trim());
			fileUrl = lines[0];
			fileToken = lines[1];
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw new Error(
					`Cannot use YouTrack credentials file ${DEFAULT_CREDENTIAL_FILE}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	const baseUrl = envUrl || fileUrl;
	const token = envToken || fileToken;
	if (!baseUrl || !token) {
		throw new Error(
			`YouTrack credentials not configured. Put the base URL on line 1 and the permanent token on line 2 of ${DEFAULT_CREDENTIAL_FILE} with permissions 600, or set YOUTRACK_URL and YOUTRACK_TOKEN (or YT_URL and YT_TOKEN).`,
		);
	}
	if (!/^https:/.test(baseUrl)) {
		throw new Error("YouTrack base URL must use https.");
	}

	const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
	const source = envUrl && envToken ? "environment variables" : DEFAULT_CREDENTIAL_FILE;
	return { baseUrl: normalizedBaseUrl, token, source };
}

function combineSignals(signal: AbortSignal | undefined): {
	signal: AbortSignal;
	timedOut: () => boolean;
} {
	const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	return {
		signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
		timedOut: () => timeoutSignal.aborted,
	};
}

interface RequestOptions {
	method: "GET" | "POST";
	path: string;
	body?: JsonRecord;
	signal?: AbortSignal;
}

async function requestYouTrack(options: RequestOptions): Promise<unknown> {
	const { baseUrl, token } = await getYouTrackCredential();
	const combined = combineSignals(options.signal);
	let response: Response;

	try {
		response = await fetch(`${baseUrl}${options.path}`, {
			method: options.method,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
				...(options.body ? { "Content-Type": "application/json" } : {}),
			},
			...(options.body ? { body: JSON.stringify(options.body) } : {}),
			signal: combined.signal,
		});
	} catch (error) {
		if (options.signal?.aborted) throw new Error("YouTrack request cancelled.");
		if (combined.timedOut()) {
			throw new Error(`YouTrack request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
		}
		throw new Error(
			`Could not reach the YouTrack API: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const responseText = await response.text();
	let payload: unknown;
	try {
		payload = responseText ? JSON.parse(responseText) : undefined;
	} catch {
		payload = responseText;
	}

	if (!response.ok) {
		const record = asRecord(payload);
		const message =
			singleLine(record?.error_developer_message) ??
			singleLine(record?.error_description) ??
			singleLine(record?.error) ??
			singleLine(record?.message) ??
			singleLine(responseText) ??
			response.statusText;
		throw new Error(
			`YouTrack API returned HTTP ${response.status}${message ? `: ${message}` : ""}`,
		);
	}

	return payload;
}

function issueQueryString(extra: string): string {
	return `?fields=${encodeURIComponent(DEFAULT_FIELDS)}${extra}`;
}

function truncateSummary(summary: string): string {
	return summary.length > MAX_SUMMARY_LENGTH
		? `${summary.slice(0, MAX_SUMMARY_LENGTH - 1)}…`
		: summary;
}

async function truncateAndPersist(output: string, kind: string): Promise<OutputArtifact> {
	const truncation = truncateHead(output, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});

	if (!truncation.truncated) return { text: output };

	const tempDirectory = await mkdtemp(join(tmpdir(), `pi-youtrack-${kind}-`));
	const fullOutputPath = join(tempDirectory, "output.md");
	await withFileMutationQueue(fullOutputPath, () => writeFile(fullOutputPath, output, "utf8"));

	const omittedLines = truncation.totalLines - truncation.outputLines;
	const omittedBytes = truncation.totalBytes - truncation.outputBytes;
	const notice =
		`\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines ` +
		`(${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}); ` +
		`${omittedLines} lines (${formatSize(omittedBytes)}) omitted. Full output: ${fullOutputPath}]`;

	return {
		text: truncation.content + notice,
		fullOutputPath,
		truncation: {
			totalLines: truncation.totalLines,
			outputLines: truncation.outputLines,
			totalBytes: truncation.totalBytes,
			outputBytes: truncation.outputBytes,
		},
	};
}

function formatProjects(payload: unknown): string {
	const items = Array.isArray(payload) ? payload : [];
	if (!items.length) return "# YouTrack projects\n\nNo projects found.";
	const lines = items.map((rawItem, index) => {
		const item = asRecord(rawItem);
		const shortName = singleLine(item?.shortName) ?? "?";
		const name = singleLine(item?.name) ?? "?";
		const id = singleLine(item?.id) ?? "?";
		return `${index + 1}. ${shortName} - ${name} (id: ${id})`;
	});
	return `# YouTrack projects\n\n${lines.join("\n")}`;
}

function formatIssueListItem(rawItem: unknown): string {
	const item = asRecord(rawItem);
	if (!item) return String(rawItem);
	const idReadable = singleLine(item.idReadable) ?? singleLine(item.id) ?? "?";
	const summary = truncateSummary(singleLine(item.summary) ?? "Untitled");
	const state = singleLine(asRecord(item.state)?.name) ?? "none";
	const assignee = singleLine(asRecord(item.assignee)?.name) ?? "none";
	const project = singleLine(asRecord(item.project)?.shortName) ?? "none";
	const updated = singleLine(item.updated);
	return `${idReadable}: ${summary} [${state}] [assignee: ${assignee}] [project: ${project}]${updated ? ` (updated ${updated})` : ""}`;
}

function formatIssues(payload: unknown): string {
	const items = Array.isArray(payload) ? payload : [];
	if (!items.length) return "# YouTrack issues\n\nNo issues found.";
	const lines = items.map((rawItem, index) => `${index + 1}. ${formatIssueListItem(rawItem)}`);
	return `# YouTrack issues\n\n${lines.join("\n")}`;
}

function formatIssueDetail(payload: unknown): string {
	const item = asRecord(payload);
	if (!item) return "# YouTrack issue\n\nUnexpected response.";
	const idReadable = singleLine(item.idReadable) ?? singleLine(item.id) ?? "?";
	const summary = singleLine(item.summary) ?? "Untitled";
	const state = singleLine(asRecord(item.state)?.name) ?? "none";
	const assignee = singleLine(asRecord(item.assignee)?.name) ?? "none";
	const projectName = singleLine(asRecord(item.project)?.name) ?? "none";
	const projectShort = singleLine(asRecord(item.project)?.shortName) ?? "none";
	const created = singleLine(item.created);
	const updated = singleLine(item.updated);
	const description = asString(item.description) ?? "none";
	const lines = [
		`# YouTrack issue ${idReadable}`,
		`Summary: ${summary}`,
		`State: ${state}`,
		`Assignee: ${assignee}`,
		`Project: ${projectName} (${projectShort})`,
		created ? `Created: ${created}` : undefined,
		updated ? `Updated: ${updated}` : undefined,
		"Description:",
		description,
	];
	return lines.filter((line): line is string => line !== undefined).join("\n");
}

function formatComments(payload: unknown): string {
	const items = Array.isArray(payload) ? payload : [];
	if (!items.length) return "# YouTrack comments\n\nNo comments found.";
	const segments = items.map((rawItem, index) => {
		const item = asRecord(rawItem);
		const text = asString(item?.text) ?? "";
		const author = singleLine(asRecord(item?.author)?.name) ?? "unknown";
		const created = singleLine(item?.created);
		return `### Comment ${index + 1}${created ? ` (${created})` : ""}\n\n**${author}:** ${text}`;
	});
	return `# YouTrack comments\n\n${segments.join("\n\n")}`;
}

function formatCreatedIssue(payload: unknown): string {
	const item = asRecord(payload);
	if (!item) return "# YouTrack issue created\n\nUnexpected response.";
	const id = singleLine(item.id) ?? "?";
	const idReadable = singleLine(item.idReadable) ?? id;
	const summary = singleLine(item.summary) ?? "Untitled";
	return `# YouTrack issue created\n\nIssue ${idReadable} (id: ${id}): ${summary}`;
}

function formatUpdatedIssue(payload: unknown): string {
	const item = asRecord(payload);
	if (!item) return "# YouTrack issue updated\n\nUnexpected response.";
	const summary = singleLine(item.summary) ?? "unchanged";
	const description = asString(item.description) ?? "unchanged";
	return `# YouTrack issue updated\n\nSummary: ${summary}\nDescription: ${description}`;
}

function formatAddedComment(payload: unknown): string {
	const item = asRecord(payload);
	if (!item) return "# YouTrack comment added\n\nUnexpected response.";
	const id = singleLine(item.id) ?? "?";
	const text = singleLine(item.text) ?? "";
	return `# YouTrack comment added\n\nComment ${id}: ${text}`;
}

function formatCommandSuccess(query: string, targetCount: number): string {
	return `# YouTrack command applied\n\nCommand: ${query}\nApplied to ${targetCount} issue(s).`;
}

function issueBody(issue: string): JsonRecord {
	return /^\d+-\d+$/.test(issue) ? { id: issue } : { idReadable: issue };
}

export default function youtrackExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "youtrack_list_projects",
		label: "YouTrack List Projects",
		description:
			`List projects in the YouTrack instance including id, name, and short name. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temporary file when truncated. Requires configured YouTrack credentials.`,
		promptSnippet: "List YouTrack projects",
		promptGuidelines: [
			"Resolve the project against youtrack_list_projects before creating or moving an issue instead of trusting a cached id, because projects can be renamed or archived.",
		],
		parameters: ListProjectsParams,
		async execute(_toolCallId, _params, signal) {
			const payload = await requestYouTrack({
				method: "GET",
				path: "/api/admin/projects?fields=id,name,shortName",
				signal,
			});
			const text = formatProjects(payload);
			const artifact = await truncateAndPersist(text, "projects");
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerTool({
		name: "youtrack_search_issues",
		label: "YouTrack Search Issues",
		description:
			`Search issues in the YouTrack instance. Returns idReadable, summary, state, assignee, project short name, and updated. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temporary file when truncated. Requires configured YouTrack credentials.`,
		promptSnippet: "Search YouTrack issues",
		promptGuidelines: [
			"Use youtrack_search_issues to find a task before reading or modifying it.",
			"Use YouTrack query syntax such as for: me, project: DCMS, state: Open, assignee: luca.nori, tag: frontend, and sort by: updated desc.",
		],
		parameters: SearchIssuesParams,
		async execute(_toolCallId, params, signal) {
			const query = params.query?.trim() ?? "sort by: updated desc";
			const top = params.top ?? 50;
			const skip = params.skip ?? 0;
			const path =
				`/api/issues?fields=${encodeURIComponent(DEFAULT_FIELDS)}` +
				`&$top=${top}&$skip=${skip}&query=${encodeURIComponent(query)}`;
			const payload = await requestYouTrack({ method: "GET", path, signal });
			const text = formatIssues(payload);
			const artifact = await truncateAndPersist(text, "issues");
			const resultCount = Array.isArray(payload) ? payload.length : 0;
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					query,
					resultCount,
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerTool({
		name: "youtrack_get_issue",
		label: "YouTrack Get Issue",
		description:
			`Get full details for a single YouTrack issue including summary, description, state, assignee, project, and timestamps. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temporary file when truncated. Requires configured YouTrack credentials.`,
		promptSnippet: "Get details for one YouTrack issue",
		promptGuidelines: [
			"Use youtrack_get_issue to read the full description and fields of a single issue.",
			"Handle null state, assignee, and project defensively; they render as none or —.",
		],
		parameters: IssueParam,
		async execute(_toolCallId, params, signal) {
			const issue = params.issue.trim();
			if (!issue) throw new Error("issue must not be empty.");
			const path = `/api/issues/${encodeURIComponent(issue)}${issueQueryString("")}`;
			const payload = await requestYouTrack({ method: "GET", path, signal });
			const text = formatIssueDetail(payload);
			const artifact = await truncateAndPersist(text, "issue");
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					issue,
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerTool({
		name: "youtrack_list_comments",
		label: "YouTrack List Comments",
		description:
			`List comments on a YouTrack issue including author and creation time. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temporary file when truncated. Requires configured YouTrack credentials.`,
		promptSnippet: "List comments on a YouTrack issue",
		promptGuidelines: [
			"Use youtrack_list_comments to read the discussion on an issue.",
			"Handle a null author defensively; it renders as unknown.",
		],
		parameters: IssueParam,
		async execute(_toolCallId, params, signal) {
			const issue = params.issue.trim();
			if (!issue) throw new Error("issue must not be empty.");
			const path =
				`/api/issues/${encodeURIComponent(issue)}/comments` +
				`?fields=${encodeURIComponent("id,text,author(name),created")}`;
			const payload = await requestYouTrack({ method: "GET", path, signal });
			const text = formatComments(payload);
			const artifact = await truncateAndPersist(text, "comments");
			const resultCount = Array.isArray(payload) ? payload.length : 0;
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					issue,
					resultCount,
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerTool({
		name: "youtrack_create_issue",
		label: "YouTrack Create Issue",
		description:
			`Create a new YouTrack issue. Requires a project via projectId (internal id like 0-7) or projectShortName (like DCMS). Output is truncated to ${DEFAULT_MAX_LINES} lines; full output is saved to a temporary file when truncated. Requires configured YouTrack credentials.`,
		promptSnippet: "Create a new YouTrack issue",
		promptGuidelines: [
			"Resolve the project short name against youtrack_list_projects before creating an issue.",
			"Provide either projectId or projectShortName; projectId takes precedence when both are given.",
		],
		parameters: CreateIssueParams,
		async execute(_toolCallId, params, signal) {
			const summary = params.summary.trim();
			if (!summary) throw new Error("summary must not be empty.");
			if (!params.projectId && !params.projectShortName) {
				throw new Error("Provide either projectId or projectShortName.");
			}
			const project: JsonRecord = params.projectId
				? { id: params.projectId }
				: { shortName: params.projectShortName! };
			const body: JsonRecord = { project, summary };
			if (params.description !== undefined) body.description = params.description;
			const path = `/api/issues?fields=${encodeURIComponent("id,idReadable,summary")}`;
			const payload = await requestYouTrack({ method: "POST", path, body, signal });
			const text = formatCreatedIssue(payload);
			const artifact = await truncateAndPersist(text, "create");
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerTool({
		name: "youtrack_update_issue",
		label: "YouTrack Update Issue",
		description:
			`Update the summary or description of an existing YouTrack issue. Provide at least one of summary or description. Requires configured YouTrack credentials.`,
		promptSnippet: "Update a YouTrack issue title or description",
		promptGuidelines: [
			"Use youtrack_update_issue only for plain text fields summary and description.",
			"Use youtrack_run_command for structured changes like state, assignee, tags, or links.",
		],
		parameters: UpdateIssueParams,
		async execute(_toolCallId, params, signal) {
			const issue = params.issue.trim();
			if (!issue) throw new Error("issue must not be empty.");
			if (params.summary === undefined && params.description === undefined) {
				throw new Error("Provide at least one of summary or description.");
			}
			const body: JsonRecord = {};
			if (params.summary !== undefined) body.summary = params.summary;
			if (params.description !== undefined) body.description = params.description;
			const path =
				`/api/issues/${encodeURIComponent(issue)}?fields=${encodeURIComponent("summary,description")}`;
			const payload = await requestYouTrack({ method: "POST", path, body, signal });
			const text = formatUpdatedIssue(payload);
			const artifact = await truncateAndPersist(text, "update");
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					issue,
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerTool({
		name: "youtrack_add_comment",
		label: "YouTrack Add Comment",
		description:
			`Add a comment to an existing YouTrack issue. Requires non-empty text. Requires configured YouTrack credentials.`,
		promptSnippet: "Add a comment to a YouTrack issue",
		promptGuidelines: [
			"Use youtrack_add_comment to post a comment on an issue.",
			"Never include the YouTrack token in comment text or tool output.",
		],
		parameters: AddCommentParams,
		async execute(_toolCallId, params, signal) {
			const issue = params.issue.trim();
			const text = params.text.trim();
			if (!issue) throw new Error("issue must not be empty.");
			if (!text) throw new Error("text must not be empty.");
			const body: JsonRecord = { text };
			const path =
				`/api/issues/${encodeURIComponent(issue)}/comments?fields=${encodeURIComponent("id,text")}`;
			const payload = await requestYouTrack({ method: "POST", path, body, signal });
			const formatted = formatAddedComment(payload);
			const artifact = await truncateAndPersist(formatted, "comment");
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					issue,
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerTool({
		name: "youtrack_run_command",
		label: "YouTrack Run Command",
		description:
			`Apply a command to one or more YouTrack issues. Mirrors the YouTrack command box. Supports state, assignee, tags, links, and custom fields. Multi-word values must be wrapped in braces, for example State {In Progress}, tag {To deploy}. The commands endpoint returns HTTP 200 with an empty body on success. Requires configured YouTrack credentials.`,
		promptSnippet: "Run a YouTrack command to change state, assignee, or tags",
		promptGuidelines: [
			"Use youtrack_run_command for structured changes: state, assignee, tags, or links.",
			"Wrap multi-word command values in braces, for example State {In Progress} rather than State In Progress.",
			"Target issues are passed via the issues parameter, so do not prefix the query with for:.",
			"Set silent to true to apply without sending notifications.",
		],
		parameters: RunCommandParams,
		async execute(_toolCallId, params, signal) {
			const query = params.query.trim();
			if (!query) throw new Error("query must not be empty.");
			const issues = params.issues.map((issue) => issue.trim());
			if (!issues.length || issues.some((issue) => !issue)) {
				throw new Error("issues must contain at least one non-empty issue.");
			}
			const body: JsonRecord = {
				query,
				issues: issues.map(issueBody),
			};
			if (params.silent === true) body.silent = true;
			if (params.comment !== undefined) body.comment = params.comment;
			await requestYouTrack({ method: "POST", path: "/api/commands", body, signal });
			const text = formatCommandSuccess(query, issues.length);
			return {
				content: [{ type: "text", text }],
				details: {
					query,
					issueCount: issues.length,
				},
			};
		},
	});

	pi.registerCommand("youtrack", {
		description: "Show YouTrack extension configuration status",
		handler: async (_args, ctx) => {
			try {
				const credential = await getYouTrackCredential();
				ctx.ui.notify(
					`YouTrack configured via ${credential.source}: ${credential.baseUrl}. ` +
						`Tools: youtrack_list_projects, youtrack_search_issues, youtrack_get_issue, ` +
						`youtrack_list_comments, youtrack_create_issue, youtrack_update_issue, ` +
						`youtrack_add_comment, youtrack_run_command.`,
					"info",
				);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
			}
		},
	});
}
