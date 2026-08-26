import type { ExtensionAPI, SessionEntry, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { MAX_PINS_PER_CALL, PERSISTENCE_KEY_PINS, PIN_TOOL_NAME } from "./constants.ts";

const observedToolCallIds: string[] = [];
let pinnedToolCallIds: Set<string> = new Set();

export function observeToolCall(event: ToolCallEvent): void {
	if (event.toolName === PIN_TOOL_NAME) return;
	observedToolCallIds.push(event.toolCallId);
}

export function isPinned(toolCallId: string): boolean {
	return pinnedToolCallIds.has(toolCallId);
}

export function pinnedIds(): string[] {
	return Array.from(pinnedToolCallIds);
}

export function restorePins(branchEntries: SessionEntry[]): void {
	pinnedToolCallIds = new Set(latestPinsEntry(branchEntries));
}

export function pinLast(count: number, pi: ExtensionAPI): { pinnedCount: number; totalPinned: number } {
	const limit = Math.min(Math.max(count, 1), MAX_PINS_PER_CALL);
	const toPin: string[] = [];
	for (let index = observedToolCallIds.length - 1; index >= 0 && toPin.length < limit; index--) {
		const toolCallId = observedToolCallIds[index];
		if (toolCallId === undefined) continue;
		if (pinnedToolCallIds.has(toolCallId)) continue;
		toPin.push(toolCallId);
	}
	for (const toolCallId of toPin) pinnedToolCallIds.add(toolCallId);
	if (toPin.length > 0) {
		pi.appendEntry(PERSISTENCE_KEY_PINS, { toolCallIds: pinnedIds(), timestamp: Date.now() });
	}
	return { pinnedCount: toPin.length, totalPinned: pinnedToolCallIds.size };
}

function latestPinsEntry(branchEntries: SessionEntry[]): string[] {
	for (let index = branchEntries.length - 1; index >= 0; index--) {
		const entry = branchEntries[index];
		if (!entry || entry.type !== "custom" || entry.customType !== PERSISTENCE_KEY_PINS) continue;
		const toolCallIds = parsePinsPayload(entry.data);
		if (toolCallIds) return toolCallIds;
	}
	return [];
}

function parsePinsPayload(data: unknown): string[] | null {
	if (typeof data !== "object" || data === null) return null;
	const ids = (data as { toolCallIds?: unknown }).toolCallIds;
	if (!Array.isArray(ids)) return null;
	return ids.filter((value): value is string => typeof value === "string");
}

export const pinParameters = Type.Object({
	count: Type.Optional(
		Type.Integer({ description: "How many recent tool calls to pin. Defaults to 1.", default: 1 }),
	),
});

export function registerPinTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: PIN_TOOL_NAME,
		label: "Pin context",
		description: [
			"Pins the last N tool calls so their results are excluded from context deduplication and pruning.",
			"Call it right after the tool calls you want to protect, for example for before/after state checks with identical commands.",
		].join(" "),
		parameters: pinParameters,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = pinLast(params.count ?? 1, pi);
			ctx.ui.notify(`Pinned ${result.pinnedCount} tool call(s); ${result.totalPinned} pinned total`, "info");
			return {
				content: [
					{
						type: "text",
						text: `Pinned ${result.pinnedCount} tool call(s). Total pinned: ${result.totalPinned}.`,
					},
				],
				details: { pinned: result.pinnedCount, totalPinned: result.totalPinned },
			};
		},
	});
}
