import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { DEDUP_KEEP_LAST, ERROR_PURGE_MESSAGE_COUNT, PIN_TOOL_NAME } from "./constants.ts";

export interface ToolCallPairing {
	toolName: string;
	args: Record<string, any>;
}

export function buildToolCallPairing(messages: AgentMessage[]): Map<string, ToolCallPairing> {
	const pairing = new Map<string, ToolCallPairing>();
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			if (part.type !== "toolCall") continue;
			pairing.set(part.id, { toolName: part.name, args: part.arguments });
		}
	}
	return pairing;
}

export function canonicalizeJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalizeJson).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record).sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

function collectDedupCandidates(
	messages: AgentMessage[],
	pairing: Map<string, ToolCallPairing>,
	isPinned: (toolCallId: string) => boolean,
	candidates: Set<string>,
): void {
	const byFingerprint = new Map<string, string[]>();
	for (const message of messages) {
		if (message.role !== "toolResult") continue;
		const paired = pairing.get(message.toolCallId);
		if (!paired) continue;
		if (isPinned(message.toolCallId) || paired.toolName === "subagent" || paired.toolName === PIN_TOOL_NAME) continue;
		const fingerprint = `${paired.toolName}::${canonicalizeJson(paired.args)}`;
		const group = byFingerprint.get(fingerprint) ?? [];
		group.push(message.toolCallId);
		byFingerprint.set(fingerprint, group);
	}
	for (const group of byFingerprint.values()) {
		for (let index = 0; index < group.length - DEDUP_KEEP_LAST; index++) {
			const toolCallId = group[index];
			if (toolCallId) candidates.add(toolCallId);
		}
	}
}

function collectErrorPurgeCandidates(
	messages: AgentMessage[],
	isPinned: (toolCallId: string) => boolean,
	candidates: Set<string>,
): void {
	for (let index = 0; index < messages.length; index++) {
		const message = messages[index];
		if (!message || message.role !== "toolResult" || !message.isError) continue;
		if (isPinned(message.toolCallId)) continue;
		const followingMessages = messages.length - 1 - index;
		if (followingMessages >= ERROR_PURGE_MESSAGE_COUNT) candidates.add(message.toolCallId);
	}
}

function applyAtomicRemoval(messages: AgentMessage[], candidates: Set<string>): AgentMessage[] {
	if (candidates.size === 0) return messages;
	const result: AgentMessage[] = [];
	for (const message of messages) {
		if (message.role === "toolResult") {
			if (!candidates.has(message.toolCallId)) result.push(message);
			continue;
		}
		if (message.role === "assistant") {
			const content = message.content.filter((part) => part.type !== "toolCall" || !candidates.has(part.id));
			if (content.length === 0) continue;
			result.push({ ...message, content });
			continue;
		}
		result.push(message);
	}
	return result;
}

export function dedupAndPurge(
	messages: AgentMessage[],
	isPinned: (toolCallId: string) => boolean,
): AgentMessage[] {
	const pairing = buildToolCallPairing(messages);
	const candidates = new Set<string>();
	collectDedupCandidates(messages, pairing, isPinned, candidates);
	collectErrorPurgeCandidates(messages, isPinned, candidates);
	return applyAtomicRemoval(messages, candidates);
}
