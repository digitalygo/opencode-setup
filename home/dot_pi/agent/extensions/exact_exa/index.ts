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
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const EXA_API_BASE_URL = "https://api.exa.ai";
const REQUEST_TIMEOUT_MS = 30_000;
const API_KEY_ENV_NAMES = ["EXA_API_KEY", "EXA_API_TOKEN"] as const;
const DEFAULT_API_KEY_FILE = join(homedir(), "Documents", ".secrets", "exa-token");

const SearchParams = Type.Object({
	query: Type.String({ description: "Web search query." }),
	numResults: Type.Optional(
		Type.Integer({
			description: "Number of results to return. Defaults to 10.",
			minimum: 1,
			maximum: 100,
		}),
	),
	type: Type.Optional(
		StringEnum(["auto", "fast", "instant", "deep-lite", "deep", "deep-reasoning"] as const, {
			description: "Search type. Defaults to auto.",
			default: "auto",
		}),
	),
	category: Type.Optional(
		StringEnum(["company", "publication", "news", "personal site", "financial report", "people"] as const, {
			description: "Restrict results to a content category.",
		}),
	),
	startPublishedDate: Type.Optional(
		Type.String({ description: "Only results published on or after this ISO 8601 date." }),
	),
	endPublishedDate: Type.Optional(
		Type.String({ description: "Only results published on or before this ISO 8601 date." }),
	),
	includeDomains: Type.Optional(
		Type.Array(Type.String(), {
			description: "Only results from these domains.",
			items: { description: "Domain to include, for example example.com." },
		}),
	),
	excludeDomains: Type.Optional(
		Type.Array(Type.String(), {
			description: "Exclude results from these domains.",
			items: { description: "Domain to exclude, for example example.com." },
		}),
	),
	userLocation: Type.Optional(
		Type.String({
			description: "Two-letter ISO country code used to tailor results, for example US.",
		}),
	),
	text: Type.Optional(
		Type.Boolean({ description: "Include the full page text per result. Costs more.", default: false }),
	),
	highlights: Type.Optional(
		Type.Boolean({
			description: "Include relevant text highlights per result. Cheaper than full text. Defaults to true.",
			default: true,
		}),
	),
	summary: Type.Optional(
		Type.Boolean({
			description: "Include an LLM-written summary per result. Costs more.",
			default: false,
		}),
	),
});

const ContentsParams = Type.Object({
	urls: Type.Array(
		Type.String({ description: "HTTPS page URL to fetch." }),
		{
			description: "One to ten HTTPS URLs.",
			minItems: 1,
			maxItems: 10,
		},
	),
	text: Type.Optional(
		Type.Boolean({ description: "Include the page text. Defaults to true.", default: true }),
	),
	maxCharacters: Type.Optional(
		Type.Integer({
			description: "Maximum characters of text to return per page. Only used when text is true.",
			minimum: 1,
		}),
	),
	includeHtmlTags: Type.Optional(
		Type.Boolean({ description: "Keep HTML tags in the returned text. Defaults to false.", default: false }),
	),
	highlights: Type.Optional(
		Type.Boolean({ description: "Include relevant highlights per page. Defaults to false.", default: false }),
	),
	summary: Type.Optional(
		Type.Boolean({ description: "Include an LLM-written summary per page. Defaults to false.", default: false }),
	),
	maxAgeHours: Type.Optional(
		Type.Integer({ description: "Only fetch pages cached within this many hours.", minimum: 1 }),
	),
	livecrawlTimeout: Type.Optional(
		Type.Integer({
			description: "Timeout in milliseconds for live crawling pages not in the cache.",
			minimum: 1,
		}),
	),
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

interface ExaCredential {
	key: string;
	source: string;
}

function getApiKeyFilePath(): string {
	return process.env.EXA_API_KEY_FILE?.trim() || DEFAULT_API_KEY_FILE;
}

async function getExaCredential(): Promise<ExaCredential> {
	for (const name of API_KEY_ENV_NAMES) {
		const value = process.env[name]?.trim();
		if (value) return { key: value, source: name };
	}

	const filePath = getApiKeyFilePath();
	try {
		const metadata = await stat(filePath);
		if (!metadata.isFile()) throw new Error("path is not a regular file");
		if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
			throw new Error(`permissions are too open (${(metadata.mode & 0o777).toString(8)}); run chmod 600`);
		}

		const value = (await readFile(filePath, "utf8")).trim();
		if (!value) throw new Error("file is empty");
		return { key: value, source: filePath };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw new Error(
				`Cannot use Exa API key file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	throw new Error(
		`Exa API key not configured. Put it in ${filePath} with permissions 600, or set EXA_API_KEY. Create a key at https://dashboard.exa.ai/api-keys.`,
	);
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

async function requestExa(
	path: "/search" | "/contents",
	body: JsonRecord,
	signal?: AbortSignal,
): Promise<JsonRecord> {
	const { key: apiKey } = await getExaCredential();
	const combined = combineSignals(signal);
	let response: Response;

	try {
		response = await fetch(`${EXA_API_BASE_URL}${path}`, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"User-Agent": "pi-exa-extension/1.0",
				"x-api-key": apiKey,
			},
			body: JSON.stringify(body),
			signal: combined.signal,
		});
	} catch (error) {
		if (signal?.aborted) throw new Error("Exa API request cancelled.");
		if (combined.timedOut()) {
			throw new Error(`Exa API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
		}
		throw new Error(`Could not reach the Exa API: ${error instanceof Error ? error.message : String(error)}`);
	}

	const responseText = await response.text();
	let payload: unknown;
	try {
		payload = responseText ? JSON.parse(responseText) : {};
	} catch {
		payload = responseText;
	}

	if (!response.ok) {
		const record = asRecord(payload);
		const message = singleLine(record?.message) ?? singleLine(record?.error) ?? singleLine(responseText) ?? response.statusText;
		const hints: string[] = [];
		if (response.status === 401) hints.push("Check the configured Exa API key.");
		if (response.status === 429) hints.push("Exa rate or usage limit reached.");
		throw new Error(
			`Exa API returned HTTP ${response.status}${message ? `: ${message}` : ""}${hints.length ? ` ${hints.join(" ")}` : ""}`,
		);
	}

	const record = asRecord(payload);
	if (!record) throw new Error("Exa API returned an unexpected non-JSON response.");
	return record;
}

async function truncateAndPersist(output: string, kind: "search" | "contents"): Promise<OutputArtifact> {
	const truncation = truncateHead(output, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});

	if (!truncation.truncated) return { text: output };

	const tempDirectory = await mkdtemp(join(tmpdir(), `pi-exa-${kind}-`));
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

function formatSearchResult(rawItem: unknown, index: number): string {
	const item = asRecord(rawItem);
	if (!item) return `${index + 1}. ${String(rawItem)}`;

	const title = singleLine(item.title) ?? "Untitled result";
	const url = asString(item.url);
	const publishedDate = singleLine(item.publishedDate);
	const author = singleLine(item.author);
	const score = typeof item.score === "number" ? item.score : undefined;
	const lines = [`${index + 1}. ${title}`];
	if (url) lines.push(`URL: ${url}`);
	if (publishedDate) lines.push(`Date: ${publishedDate}`);
	if (author) lines.push(`Author: ${author}`);
	if (score !== undefined) lines.push(`Score: ${score.toFixed(3)}`);
	const highlights = Array.isArray(item.highlights)
		? item.highlights.map(singleLine).filter((part): part is string => Boolean(part))
		: [];
	for (const highlight of highlights) lines.push(highlight);
	const text = singleLine(item.text);
	if (text) lines.push(text);
	const summary = singleLine(item.summary);
	if (summary) lines.push(`Summary: ${summary}`);
	return lines.join("\n");
}

function formatSearchResponse(
	payload: JsonRecord,
	query: string,
	numResults: number,
): { text: string; resultCount: number } {
	const results = Array.isArray(payload.results) ? payload.results : [];
	const selected = results.slice(0, numResults).map(formatSearchResult);
	const sections = selected.length
		? selected.join("\n\n")
		: `## Raw response\n\n${JSON.stringify(payload, null, 2)}`;

	const requestId = asString(payload.requestId);
	const costDollars = typeof payload.costDollars === "number" ? `$${payload.costDollars.toFixed(4)}` : undefined;
	const footer = [requestId ? `Request ID: ${requestId}` : undefined, costDollars ? `Cost: ${costDollars}` : undefined]
		.filter(Boolean)
		.join(" | ");

	return {
		text: `# Exa search: ${query}\n\n${sections}${footer ? `\n\n${footer}` : ""}`,
		resultCount: selected.length,
	};
}

function validateHttpsUrls(urls: string[]): string[] {
	return urls.map((rawUrl, index) => {
		const value = rawUrl.trim();
		let parsed: URL;
		try {
			parsed = new URL(value);
		} catch {
			throw new Error(`urls[${index}] is not a valid URL: ${rawUrl}`);
		}
		if (parsed.protocol !== "https:" || !parsed.hostname) {
			throw new Error(`urls[${index}] must be an HTTPS URL: ${rawUrl}`);
		}
		return parsed.toString();
	});
}

function formatContentsResponse(payload: JsonRecord): {
	text: string;
	pages: Array<{ url?: string; extracted: boolean; error?: string }>;
	statuses: Array<Record<string, unknown>>;
} {
	const results = Array.isArray(payload.results) ? payload.results : [];
	const statuses = Array.isArray(payload.statuses) ? payload.statuses : [];
	const pageDetails: Array<{ url?: string; extracted: boolean; error?: string }> = [];
	const sections = results.map((rawItem, index) => {
		const item = asRecord(rawItem);
		if (!item) {
			pageDetails.push({ extracted: false, error: "Unexpected page response" });
			return `## Page ${index + 1}\n\nUnexpected response: ${JSON.stringify(rawItem)}`;
		}

		const url = asString(item.url);
		const text = asString(item.text);
		const status = statuses.find((entry) => asRecord(entry)?.id === item.id);
		const statusRecord = asRecord(status);
		const statusValue = singleLine(statusRecord?.status);
		const failed = statusValue !== undefined && statusValue !== "success";
		pageDetails.push({ url, extracted: Boolean(text), ...(failed && statusValue ? { error: statusValue } : {}) });

		if (failed) {
			return `## ${url ?? `Page ${index + 1}`}\n\nFetch failed${statusValue ? `: ${statusValue}` : "."}`;
		}
		return `## ${url ?? `Page ${index + 1}`}\n\n${text ?? "No text returned."}`;
	});

	const requestId = asString(payload.requestId);
	const footerParts = [requestId ? `Request ID: ${requestId}` : undefined];
	if (statuses.length) {
		const failures = statuses
			.map((entry) => {
				const status = asRecord(entry);
				const id = singleLine(status?.id);
				const value = singleLine(status?.status);
				return value && value !== "success" ? `${id}: ${value}` : undefined;
			})
			.filter((part): part is string => Boolean(part));
		if (failures.length) footerParts.push(`Failures: ${failures.join(", ")}`);
	}
	const footer = footerParts.filter(Boolean).join(" | ");

	return {
		text: `# Exa Contents\n\n${sections.join("\n\n")}${footer ? `\n\n${footer}` : ""}`,
		pages: pageDetails,
		statuses,
	};
}

export default function exaExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "exa_search",
		label: "Exa Search",
		description:
			`Search the web with Exa's paid Search API. Supports category, publish-date, and domain filters plus per-result highlights, full-text, and summaries. ` +
			`Defaults to 10 results and relevance highlights. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temporary file when truncated. Requires a configured Exa API key.`,
		promptSnippet: "Search the web for current or external information",
		promptGuidelines: [
			"Use exa_search for current or external web information instead of attempting web requests through bash.",
			"Use exa_search only when web information is needed because Exa API calls are billed; avoid duplicate searches.",
		],
		parameters: SearchParams,
		async execute(_toolCallId, params, signal) {
			const query = params.query.trim();
			if (!query) throw new Error("query must not be empty.");
			if (params.userLocation && !/^[A-Za-z]{2}$/.test(params.userLocation.trim())) {
				throw new Error("userLocation must be a two-letter ISO country code.");
			}

			const numResults = params.numResults ?? 10;
			const contents: JsonRecord = {};
			if (params.text) contents.text = true;
			if (params.highlights ?? true) contents.highlights = true;
			if (params.summary) contents.summary = true;

			const body: JsonRecord = {
				query,
				numResults,
				type: params.type ?? "auto",
				contents,
			};
			if (params.category) body.category = params.category;
			if (params.startPublishedDate) body.startPublishedDate = params.startPublishedDate;
			if (params.endPublishedDate) body.endPublishedDate = params.endPublishedDate;
			if (params.includeDomains?.length) body.includeDomains = params.includeDomains.map((domain) => domain.trim());
			if (params.excludeDomains?.length) body.excludeDomains = params.excludeDomains.map((domain) => domain.trim());
			if (params.userLocation) body.userLocation = params.userLocation.trim().toUpperCase();

			const payload = await requestExa("/search", body, signal);
			const formatted = formatSearchResponse(payload, query, numResults);
			const artifact = await truncateAndPersist(formatted.text, "search");
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					query,
					resultCount: formatted.resultCount,
					requestId: payload.requestId,
					costDollars: payload.costDollars,
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerTool({
		name: "exa_contents",
		label: "Exa Contents",
		description:
			`Fetch page text and highlights from 1-10 HTTPS URLs using Exa's paid Contents API. ` +
			`Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temporary file when truncated. Requires a configured Exa API key.`,
		promptSnippet: "Fetch page contents from one or more known URLs",
		promptGuidelines: [
			"Use exa_contents when full page content is needed from known URLs returned by exa_search or supplied by the user.",
			"Use exa_contents only for pages whose full content is necessary because the API is billed per page.",
		],
		parameters: ContentsParams,
		async execute(_toolCallId, params, signal) {
			const urls = validateHttpsUrls(params.urls);
			const text = params.text ?? true;
			const textField: JsonRecord | boolean = text === false
				? false
				: params.maxCharacters !== undefined || params.includeHtmlTags
					? {
						maxCharacters: params.maxCharacters,
						includeHtmlTags: params.includeHtmlTags,
					}
					: true;

			const body: JsonRecord = {
				urls,
				text: textField,
				highlights: params.highlights ?? false,
				summary: params.summary ?? false,
			};
			if (params.maxAgeHours !== undefined) body.maxAgeHours = params.maxAgeHours;
			if (params.livecrawlTimeout !== undefined) body.livecrawlTimeout = params.livecrawlTimeout;

			const payload = await requestExa("/contents", body, signal);
			const formatted = formatContentsResponse(payload);
			const artifact = await truncateAndPersist(formatted.text, "contents");
			return {
				content: [{ type: "text", text: artifact.text }],
				details: {
					pages: formatted.pages,
					statuses: formatted.statuses,
					requestId: payload.requestId,
					truncation: artifact.truncation,
					fullOutputPath: artifact.fullOutputPath,
				},
			};
		},
	});

	pi.registerCommand("exa", {
		description: "Show Exa extension configuration status",
		handler: async (_args, ctx) => {
			try {
				const credential = await getExaCredential();
				ctx.ui.notify(
					`Exa is configured via ${credential.source}. Tools: exa_search, exa_contents.`,
					"info",
				);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
			}
		},
	});
}
