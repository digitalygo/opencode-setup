import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { COMPACT_CONTEXT_RATIO } from "./constants.ts";
import { idlePass } from "./prune.ts";

let compactDisarmed = false;

export function registerEscalation(pi: ExtensionAPI): void {
	pi.on("before_agent_start", (_event, ctx) => {
		const usage = ctx.getContextUsage();
		const ratio = usage && usage.tokens !== null ? usage.tokens / usage.contextWindow : null;
		if (ratio !== null && ratio <= COMPACT_CONTEXT_RATIO) {
			compactDisarmed = false;
		}
		if (!idlePass() || ratio === null || ratio <= COMPACT_CONTEXT_RATIO || compactDisarmed) {
			return;
		}
		compactDisarmed = true;
		ctx.compact({
			onComplete: () => ctx.ui.notify("Context hygiene compaction completed", "info"),
			onError: (error) => ctx.ui.notify(`Context hygiene compaction failed: ${error.message}`, "error"),
		});
	});
}
