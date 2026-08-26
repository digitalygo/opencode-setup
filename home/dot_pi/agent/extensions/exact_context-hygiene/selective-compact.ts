import {
	buildContextEntries,
	sessionEntryToContextMessages,
	type CompactionEntry,
	type CompactionResult,
	type ExtensionAPI,
	type ExtensionContext,
	type SessionBeforeCompactEvent,
	type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Model, TextContent, Usage } from "@earendil-works/pi-ai";
import { MAX_CUSTOM_INSTRUCTIONS, MAX_SELECTION_TOKENS, PERSISTENCE_KEY } from "./constants.ts";
import { buildManifest, fingerprintOf, type MessageInfo } from "./fingerprints.ts";

export interface SelectionState {
	dropBudgets: Map<string, number>;
}

export interface SelectionResult {
	keptCount: number;
	totalCount: number;
	tokensBefore: number;
	tokensAfter: number;
	usage: Usage;
}

interface SelectiveDetails {
	kept: number;
	dropped: number;
	tokensBefore: number;
	tokensAfter: number;
}

let currentState: SelectionState | null = null;

export function getSelection(): SelectionState | null {
	return currentState;
}

export function setSelection(state: SelectionState | null): void {
	currentState = state;
}

export function providerVisibleMessages(entries: SessionEntry[]): AgentMessage[] {
	return buildContextEntries(entries).flatMap((entry) => sessionEntryToContextMessages(entry));
}

export function normalizeCustomInstructions(instructions: string | undefined): string | undefined {
	if (!instructions) return undefined;
	const cleaned = instructions.replace(/[\r\n]+/g, " ").trim();
	if (!cleaned) return undefined;
	return cleaned.length > MAX_CUSTOM_INSTRUCTIONS ? cleaned.slice(0, MAX_CUSTOM_INSTRUCTIONS) : cleaned;
}

function buildSelectionPrompt(manifest: MessageInfo[], customInstructions: string | undefined): string {
	const manifestLines = manifest.map(
		(item) => `${item.index}. [${item.role}] ${item.kind} (~${item.tokens} tokens) ${item.preview}`,
	);
	const prompt: string[] = [
		"You select conversation messages to keep verbatim when an AI assistant compacts its context. Nothing is summarized. You only choose which existing messages survive.",
		'Return ONLY a JSON object and nothing else, no prose, no code fences: {"keep": [0, 3, 7]}',
		"Keep messages that carry durable context for the ongoing task:",
		"- user requirements, constraints, and preferences",
		"- decisions and their rationale",
		"- code references and diffs being worked on",
		"- active errors and their diagnostics",
		"- the most recent user messages",
		"Drop everything else:",
		"- pleasantries and small talk",
		"- superseded drafts",
		"- redundant or stale tool outputs",
		"- resolved tangents",
		"Keep tool results only together with the assistant message that issued their tool call. The final user message is kept automatically.",
	];
	if (customInstructions) {
		prompt.push(`Additional selection bias requested by the user: ${customInstructions}`);
	}
	prompt.push("Manifest (index, role, kind, tokens, preview):");
	prompt.push(...manifestLines);
	return prompt.join("\n");
}

export function extractJson(text: string): string | null {
	let cleaned = text.trim();
	const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(cleaned);
	if (fenced && fenced[1] !== undefined) cleaned = fenced[1].trim();
	if (!cleaned.startsWith("{") || !cleaned.endsWith("}")) return null;
	return cleaned;
}

function parseKeepIndices(text: string, maxIndex: number): Set<number> | null {
	const json = extractJson(text);
	if (!json) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const keep = (parsed as { keep?: unknown }).keep;
	if (!Array.isArray(keep) || keep.length === 0) return null;
	const indices = new Set<number>();
	for (const entry of keep) {
		if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0 || entry > maxIndex) {
			return null;
		}
		indices.add(entry);
	}
	return indices;
}

function applyAtomicityRules(manifest: MessageInfo[], keepIndices: Set<number>): void {
	const assistantIndexByToolCall = new Map<string, number>();
	const resultIndexByToolCall = new Map<string, number>();
	for (const item of manifest) {
		if (item.role === "assistant") {
			for (const toolCallId of item.toolCallIds) assistantIndexByToolCall.set(toolCallId, item.index);
		}
		if (item.role === "toolResult" && item.toolCallId) {
			resultIndexByToolCall.set(item.toolCallId, item.index);
		}
	}
	let changed = true;
	while (changed) {
		changed = false;
		for (const item of manifest) {
			if (!keepIndices.has(item.index)) continue;
			if (item.role === "assistant") {
				for (const toolCallId of item.toolCallIds) {
					const resultIndex = resultIndexByToolCall.get(toolCallId);
					if (resultIndex !== undefined && !keepIndices.has(resultIndex)) {
						keepIndices.add(resultIndex);
						changed = true;
					}
				}
			}
			if (item.role === "toolResult" && item.toolCallId) {
				const assistantIndex = assistantIndexByToolCall.get(item.toolCallId);
				if (assistantIndex !== undefined && !keepIndices.has(assistantIndex)) {
					keepIndices.add(assistantIndex);
					changed = true;
				}
			}
		}
	}
}

function keepFinalUserMessage(manifest: MessageInfo[], keepIndices: Set<number>): void {
	for (let index = manifest.length - 1; index >= 0; index--) {
		const item = manifest[index];
		if (item?.role === "user") {
			keepIndices.add(item.index);
			return;
		}
	}
}

async function completeSelection(
	ctx: ExtensionContext,
	model: Model<any>,
	prompt: string,
	signal: AbortSignal | undefined,
): Promise<AssistantMessage | null> {
	try {
		const response = await ctx.modelRegistry.complete(
			model,
			{ messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }] },
			{ signal, cacheRetention: "none", maxTokens: MAX_SELECTION_TOKENS },
		);
		if (signal?.aborted) return null;
		if (response.stopReason === "error" || response.stopReason === "aborted") return null;
		return response;
	} catch {
		return null;
	}
}

function selectionText(response: AssistantMessage): string {
	return response.content
		.filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

function persistSelection(pi: ExtensionAPI, dropBudgets: Map<string, number>): void {
	pi.appendEntry(PERSISTENCE_KEY, { dropBudgets: Object.fromEntries(dropBudgets), timestamp: Date.now() });
}

export function persistTombstone(pi: ExtensionAPI): void {
	pi.appendEntry(PERSISTENCE_KEY, { dropBudgets: {}, timestamp: Date.now() });
}

export function restoreSelection(branchEntries: SessionEntry[]): SelectionState | null {
	let restored: { dropBudgets: Map<string, number>; hasState: boolean } | null = null;
	for (const entry of branchEntries) {
		if (entry.type !== "custom" || entry.customType !== PERSISTENCE_KEY) continue;
		const data = entry.data as { dropBudgets?: unknown } | undefined;
		if (!data || typeof data.dropBudgets !== "object" || data.dropBudgets === null || Array.isArray(data.dropBudgets)) {
			continue;
		}
		const budgets = new Map<string, number>();
		let hasState = false;
		for (const [fingerprint, count] of Object.entries(data.dropBudgets)) {
			if (typeof count === "number" && count > 0) {
				budgets.set(fingerprint, count);
				hasState = true;
			}
		}
		restored = { dropBudgets: budgets, hasState };
	}
	if (!restored) return null;
	return restored.hasState ? { dropBudgets: restored.dropBudgets } : null;
}

export function computeDropBudgets(manifest: MessageInfo[], keepIndices: Set<number>): Map<string, number> {
	const budgets = new Map<string, number>();
	for (const item of manifest) {
		if (keepIndices.has(item.index)) continue;
		budgets.set(item.fingerprint, (budgets.get(item.fingerprint) ?? 0) + 1);
	}
	return budgets;
}

export function applyDropBudgets(messages: AgentMessage[], budgets: Map<string, number>): AgentMessage[] {
	const remaining = new Map(budgets);
	return messages.filter((message) => {
		const fingerprint = fingerprintOf(message);
		const budget = remaining.get(fingerprint);
		if (budget === undefined || budget <= 0) return true;
		remaining.set(fingerprint, budget - 1);
		return false;
	});
}

export function resolveCompactionBoundary(branchEntries: SessionEntry[]): string {
	const compactions = branchEntries.filter((entry): entry is CompactionEntry => entry.type === "compaction");
	if (compactions.length === 0) return branchEntries[0]?.id ?? "";
	const latest = compactions.at(-1);
	if (!latest) return branchEntries[0]?.id ?? "";
	const latestIndex = branchEntries.findIndex((entry) => entry.id === latest.id);
	const hasValidPriorBoundary = branchEntries
		.slice(0, latestIndex)
		.some((entry) => entry.id === latest.firstKeptEntryId);
	return hasValidPriorBoundary ? latest.firstKeptEntryId : latest.id;
}

export async function runSelectionFlow(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	customInstructions: string | undefined,
	signal: AbortSignal | undefined,
): Promise<SelectionResult | null> {
	const model = ctx.model;
	if (!model) return null;
	const messages = providerVisibleMessages(ctx.sessionManager.buildContextEntries());
	if (messages.length === 0) return null;
	const manifest = buildManifest(messages);
	const response = await completeSelection(
		ctx,
		model,
		buildSelectionPrompt(manifest, normalizeCustomInstructions(customInstructions)),
		signal,
	);
	if (!response) return null;
	const keepIndices = parseKeepIndices(selectionText(response), manifest.length - 1);
	if (!keepIndices) return null;
	applyAtomicityRules(manifest, keepIndices);
	keepFinalUserMessage(manifest, keepIndices);
	const dropBudgets = computeDropBudgets(manifest, keepIndices);
	currentState = { dropBudgets };
	persistSelection(pi, dropBudgets);
	const tokensBefore = manifest.reduce((sum, item) => sum + item.tokens, 0);
	const tokensAfter = manifest
		.filter((item) => keepIndices.has(item.index))
		.reduce((sum, item) => sum + item.tokens, 0);
	return { keptCount: keepIndices.size, totalCount: manifest.length, tokensBefore, tokensAfter, usage: response.usage };
}

export function describeResult(result: SelectionResult): string {
	const dropped = result.totalCount - result.keptCount;
	const delta = result.tokensBefore - result.tokensAfter;
	return `Selective compact: kept ${result.keptCount} of ${result.totalCount} messages, dropped ${dropped}, freed ~${delta} tokens (${result.tokensAfter} remain)`;
}

function buildSelectiveDetails(result: SelectionResult): SelectiveDetails {
	return {
		kept: result.keptCount,
		dropped: result.totalCount - result.keptCount,
		tokensBefore: result.tokensBefore,
		tokensAfter: result.tokensAfter,
	};
}

export function buildOverflowSummary(result: SelectionResult): string {
	const dropped = result.totalCount - result.keptCount;
	return `Selective compact: kept ${result.keptCount} of ${result.totalCount} messages (dropped ${dropped}). Older messages hidden by this marker remain in session history.`;
}

export function buildManualSummary(result: SelectionResult): string {
	const dropped = result.totalCount - result.keptCount;
	return `Selective compact: kept ${result.keptCount} of ${result.totalCount} provider-visible messages verbatim (dropped ${dropped}). Context baseline re-marked; retained history preserved.`;
}

export function buildCompactionResult(
	event: SessionBeforeCompactEvent,
	result: SelectionResult,
	summary: string,
	firstKeptEntryId: string,
): CompactionResult<SelectiveDetails> {
	return {
		summary,
		firstKeptEntryId,
		tokensBefore: event.preparation.tokensBefore,
		estimatedTokensAfter: result.tokensAfter,
		usage: result.usage,
		details: buildSelectiveDetails(result),
	};
}
