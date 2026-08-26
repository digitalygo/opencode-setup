import { createHash } from "node:crypto";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { PREVIEW_LENGTH } from "./constants.ts";

export interface MessageInfo {
	index: number;
	fingerprint: string;
	role: string;
	kind: string;
	preview: string;
	tokens: number;
	toolCallId?: string;
	toolCallIds: string[];
}

export type UserContent = string | (TextContent | ImageContent)[];

function normalizeUserContent(content: UserContent): unknown {
	if (typeof content === "string") return content;
	return content.map((part) =>
		part.type === "text" ? { type: "text", text: part.text } : { type: "image", mimeType: part.mimeType, data: part.data },
	);
}

export function normalizeContent(message: AgentMessage): unknown {
	if (message.role === "assistant") {
		return message.content.map((part) => {
			if (part.type === "text") return { type: "text", text: part.text };
			if (part.type === "thinking") return { type: "thinking", thinking: part.thinking };
			return { type: "toolCall", id: part.id, name: part.name, arguments: part.arguments };
		});
	}
	if (message.role === "toolResult") {
		return {
			toolCallId: message.toolCallId,
			toolName: message.toolName,
			content: normalizeUserContent(message.content),
		};
	}
	if (message.role === "bashExecution") {
		return {
			command: message.command,
			output: message.output,
			exitCode: message.exitCode,
			cancelled: message.cancelled,
			truncated: message.truncated,
			fullOutputPath: message.fullOutputPath,
		};
	}
	if (message.role === "custom") {
		return { customType: message.customType, content: normalizeUserContent(message.content) };
	}
	if (message.role === "branchSummary") return { summary: message.summary, fromId: message.fromId };
	if (message.role === "compactionSummary") {
		return { summary: message.summary, tokensBefore: message.tokensBefore };
	}
	return normalizeUserContent(message.content);
}

export function fingerprintOf(message: AgentMessage): string {
	const digest = createHash("sha256").update(JSON.stringify(normalizeContent(message))).digest("hex");
	return `${message.role}:${digest}`;
}

export function tokensOf(message: AgentMessage): number {
	return Math.ceil(JSON.stringify(normalizeContent(message)).length / 4);
}

export function kindOf(message: AgentMessage): string {
	if (message.role === "assistant") {
		if (message.content.some((part) => part.type === "toolCall")) return "tool_call";
		if (message.content.some((part) => part.type === "thinking")) return "reasoning";
		return "text";
	}
	if (message.role === "toolResult") return "tool_result";
	if (message.role === "bashExecution") return "bash";
	if (message.role === "custom") return "custom";
	if (message.role === "branchSummary") return "branch_summary";
	if (message.role === "compactionSummary") return "compaction_summary";
	return "text";
}

export function sanitizePreview(text: string): string {
	return text.replace(/[\x00-\x1f\x7f]/g, " ");
}

export function truncatePreview(text: string): string {
	const sanitized = sanitizePreview(text);
	if (sanitized.length <= PREVIEW_LENGTH) return sanitized;
	return `${sanitized.slice(0, PREVIEW_LENGTH)}...`;
}

function previewOfUserContent(content: UserContent): string {
	if (typeof content === "string") return truncatePreview(content);
	const text = content.map((part) => (part.type === "text" ? part.text : "[image]")).join("\n");
	return truncatePreview(text);
}

export function previewOf(message: AgentMessage): string {
	if (message.role === "assistant") {
		const text = message.content
			.map((part) => {
				if (part.type === "text") return part.text;
				if (part.type === "thinking") return `thinking: ${part.thinking}`;
				return `call ${part.name}`;
			})
			.join("\n");
		return truncatePreview(text);
	}
	if (message.role === "toolResult") return previewOfUserContent(message.content);
	if (message.role === "bashExecution") return truncatePreview(message.output);
	if (message.role === "custom") return previewOfUserContent(message.content);
	if (message.role === "branchSummary") return truncatePreview(message.summary);
	if (message.role === "compactionSummary") return truncatePreview(message.summary);
	return previewOfUserContent(message.content);
}

export function buildManifest(messages: AgentMessage[]): MessageInfo[] {
	const manifest: MessageInfo[] = [];
	let index = 0;
	for (const message of messages) {
		let toolCallId: string | undefined;
		let toolCallIds: string[] = [];
		if (message.role === "toolResult") toolCallId = message.toolCallId;
		if (message.role === "assistant") {
			toolCallIds = message.content.flatMap((part) => (part.type === "toolCall" ? [part.id] : []));
		}
		manifest.push({
			index,
			fingerprint: fingerprintOf(message),
			role: message.role,
			kind: kindOf(message),
			preview: previewOf(message),
			tokens: tokensOf(message),
			toolCallId,
			toolCallIds,
		});
		index++;
	}
	return manifest;
}
