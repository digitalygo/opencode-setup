import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type, type TSchema } from "typebox";

const require = createRequire(import.meta.url);
const TOOL_PREFIX = "chrome_devtools_";
const MCP_PACKAGE = "chrome-devtools-mcp@latest";
const PI_CHROME_PROFILE = join(homedir(), ".cache", "chrome-devtools-mcp", "pi-profile");
const FFMPEG_PATH = require("ffmpeg-static") as string;
const MAX_STDIO_MESSAGE_BYTES = 128 * 1024 * 1024;
const TOOL_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_TOTAL_TOOL_TIME_MS = 60 * 60 * 1000;
const MAX_LOG_BYTES = 64 * 1024;

/**
 * Full-access server configuration. Headless mode does not reduce the exposed
 * tool set. No --slim or --isolated flag is used, and a Pi-specific persistent
 * profile avoids conflicts with OpenCode.
 */
const MCP_SERVER_ARGS = [
	"-y",
	MCP_PACKAGE,
	"--headless=true",
	"--no-usage-statistics",
	"--no-performance-crux",
	"--category-emulation=true",
	"--category-performance=true",
	"--category-network=true",
	"--category-extensions=true",
	"--category-experimental-third-party=true",
	"--category-experimental-webmcp=true",
	"--experimental-vision=true",
	"--experimental-screencast=true",
	`--experimental-ffmpeg-path=${FFMPEG_PATH}`,
	"--memory-debugging=true",
	"--experimental-page-id-routing=true",
	"--experimental-devtools=true",
	"--experimental-include-all-pages=true",
	"--experimental-structured-content=true",
	"--allow-unrestricted-paths=true",
	`--user-data-dir=${PI_CHROME_PROFILE}`,
	"--chrome-arg=--enable-features=WebMCP",
] as const;

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

interface ChromeToolDetails {
	mcpTool: string;
	piTool: string;
	server?: { name?: string; version?: string };
	structuredContent?: unknown;
	meta?: Record<string, unknown>;
	contentTypes: string[];
}

function getChildEnvironment(): Record<string, string> {
	const environment: Record<string, string> = {};
	for (const [name, value] of Object.entries(process.env)) {
		if (typeof value === "string") environment[name] = value;
	}

	// Disable telemetry and update notifications without restricting MCP tools.
	environment.CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS = "1";
	environment.CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS = "1";
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
		content.push({ type: "text", text: "Chrome DevTools MCP returned no content." });
	}

	return content;
}

function resultText(content: PiContent[]): string {
	const text = content
		.filter((item): item is PiTextContent => item.type === "text")
		.map((item) => item.text)
		.join("\n")
		.trim();
	return text || "Chrome DevTools MCP reported an error without a text message.";
}

export default function chromeDevToolsMcpExtension(pi: ExtensionAPI): void {
	let client: Client | undefined;
	let transport: StdioClientTransport | undefined;
	let connectionPromise: Promise<Client> | undefined;
	let serverCwd: string | undefined;
	let serverInfo: { name?: string; version?: string } | undefined;
	let serverLogs = "";
	let lastError: string | undefined;
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
				label: `Chrome DevTools: ${tool.title ?? humanize(tool.name)}`,
				description:
					tool.description ?? `Execute the ${tool.name} tool through the official Chrome DevTools MCP server.`,
				parameters: sanitizeSchema(tool.inputSchema),
				executionMode: "sequential",
				async execute(_toolCallId, params, signal, onUpdate, ctx) {
					const activeClient = await ensureConnected(ctx.cwd);
					let result: McpCallResult;
					try {
						result = (await activeClient.callTool(
							{ name: tool.name, arguments: (params ?? {}) as Record<string, unknown> },
							undefined,
							{
								signal,
								timeout: TOOL_TIMEOUT_MS,
								resetTimeoutOnProgress: true,
								maxTotalTimeout: MAX_TOTAL_TOOL_TIME_MS,
								onprogress: (progress) => {
									onUpdate?.({
										content: [
											{
												type: "text",
												text: `Chrome DevTools ${tool.name}: ${progress.progress}${progress.total !== undefined ? `/${progress.total}` : ""}`,
											},
										],
										details: {
											mcpTool: tool.name,
											piTool: piToolName,
											server: serverInfo,
											contentTypes: ["progress"],
										} satisfies ChromeToolDetails,
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
						throw new Error(`Chrome DevTools MCP tool ${tool.name} failed: ${resultText(content)}`);
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
						} satisfies ChromeToolDetails,
					};
				},
			});
		}
	}

	async function connect(cwd: string): Promise<Client> {
		if (client && serverCwd === cwd) return client;
		if (client && serverCwd !== cwd) await disconnect();

		serverLogs = "";
		lastError = undefined;
		const nextTransport = new StdioClientTransport({
			command: "npx",
			args: [...MCP_SERVER_ARGS],
			cwd,
			env: getChildEnvironment(),
			stderr: "pipe",
			maxBufferSize: MAX_STDIO_MESSAGE_BYTES,
		});
		nextTransport.stderr?.on("data", (chunk) => appendServerLog(String(chunk)));

		const nextClient = new Client(
			{ name: "pi-chrome-devtools-mcp", version: "1.0.0" },
			{ capabilities: {} },
		);

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

	async function ensureConnected(cwd: string): Promise<Client> {
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
			ctx.ui.setStatus("chrome-devtools-mcp", undefined);
			return;
		}
		const text =
			state === "starting"
				? "Chrome: starting"
				: state === "ready"
					? `Chrome: ${registeredTools.size} tools`
					: "Chrome: error";
		ctx.ui.setStatus(
			"chrome-devtools-mcp",
			ctx.ui.theme.fg(state === "error" ? "error" : state === "ready" ? "success" : "warning", text),
		);
	}

	pi.registerCommand("chrome-devtools-status", {
		description: "Show Chrome DevTools MCP connection status",
		handler: async (_args, ctx) => {
			const state = client ? "connected" : connectionPromise ? "connecting" : "disconnected";
			const info = [
				`State: ${state}`,
				`Server: ${serverInfo?.name ?? "unknown"}${serverInfo?.version ? ` ${serverInfo.version}` : ""}`,
				`Package: ${MCP_PACKAGE}`,
				`Tools registered: ${registeredTools.size}`,
				`Process PID: ${transport?.pid ?? "none"}`,
				`Working directory: ${serverCwd ?? "none"}`,
				"Browser mode: headless",
				`Chrome profile: ${PI_CHROME_PROFILE}`,
				`FFmpeg: ${FFMPEG_PATH}`,
			];
			if (lastError) info.push(`Last error: ${lastError}`);
			ctx.ui.notify(info.join("\n"), lastError ? "warning" : "info");
		},
	});

	pi.registerCommand("chrome-devtools-restart", {
		description: "Restart Chrome DevTools MCP and refresh its tool definitions",
		handler: async (_args, ctx) => {
			updateStatus(ctx, "starting");
			await disconnect();
			try {
				await ensureConnected(ctx.cwd);
				updateStatus(ctx, "ready");
				ctx.ui.notify(`Chrome DevTools MCP restarted with ${registeredTools.size} tools`, "info");
			} catch (error) {
				updateStatus(ctx, "error");
				ctx.ui.notify(`Chrome DevTools MCP restart failed: ${lastError ?? String(error)}`, "error");
			}
		},
	});

	pi.registerCommand("chrome-devtools-logs", {
		description: "Show recent Chrome DevTools MCP server logs",
		handler: async (_args, ctx) => {
			ctx.ui.notify(serverLogs.trim() || "No Chrome DevTools MCP logs available", lastError ? "warning" : "info");
		},
	});

	pi.on("before_agent_start", async (event) => {
		if (registeredTools.size === 0) return;
		return {
			systemPrompt: `${event.systemPrompt}\n\nChrome DevTools MCP tools are available with the \`${TOOL_PREFIX}\` prefix. They share one persistent browser session. Prefer \`${TOOL_PREFIX}take_snapshot\` for page structure and use screenshots when visual inspection is necessary.`,
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		updateStatus(ctx, "starting");
		try {
			await ensureConnected(ctx.cwd);
			updateStatus(ctx, "ready");
		} catch (error) {
			updateStatus(ctx, "error");
			ctx.ui.notify(
				`Chrome DevTools MCP failed to start: ${lastError ?? String(error)}. Use /chrome-devtools-logs for details.`,
				"warning",
			);
		}
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		updateStatus(ctx, "off");
		await disconnect();
	});
}
