import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import {
	COMPACT_CONTEXT_RATIO,
	PERSISTENCE_KEY_PRUNED,
	PRUNED_PLACEHOLDER,
	PRUNE_CONTEXT_MIN,
	PRUNE_IDLE_MS,
	PRUNE_MIN_CONTENT_CHARS,
	PRUNE_RECENT_WINDOW,
} from "./constants.ts";
import { buildToolCallPairing } from "./dedup.ts";
import { pinnedIds } from "./pins.ts";

let prunedToolCallIds: Set<string> = new Set();
let forceNextPrunePass = false;
let lastAssistantTimestamp: number | null = null;

export function restorePruned(branchEntries: SessionEntry[]): void {
	prunedToolCallIds = new Set(latestPrunedEntry(branchEntries));
}

export function forcePruneNextPass(): void {
	forceNextPrunePass = true;
}

export function prunedCount(): number {
	return prunedToolCallIds.size;
}

export function isPruned(toolCallId: string): boolean {
	return prunedToolCallIds.has(toolCallId);
}

function latestPrunedEntry(branchEntries: SessionEntry[]): string[] {
	for (let index = branchEntries.length - 1; index >= 0; index--) {
		const entry = branchEntries[index];
		if (!entry || entry.type !== "custom" || entry.customType !== PERSISTENCE_KEY_PRUNED) continue;
		const toolCallIds = parsePrunedPayload(entry.data);
		if (toolCallIds) return toolCallIds;
	}
	return [];
}

function parsePrunedPayload(data: unknown): string[] | null {
	if (typeof data !== "object" || data === null) return null;
	const toolCallIds = (data as { toolCallIds?: unknown }).toolCallIds;
	if (!Array.isArray(toolCallIds)) return null;
	return toolCallIds.filter((value): value is string => typeof value === "string");
}

function persistPruned(pi: ExtensionAPI): void {
	pi.appendEntry(PERSISTENCE_KEY_PRUNED, { toolCallIds: prunedIds(), timestamp: Date.now() });
}

function prunedIds(): string[] {
	return Array.from(prunedToolCallIds);
}

function newestAssistantTimestamp(messages: AgentMessage[]): number | null {
	let newest: number | null = null;
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		if (newest === null || message.timestamp > newest) newest = message.timestamp;
	}
	return newest;
}

function contextBandPass(ctx: ExtensionContext): boolean {
	const usage = ctx.getContextUsage();
	if (!usage || usage.tokens === null) return false;
	const ratio = usage.tokens / usage.contextWindow;
	return ratio > PRUNE_CONTEXT_MIN && ratio <= COMPACT_CONTEXT_RATIO;
}

export function idlePass(): boolean {
	if (lastAssistantTimestamp === null) return false;
	return Date.now() - lastAssistantTimestamp > PRUNE_IDLE_MS;
}

function contentCharCount(message: Extract<AgentMessage, { role: "toolResult" }>): number {
	let count = 0;
	for (const part of message.content) {
		if (part.type === "text") count += part.text.length;
	}
	return count;
}

function isSkillLoad(toolCallId: string, pairing: Map<string, { toolName: string; args: Record<string, any> }>): boolean {
	const paired = pairing.get(toolCallId);
	if (!paired) return false;
	if (paired.toolName !== "read" && paired.toolName !== "grep") return false;
	return Object.values(paired.args).some((value) => typeof value === "string" && value.endsWith("SKILL.md"));
}

function isEligible(
	message: AgentMessage,
	pairing: Map<string, { toolName: string; args: Record<string, any> }>,
	isPinned: (toolCallId: string) => boolean,
): boolean {
	if (message.role !== "toolResult") return false;
	if (isPinned(message.toolCallId)) return false;
	if (message.isError) return false;
	if (prunedToolCallIds.has(message.toolCallId)) return false;
	if (contentCharCount(message) < PRUNE_MIN_CONTENT_CHARS) return false;
	if (message.toolName === "subagent") return false;
	if (isSkillLoad(message.toolCallId, pairing)) return false;
	return true;
}

function applyPrunePlaceholders(messages: AgentMessage[]): AgentMessage[] {
	if (prunedToolCallIds.size === 0) return messages;
	let changed = false;
	const result = messages.map((message) => {
		if (message.role !== "toolResult" || !prunedToolCallIds.has(message.toolCallId)) return message;
		changed = true;
		return { ...message, content: [{ type: "text" as const, text: PRUNED_PLACEHOLDER }] };
	});
	return changed ? result : messages;
}

export function runPrune(
	messages: AgentMessage[],
	ctx: ExtensionContext,
	pi: ExtensionAPI,
	isPinned: (toolCallId: string) => boolean,
): AgentMessage[] {
	lastAssistantTimestamp = newestAssistantTimestamp(messages);
	const force = forceNextPrunePass;
	forceNextPrunePass = false;
	const pairing = buildToolCallPairing(messages);

	if (force || (contextBandPass(ctx) && idlePass())) {
		const newlyPruned: string[] = [];
		const windowStart = messages.length - PRUNE_RECENT_WINDOW;
		for (let index = 0; index < messages.length; index++) {
			const message = messages[index];
			if (!message || index >= windowStart || !isEligible(message, pairing, isPinned)) continue;
			if (message.role !== "toolResult") continue;
			prunedToolCallIds.add(message.toolCallId);
			newlyPruned.push(message.toolCallId);
		}
		if (newlyPruned.length > 0) {
			persistPruned(pi);
			ctx.ui.notify(`Pruned ${newlyPruned.length} tool result(s)`, "info");
		}
	}

	return applyPrunePlaceholders(messages);
}

function showStatus(ctx: ExtensionContext): void {
	const usage = ctx.getContextUsage();
	const percent = usage && usage.percent !== null ? `${Math.round(usage.percent)}%` : "unknown";
	const minutes =
		lastAssistantTimestamp === null ? "unknown" : Math.floor((Date.now() - lastAssistantTimestamp) / 60000);
	const ratio = usage && usage.tokens !== null ? usage.tokens / usage.contextWindow : null;
	const contextGate = ratio !== null && ratio > PRUNE_CONTEXT_MIN && ratio <= COMPACT_CONTEXT_RATIO;
	const idleGate = lastAssistantTimestamp !== null && Date.now() - lastAssistantTimestamp > PRUNE_IDLE_MS;
	const gatesPass = contextGate && idleGate;
	ctx.ui.notify(
		[
			`Pinned: ${pinnedIds().length}`,
			`Pruned: ${prunedToolCallIds.size}`,
			`Context usage: ${percent}`,
			`Minutes since newest assistant message: ${minutes}`,
			`Prune gates pass: ${gatesPass ? "yes" : "no"} (context: ${contextGate ? "yes" : "no"}, idle: ${idleGate ? "yes" : "no"})`,
		].join("\n"),
		"info",
	);
}

export function registerHygieneCommand(pi: ExtensionAPI): void {
	pi.registerCommand("hygiene", {
		description: "Context hygiene status and control",
		handler: async (args, ctx) => {
			const subcommand = args.trim().split(/\s+/)[0] ?? "";
			if (subcommand === "prune") {
				forcePruneNextPass();
				ctx.ui.notify("Forcing a prune pass on the next context update", "info");
				return;
			}
			showStatus(ctx);
		},
	});
}
