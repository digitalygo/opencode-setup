import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type, type TSchema } from "typebox";

const TOOL_PREFIX = "figma_";
const MCP_PACKAGE = "figma-developer-mcp@latest";
const API_KEY_PATH = join(homedir(), "Documents", ".secrets", "figma-token");
const API_KEY_DISPLAY = "~/Documents/.secrets/figma-token";
const NO_API_KEY_MESSAGE = `Figma MCP skipped: no API key at ${API_KEY_DISPLAY}`;
const MAX_STDIO_MESSAGE_BYTES = 64 * 1024 * 1024;
const TOOL_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_LOG_BYTES = 64 * 1024;

const MCP_SERVER_ARGS = ["-y", MCP_PACKAGE, "--stdio"] as const;

interface McpToolInfo {
	name: string;
	title?: string;
	description?: string;
	inputSchema: Record<string, unknown>;
	annotations?: Record<string, unknown>;
}

interface McpContentItem {
	type: string;
	text?: string;
	data?: string;
	mimeType?: string;
	uri?: string;
	name?: string;
	description?: string;
	resource?: {
		uri?: string;
		text?: string;
		blob?: string;
		mimeType?: string;
	};
	[key: string]: unknown;
}

interface McpCallResult {
	content?: McpContentItem[];
	structuredContent?: unknown;
	isError?: boolean;
	_meta?: Record<string, unknown>;
	[key: string]: unknown;
}

interface PiTextContent {
	type: "text";
	text: string;
}

interface PiImageContent {
	type: "image";
	data: string;
	mimeType: string;
}

type PiContent = PiTextContent | PiImageContent;

interface FigmaToolDetails {
	mcpTool: string;
	piTool: string;
	server?: { name?: string; version?: string };
	structuredContent?: unknown;
	meta?: Record<string, unknown>;
	contentTypes: string[];
}

function readApiKey(): string | null {
	try {
		const token = readFileSync(API_KEY_PATH, "utf8").trim();
		return token.length > 0 ? token : null;
	} catch {
		return null;
	}
}

function getChildEnvironment(apiKey: string): Record<string, string> {
	const environment: Record<string, string> = {};
	for (const [name, value] of Object.entries(process.env)) {
		if (typeof value === "string") environment[name] = value;
	}

	environment.FIGMA_API_KEY = apiKey;
	return environment;
}

function sanitizeSchema(inputSchema: Record<string, unknown>): TSchema {
	const schema = structuredClone(inputSchema);
	delete schema.$schema;
	if (!schema.type) schema.type = "object";
	return Type.Unsafe<Record<string, unknown>>(schema);
}

function toPiToolName(mcpToolName: string): string {
	return `${TOOL_PREFIX}${mcpToolName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function humanize(name: string): string {
	return name
		.split("_")
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function stringify(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function mapMcpResult(result: McpCallResult): PiContent[] {
	const content: PiContent[] = [];

	for (const item of result.content ?? []) {
		switch (item.type) {
			case "text":
				content.push({ type: "text", text: item.text ?? "" });
				break;
			case "image":
				if (item.data && item.mimeType) {
					content.push({ type: "image", data: item.data, mimeType: item.mimeType });
				} else {
					content.push({ type: "text", text: `[Invalid MCP image content: ${stringify(item)}]` });
				}
				break;
			case "resource": {
				const resource = item.resource;
				if (!resource) {
					content.push({ type: "text", text: `[Invalid MCP resource content: ${stringify(item)}]` });
					break;
				}
				if (typeof resource.text === "string") {
					const heading = resource.uri ? `MCP resource ${resource.uri}:\n` : "";
					content.push({ type: "text", text: `${heading}${resource.text}` });
				} else if (typeof resource.blob === "string" && resource.mimeType?.startsWith("image/")) {
					content.push({ type: "image", data: resource.blob, mimeType: resource.mimeType });
				} else if (typeof resource.blob === "string") {
					content.push({
						type: "text",
						text: `MCP resource ${resource.uri ?? "(unnamed)"} (${resource.mimeType ?? "binary"}) as base64:\n${resource.blob}`,
					});
				}
				break;
			}
			case "resource_link":
				content.push({
					type: "text",
					text: `MCP resource link: ${item.name ?? item.uri ?? "(unnamed)"}${item.uri ? `\n${item.uri}` : ""}${item.description ? `\n${item.description}` : ""}`,
				});
				break;
			case "audio":
				content.push({
					type: "text",
					text: `MCP audio (${item.mimeType ?? "unknown"}) as base64:\n${item.data ?? ""}`,
				});
				break;
			default:
				content.push({ type: "text", text: `MCP content (${item.type}):\n${stringify(item)}` });
		}
	}

	if (content.length === 0 && result.structuredContent !== undefined) {
		content.push({ type: "text", text: stringify(result.structuredContent) });
	}
	if (content.length === 0) {
		content.push({ type: "text", text: "Figma Developer MCP returned no content." });
	}

	return content;
}

function resultText(content: PiContent[]): string {
	const text = content
		.filter((item): item is PiTextContent => item.type === "text")
		.map((item) => item.text)
		.join("\n")
		.trim();
	return text || "Figma Developer MCP reported an error without a text message.";
}

export default function figmaMcpExtension(pi: ExtensionAPI): void {
	let client: Client | undefined;
	let transport: StdioClientTransport | undefined;
	let connectionPromise: Promise<Client | undefined> | undefined;
	let serverCwd: string | undefined;
	let serverInfo: { name?: string; version?: string } | undefined;
	let serverLogs = "";
	let lastError: string | undefined;
	let noKeyNotified = false;
	const registeredTools = new Map<string, McpToolInfo>();

	function appendServerLog(chunk: string): void {
		serverLogs += chunk;
		if (serverLogs.length > MAX_LOG_BYTES) serverLogs = serverLogs.slice(-MAX_LOG_BYTES);
	}

	async function disconnect(): Promise<void> {
		const oldClient = client;
		const oldTransport = transport;
		client = undefined;
		transport = undefined;
		connectionPromise = undefined;
		serverCwd = undefined;
		serverInfo = undefined;

		if (oldClient) {
			await oldClient.close().catch(() => undefined);
		} else if (oldTransport) {
			await oldTransport.close().catch(() => undefined);
		}
	}

	async function listAllTools(activeClient: Client): Promise<McpToolInfo[]> {
		const tools: McpToolInfo[] = [];
		let cursor: string | undefined;
		do {
			const page = await activeClient.listTools(cursor ? { cursor } : undefined, { timeout: TOOL_TIMEOUT_MS });
			tools.push(...(page.tools as McpToolInfo[]));
			cursor = page.nextCursor;
		} while (cursor);
		return tools;
	}

	function registerMcpTools(tools: McpToolInfo[]): void {
		for (const tool of tools) {
			if (!tool.name || !tool.inputSchema) continue;
			registeredTools.set(tool.name, tool);
			const piToolName = toPiToolName(tool.name);

			pi.registerTool({
				name: piToolName,
				label: `Figma: ${tool.title ?? humanize(tool.name)}`,
				description:
					tool.description ?? `Execute the ${tool.name} tool through the official Figma Developer MCP server.`,
				parameters: sanitizeSchema(tool.inputSchema),
				executionMode: "sequential",
				async execute(_toolCallId, params, signal, onUpdate, ctx) {
					const activeClient = await ensureConnected(ctx.cwd);
					if (!activeClient) {
						throw new Error(`Figma Developer MCP is not connected: ${lastError ?? NO_API_KEY_MESSAGE}`);
					}
					let result: McpCallResult;
					try {
						result = (await activeClient.callTool(
							{ name: tool.name, arguments: (params ?? {}) as Record<string, unknown> },
							undefined,
							{
								signal,
								timeout: TOOL_TIMEOUT_MS,
								resetTimeoutOnProgress: true,
								onprogress: (progress) => {
									onUpdate?.({
										content: [
											{
												type: "text",
												text: `Figma Developer ${tool.name}: ${progress.progress}${progress.total !== undefined ? `/${progress.total}` : ""}`,
											},
										],
										details: {
											mcpTool: tool.name,
											piTool: piToolName,
											server: serverInfo,
											contentTypes: ["progress"],
										} satisfies FigmaToolDetails,
									});
								},
							},
						)) as McpCallResult;
					} catch (error) {
						lastError = error instanceof Error ? error.message : String(error);
						await disconnect();
						throw error;
					}

					const content = mapMcpResult(result);
					if (result.isError) {
						throw new Error(`Figma Developer MCP tool ${tool.name} failed: ${resultText(content)}`);
					}

					return {
						content,
						details: {
							mcpTool: tool.name,
							piTool: piToolName,
							server: serverInfo,
							structuredContent: result.structuredContent,
							meta: result._meta,
							contentTypes: (result.content ?? []).map((item) => item.type),
						} satisfies FigmaToolDetails,
					};
				},
			});
		}
	}

	async function connect(cwd: string): Promise<Client | undefined> {
		if (client && serverCwd === cwd) return client;
		if (client && serverCwd !== cwd) await disconnect();

		const apiKey = readApiKey();
		if (!apiKey) {
			lastError = NO_API_KEY_MESSAGE;
			return undefined;
		}

		serverLogs = "";
		lastError = undefined;
		const nextTransport = new StdioClientTransport({
			command: "npx",
			args: [...MCP_SERVER_ARGS],
			cwd,
			env: getChildEnvironment(apiKey),
			stderr: "pipe",
			maxBufferSize: MAX_STDIO_MESSAGE_BYTES,
		});
		nextTransport.stderr?.on("data", (chunk) => appendServerLog(String(chunk)));

		const nextClient = new Client({ name: "pi-figma-mcp", version: "1.0.0" }, { capabilities: {} });

		try {
			await nextClient.connect(nextTransport, { timeout: TOOL_TIMEOUT_MS });
			const tools = await listAllTools(nextClient);
			registerMcpTools(tools);

			client = nextClient;
			transport = nextTransport;
			serverCwd = cwd;
			serverInfo = nextClient.getServerVersion();
			return nextClient;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			await nextClient.close().catch(() => nextTransport.close().catch(() => undefined));
			throw error;
		}
	}

	async function ensureConnected(cwd: string): Promise<Client | undefined> {
		if (client && serverCwd === cwd) return client;
		if (!connectionPromise) {
			connectionPromise = connect(cwd).finally(() => {
				connectionPromise = undefined;
			});
		}
		return connectionPromise;
	}

	function updateStatus(ctx: ExtensionContext, state: "starting" | "ready" | "error" | "off"): void {
		if (state === "off") {
			ctx.ui.setStatus("figma-mcp", undefined);
			return;
		}
		const text =
			state === "starting"
				? "Figma: starting"
				: state === "ready"
					? `Figma: ${registeredTools.size} tools`
					: "Figma: error";
		ctx.ui.setStatus(
			"figma-mcp",
			ctx.ui.theme.fg(state === "error" ? "error" : state === "ready" ? "success" : "warning", text),
		);
	}

	pi.registerCommand("figma-status", {
		description: "Show Figma MCP connection status",
		handler: async (_args, ctx) => {
			const state = client ? "connected" : connectionPromise ? "connecting" : "disconnected";
			const apiKeyConfigured = readApiKey() !== null;
			const info = [
				`State: ${state}`,
				`Server: ${serverInfo?.name ?? "unknown"}${serverInfo?.version ? ` ${serverInfo.version}` : ""}`,
				`Package: ${MCP_PACKAGE}`,
				`Tools registered: ${registeredTools.size}`,
				`Process PID: ${transport?.pid ?? "none"}`,
				`Working directory: ${serverCwd ?? "none"}`,
				`API key (${API_KEY_DISPLAY}): ${apiKeyConfigured ? "configured" : "missing"}`,
			];
			if (lastError) info.push(`Last error: ${lastError}`);
			ctx.ui.notify(info.join("\n"), lastError ? "warning" : "info");
		},
	});

	pi.registerCommand("figma-restart", {
		description: "Restart Figma MCP and refresh its tool definitions",
		handler: async (_args, ctx) => {
			if (!readApiKey()) {
				lastError = NO_API_KEY_MESSAGE;
				updateStatus(ctx, "error");
				ctx.ui.notify(NO_API_KEY_MESSAGE, "warning");
				return;
			}
			updateStatus(ctx, "starting");
			await disconnect();
			try {
				await ensureConnected(ctx.cwd);
				updateStatus(ctx, "ready");
				ctx.ui.notify(`Figma MCP restarted with ${registeredTools.size} tools`, "info");
			} catch (error) {
				updateStatus(ctx, "error");
				ctx.ui.notify(`Figma MCP restart failed: ${lastError ?? String(error)}`, "error");
			}
		},
	});

	pi.registerCommand("figma-logs", {
		description: "Show recent Figma MCP server logs",
		handler: async (_args, ctx) => {
			ctx.ui.notify(serverLogs.trim() || "No Figma MCP logs available", lastError ? "warning" : "info");
		},
	});

	pi.on("before_agent_start", async (event) => {
		if (registeredTools.size === 0) return;
		return {
			systemPrompt: `${event.systemPrompt}\n\nFigma MCP tools are available with the \`${TOOL_PREFIX}\` prefix. Use \`${TOOL_PREFIX}get_figma_data\` to fetch design metadata for a Figma URL before implementing it.`,
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		if (!readApiKey()) {
			lastError = NO_API_KEY_MESSAGE;
			updateStatus(ctx, "error");
			if (!noKeyNotified) {
				noKeyNotified = true;
				ctx.ui.notify(NO_API_KEY_MESSAGE, "warning");
			}
			return;
		}
		updateStatus(ctx, "starting");
		try {
			await ensureConnected(ctx.cwd);
			updateStatus(ctx, "ready");
		} catch (error) {
			updateStatus(ctx, "error");
			ctx.ui.notify(
				`Figma MCP failed to start: ${lastError ?? String(error)}. Use /figma-logs for details.`,
				"warning",
			);
		}
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		noKeyNotified = false;
		updateStatus(ctx, "off");
		await disconnect();
	});
}
