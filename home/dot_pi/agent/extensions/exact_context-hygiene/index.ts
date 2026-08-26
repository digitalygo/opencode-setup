import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { dedupAndPurge } from "./dedup.ts";
import { registerEscalation } from "./escalate.ts";
import { isPinned, observeToolCall, registerPinTool, restorePins } from "./pins.ts";
import { registerHygieneCommand, restorePruned, runPrune } from "./prune.ts";
import {
	applyDropBudgets,
	buildCompactionResult,
	buildManualSummary,
	buildOverflowSummary,
	describeResult,
	getSelection,
	persistTombstone,
	resolveCompactionBoundary,
	restoreSelection,
	runSelectionFlow,
	setSelection,
} from "./selective-compact.ts";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", observeToolCall);
	registerPinTool(pi);
	registerHygieneCommand(pi);
	registerEscalation(pi);

	pi.on("session_start", (_event, ctx) => {
		setSelection(restoreSelection(ctx.sessionManager.getBranch()));
		restorePins(ctx.sessionManager.getBranch());
		restorePruned(ctx.sessionManager.getBranch());
	});

	pi.on("session_before_compact", async (event, ctx) => {
		const result = await runSelectionFlow(pi, ctx, event.customInstructions, event.signal);
		if (!result) {
			setSelection(null);
			persistTombstone(pi);
			ctx.ui.notify("Selective compact failed, using built-in compaction", "warning");
			return;
		}
		ctx.ui.notify(describeResult(result), "info");
		if (event.willRetry) {
			return {
				compaction: buildCompactionResult(event, result, buildOverflowSummary(result), event.preparation.firstKeptEntryId),
			};
		}
		return {
			compaction: buildCompactionResult(event, result, buildManualSummary(result), resolveCompactionBoundary(event.branchEntries)),
		};
	});

	pi.on("context", (event, ctx) => {
		const state = getSelection();
		let messages = event.messages;
		if (state) messages = applyDropBudgets(messages, state.dropBudgets);
		messages = dedupAndPurge(messages, isPinned);
		messages = runPrune(messages, ctx, pi, isPinned);
		return { messages };
	});
}
