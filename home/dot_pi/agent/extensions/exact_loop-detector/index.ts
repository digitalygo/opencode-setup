import { createHash } from "node:crypto";
import type { ExtensionAPI, TurnEndEvent } from "@earendil-works/pi-coding-agent";

interface Config {
	windowSize: number;
	reasoningStuckThreshold: number;
	reasoningStuckThresholdSimilarity: number;
	repeatSequenceMinLength: number;
	repeatPatternMinReps: number;
	subagentNestingThreshold: number;
	messageRepeatThreshold: number;
	messageRepeatSimilarity: number;
	messageRepeatMinLength: number;
	escalateAfter: number;
	enableReasoningDetection: boolean;
	enableToolRepetitionDetection: boolean;
	enableReadRepetitionDetection: boolean;
	enableSearchSpiralDetection: boolean;
	enableSubagentCycleDetection: boolean;
	enableMessageRepetitionDetection: boolean;
}

const DEFAULT_CONFIG: Config = {
	windowSize: 10,
	reasoningStuckThreshold: 4,
	reasoningStuckThresholdSimilarity: 0.85,
	repeatSequenceMinLength: 6,
	repeatPatternMinReps: 3,
	subagentNestingThreshold: 3,
	messageRepeatThreshold: 3,
	messageRepeatSimilarity: 0.85,
	messageRepeatMinLength: 80,
	escalateAfter: 2,
	enableReasoningDetection: true,
	enableToolRepetitionDetection: true,
	enableReadRepetitionDetection: true,
	enableSearchSpiralDetection: true,
	enableSubagentCycleDetection: true,
	enableMessageRepetitionDetection: true,
};

interface TurnRecord {
	turnIndex: number;
	thinkingText: string;
	textContent: string;
	toolCalls: Array<{
		toolCallId: string;
		name: string;
		callKey: string;
		displaySummary: string;
		resultKey: string | null;
		isError: boolean;
		hasResult: boolean;
	}>;
}

interface DetectionResult {
	type: string;
	message: string;
}

const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as Array<keyof Config>;

let config: Config = { ...DEFAULT_CONFIG };
let turnWindow: TurnRecord[] = [];
let consecutiveDetections = 0;

function normalizeThinking(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, "<code>")
		.replace(/`[^`]+`/g, "<code>")
		.replace(/\/?(?:Users|home|~)[^\s)]+/g, "<path>")
		.replace(/\s+/g, " ")
		.replace(/\b[a-z]{1,4}\b/g, "")
		.trim()
		.toLowerCase();
}

function normalizeText(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]+`/g, " ")
		.replace(/\/?(?:Users|home|~)[^\s)]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function similarity(a: string, b: string): number {
	const wA = new Set(a.split(/\s+/).filter(Boolean));
	const wB = new Set(b.split(/\s+/).filter(Boolean));
	if (wA.size === 0 || wB.size === 0) return 0;
	let inter = 0;
	for (const w of wA) if (wB.has(w)) inter++;
	return inter / (wA.size + wB.size - inter);
}

function sha256(input: string): string {
	return createHash("sha256").update(input).digest("hex");
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const k of Object.keys(value as Record<string, unknown>).sort()) {
			out[k] = sortKeys((value as Record<string, unknown>)[k]);
		}
		return out;
	}
	return value;
}

function canonicalJson(value: unknown): string {
	return JSON.stringify(sortKeys(value));
}

function callFingerprint(toolName: string, args: Record<string, any>): string {
	return sha256(canonicalJson({ name: toolName, args }));
}

function resultFingerprint(toolResult: any): string {
	const content = Array.isArray(toolResult?.content)
		? toolResult.content.map((block: any) => {
				if (block?.type === "text") return { type: "text", text: block.text ?? "" };
				if (block?.type === "image") return { type: "image", mimeType: block.mimeType ?? "", data: sha256(block.data ?? "") };
				return { type: "unknown" };
			})
		: [];
	return sha256(canonicalJson({ toolName: toolResult?.toolName ?? "", isError: !!toolResult?.isError, content }));
}

function normalizeTask(task: string): string {
	return task
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/[^a-z0-9 ]/g, "")
		.trim();
}

function summarizeSubagent(args: Record<string, any>): string {
	const pairs: Array<[string, string]> = [];
	if (typeof args.agent === "string") {
		pairs.push([args.agent, typeof args.task === "string" ? args.task : ""]);
	}
	for (const group of ["tasks", "chain"]) {
		const list = args[group];
		if (Array.isArray(list)) {
			for (const item of list) {
				if (item && typeof item === "object" && typeof item.agent === "string") {
					pairs.push([item.agent, typeof item.task === "string" ? item.task : ""]);
				}
			}
		}
	}
	if (pairs.length === 0) return "subagent";
	return pairs
		.map(([agent, task]) => `subagent(${agent || "default"}#${sha256(normalizeTask(task)).slice(0, 8)})`)
		.join(" + ");
}

function displaySummary(toolName: string, args: Record<string, any>): string {
	if (!args || typeof args !== "object") return toolName;
	if (toolName === "bash") {
		const cmd = args.command;
		if (typeof cmd === "string") {
			return cmd.length > 40 ? cmd.slice(0, 40) : cmd;
		}
	}
	if (toolName === "subagent") {
		return summarizeSubagent(args);
	}
	const path = args.path ?? args.filePath;
	if (typeof path === "string") {
		return `${toolName}(${path})`;
	}
	const pattern = args.pattern;
	if (typeof pattern === "string") {
		const s = `${toolName}("${pattern}")`;
		return s.length > 30 ? s.slice(0, 30) : s;
	}
	return toolName;
}

function detectSubagentCycle(recs: TurnRecord[]): DetectionResult | null {
	if (!config.enableSubagentCycleDetection) return null;
	if (process.env.PI_SUBAGENT_CHILD !== "1") return null;
	const failing: string[] = [];
	for (const rec of recs) {
		for (const call of rec.toolCalls) {
			if (call.name !== "subagent" || !call.hasResult || !call.isError || call.resultKey === null) continue;
			failing.push(call.resultKey);
		}
	}
	if (failing.length === 0) return null;
	const last = failing[failing.length - 1];
	let run = 0;
	for (let i = failing.length - 1; i >= 0; i--) {
		if (failing[i] === last) run++;
		else break;
	}
	if (run >= config.subagentNestingThreshold) {
		return {
			type: "subagent-cycle",
			message: `Nested subagent loop: ${run} blocked subagent attempts with identical error output.`,
		};
	}
	return null;
}

function detectMessageRepetition(recs: TurnRecord[]): DetectionResult | null {
	if (!config.enableMessageRepetitionDetection) return null;
	const messages = recs
		.map((r) => ({ turnIndex: r.turnIndex, text: r.textContent.trim() }))
		.filter((m) => m.text.length >= config.messageRepeatMinLength);
	if (messages.length < 2) return null;
	const target = messages[messages.length - 1];
	const targetNorm = normalizeText(target.text);
	let matches = 0;
	for (const m of messages) {
		if (similarity(targetNorm, normalizeText(m.text)) >= config.messageRepeatSimilarity) {
			matches++;
		}
	}
	if (matches >= config.messageRepeatThreshold) {
		return {
			type: "message-repetition",
			message:
				`Message repetition: ${matches} of the last ${messages.length} assistant messages are ` +
				`≥${Math.round(config.messageRepeatSimilarity * 100)}% similar to the most recent one ` +
				`(turn ${target.turnIndex}).`,
		};
	}
	return null;
}

function detectReasoningStagnation(recs: TurnRecord[]): DetectionResult | null {
	if (!config.enableReasoningDetection) return null;
	const withThinking = recs.filter((r) => r.thinkingText.length > 10);
	if (withThinking.length < config.reasoningStuckThreshold) return null;
	const normed = withThinking.map((r) => normalizeThinking(r.thinkingText));
	for (let i = 0; i <= normed.length - config.reasoningStuckThreshold; i++) {
		const win = normed.slice(i, i + config.reasoningStuckThreshold);
		let stuck = true;
		for (let j = 0; j < win.length - 1; j++) {
			if (similarity(win[j], win[j + 1]) < config.reasoningStuckThresholdSimilarity) {
				stuck = false;
				break;
			}
		}
		if (stuck) {
			const winRecs = withThinking.slice(i, i + win.length);
			return {
				type: "reasoning-stagnation",
				message:
					`Stuck reasoning: ${winRecs.length} consecutive turns with ≥` +
					`${Math.round(config.reasoningStuckThresholdSimilarity * 100)}% word overlap in thinking ` +
					`(turns ${winRecs[0].turnIndex}-${winRecs[winRecs.length - 1].turnIndex}).`,
			};
		}
	}
	return null;
}

function detectToolRepetition(recs: TurnRecord[]): DetectionResult | null {
	if (!config.enableToolRepetitionDetection) return null;
	const seq: TurnRecord["toolCalls"] = [];
	for (const rec of recs) {
		for (const call of rec.toolCalls) seq.push(call);
	}
	if (seq.length < config.repeatSequenceMinLength) return null;
	for (const pLen of [2, 3]) {
		for (let s = 0; s <= seq.length - pLen * config.repeatPatternMinReps; s++) {
			const pat = seq.slice(s, s + pLen);
			if (!pat.every((c) => c.hasResult)) continue;
			let reps = 1;
			let pos = s + pLen;
			while (pos + pLen <= seq.length) {
				const next = seq.slice(pos, pos + pLen);
				if (next.every((c, i) => c.hasResult && c.callKey === pat[i].callKey && c.resultKey === pat[i].resultKey)) {
					reps++;
					pos += pLen;
				} else break;
			}
			if (reps >= config.repeatPatternMinReps) {
				return {
					type: "tool-repetition",
					message: `Tool call repetition: "${pat.map((c) => c.displaySummary).join(" → ")}" repeated ${reps} times in a row with identical output.`,
				};
			}
		}
	}
	return null;
}

function detectReadRepetition(recs: TurnRecord[]): DetectionResult | null {
	if (!config.enableReadRepetitionDetection) return null;
	const reads = new Map<string, number>();
	for (const rec of recs) {
		for (const call of rec.toolCalls) {
			if (call.name !== "read") continue;
			const m = call.displaySummary.match(/^read\((.+)\)$/);
			if (!m) continue;
			reads.set(m[1], (reads.get(m[1]) ?? 0) + 1);
		}
	}
	for (const [path, count] of reads) {
		if (count >= 4) {
			return {
				type: "read-repetition",
				message: `Read repetition: "${path.split("/").pop() ?? path}" read ${count} times across the window.`,
			};
		}
	}
	return null;
}

function detectSearchSpiral(recs: TurnRecord[]): DetectionResult | null {
	if (!config.enableSearchSpiralDetection) return null;
	const norm = (p: string) =>
		p
			.replace(/["'\\]/g, "")
			.replace(/\*/g, "WILD")
			.replace(/\./g, "DOT")
			.toLowerCase()
			.slice(0, 40);
	interface SearchCall {
		norm: string;
		path: string;
	}
	const searches: SearchCall[] = [];
	for (const rec of recs) {
		for (const call of rec.toolCalls) {
			if (!["grep", "find", "glob", "search_files"].includes(call.name)) continue;
			const patternMatch = call.displaySummary.match(/^\w+\("([^"]+)"/);
			const pattern = patternMatch ? patternMatch[1] : call.displaySummary;
			const pathMatch = call.displaySummary.match(/(?:grep|find|search_files)\([^,]+,\s*(.+)/);
			const path = pathMatch ? pathMatch[1] : "current";
			searches.push({ norm: norm(pattern), path });
		}
	}
	if (searches.length < 3) return null;
	const patternPaths = new Map<string, Set<string>>();
	for (const s of searches) {
		const paths = patternPaths.get(s.norm) ?? new Set();
		paths.add(s.path);
		patternPaths.set(s.norm, paths);
	}
	for (const [pNorm, paths] of patternPaths) {
		if (paths.size >= 3) {
			return {
				type: "search-spiral",
				message: `Search spiral: pattern "${pNorm}" searched across ${paths.size} different paths.`,
			};
		}
	}
	for (let i = 0; i <= searches.length - 3; i++) {
		const n1 = searches[i].norm;
		const n2 = searches[i + 1].norm;
		const n3 = searches[i + 2].norm;
		if (n1.length < n2.length && n2.length < n3.length && n1.length > 3 && n1 !== n2 && n2 !== n3) {
			return {
				type: "search-spiral",
				message: `Search spiral: patterns expanding "${n1}" → "${n2}" → "${n3}".`,
			};
		}
	}
	return null;
}

function runDetectors(recs: TurnRecord[]): DetectionResult[] {
	const findings: DetectionResult[] = [];
	const detections: Array<(recs: TurnRecord[]) => DetectionResult | null> = [
		detectSubagentCycle,
		detectMessageRepetition,
		detectReasoningStagnation,
		detectToolRepetition,
		detectReadRepetition,
		detectSearchSpiral,
	];
	for (const detector of detections) {
		const found = detector(recs);
		if (found) findings.push(found);
	}
	return findings;
}

function buildSteerMessage(
	text: string,
	customType: string,
): {
	customType: string;
	content: [{ type: "text"; text: string }];
	display: true;
} {
	return { customType, content: [{ type: "text" as const, text }], display: true };
}

function extractFromMessage(event: TurnEndEvent): { thinking: string; text: string; toolCalls: TurnRecord["toolCalls"] } {
	const content = Array.isArray(event.message?.content) ? event.message!.content : [];
	const results = Array.isArray(event.toolResults) ? event.toolResults : [];
	const resultById = new Map<string, any>();
	for (const r of results) {
		if (r && typeof r === "object" && typeof r.toolCallId === "string") {
			resultById.set(r.toolCallId, r);
		}
	}
	let thinking = "";
	let text = "";
	const toolCalls: TurnRecord["toolCalls"] = [];
	for (const block of content as any[]) {
		if (!block || typeof block !== "object") continue;
		if (block.type === "thinking" && typeof block.thinking === "string") {
			thinking += block.thinking;
		} else if (block.type === "text" && typeof block.text === "string") {
			text += block.text;
		} else if (block.type === "toolCall" && typeof block.name === "string") {
			const result = resultById.get(block.id);
			const hasResult = !!result && result.toolName === block.name;
			toolCalls.push({
				toolCallId: typeof block.id === "string" ? block.id : "",
				name: block.name,
				callKey: callFingerprint(block.name, block.arguments ?? {}),
				displaySummary: displaySummary(block.name, block.arguments ?? {}),
				resultKey: hasResult ? resultFingerprint(result) : null,
				isError: hasResult ? !!result.isError : false,
				hasResult,
			});
		}
	}
	return { thinking: thinking.trim(), text: text.trim(), toolCalls };
}

export default function piLoopDetectExtension(
	pi: ExtensionAPI,
	opts?: Partial<Config>,
): void {
	config = { ...DEFAULT_CONFIG, ...opts };

	pi.on("session_start", () => {
		turnWindow = [];
		consecutiveDetections = 0;
	});

	pi.registerCommand(
		"loop-detector",
		{
			description: "Show or configure loop detection",
			handler: async (args: string, ctx: any) => {
				const changes: Array<[keyof Config, unknown]> = [];
				const tokens = args.trim() ? args.trim().split(/\s+/) : [];
				for (const kv of tokens) {
					const eq = kv.indexOf("=");
					if (eq <= 0) continue;
					const key = kv.slice(0, eq) as keyof Config;
					const raw = kv.slice(eq + 1);
					if (!CONFIG_KEYS.includes(key)) continue;
					if (key.startsWith("enable")) {
						changes.push([key, raw !== "false"]);
					} else {
						const n = Number(raw);
						if (!Number.isNaN(n)) changes.push([key, n]);
					}
				}
				for (const [k, v] of changes) {
					(config as unknown as Record<string, unknown>)[k] = v;
				}
				if (changes.length > 0) {
					const applied = changes.map(([k, v]) => `${String(k)}=${String(v)}`).join(", ");
					ctx.ui.notify(`Loop detector config updated: ${applied}`, "info");
				}
				const lines = [
					"**Loop detector status**",
					`Turns tracked in window: ${turnWindow.length}`,
					...CONFIG_KEYS.map((k) => {
						const v = config[k];
						const display = typeof v === "number" ? String(v) : v ? "true" : "false";
						return `- ${k}=${display}`;
					}),
				].join("\n");
				pi.sendMessage(buildSteerMessage(lines, "loop-detector-status"), { deliverAs: "steer" });
			},
			getArgumentCompletions: () => null,
		},
	);

	pi.on("turn_end", (event: TurnEndEvent, ctx: any) => {
		if (!event.message) return;
		const { thinking, text, toolCalls } = extractFromMessage(event);
		if (!thinking && !text && toolCalls.length === 0) return;

		turnWindow.push({
			turnIndex: event.turnIndex,
			thinkingText: thinking,
			textContent: text,
			toolCalls,
		});
		while (turnWindow.length > config.windowSize) turnWindow.shift();

		const findings = runDetectors(turnWindow);
		if (findings.length === 0) {
			consecutiveDetections = 0;
			return;
		}

		if (consecutiveDetections === 0) {
			const summary = findings.map((f) => `- ${f.type}: ${f.message}`).join("\n");
			const text = [
				"**Loop detected**",
				"",
				summary,
				"",
				"It looks like you are in a loop. Stop repeating the same approach.",
				"Summarize your current state, close any open work, and complete your session properly.",
			].join("\n");
			pi.sendMessage(buildSteerMessage(text, "loop-detector-warning"), { deliverAs: "steer" });
			consecutiveDetections = 1;
			turnWindow = [];
			return;
		}

		if (consecutiveDetections + 1 >= config.escalateAfter) {
			const text = [
				"**Loop persists**",
				"",
				"The loop continued after the previous warning. This run is being force-stopped.",
				"Stop all activity now and close/complete your session.",
			].join("\n");
			pi.sendMessage(buildSteerMessage(text, "loop-detector-force-stop"), { deliverAs: "steer" });
			ctx.abort();
			consecutiveDetections = 0;
			return;
		}

		consecutiveDetections += 1;
		turnWindow = [];
	});
}
