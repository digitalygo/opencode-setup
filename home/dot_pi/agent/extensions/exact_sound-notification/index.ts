import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExecResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SOUNDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "sounds");

const COMMAND_TIMEOUT_MS = 10_000;

type SoundKind = "done" | "error";

interface SoundPlayer {
	command: string;
	args: string[];
}

const SOUND_PLAYERS: SoundPlayer[] = [
	{ command: "pw-play", args: ["--volume", "0.8"] },
	{ command: "paplay", args: [] },
	{ command: "canberra-gtk-play", args: ["--file"] },
	{ command: "aplay", args: ["-q"] },
	{ command: "afplay", args: [] },
];

export function finalizedSoundKind(messages: AgentMessage[]): SoundKind | null {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message?.role !== "assistant") continue;
		if (message.stopReason === "error") return "error";
		if (
			message.stopReason === "stop" ||
			message.stopReason === "length" ||
			message.stopReason === "toolUse" ||
			message.stopReason === "deferred"
		) {
			return "done";
		}
		return null;
	}
	return null;
}

export function soundPaths(): { done: string; error: string } {
	return { done: join(SOUNDS_DIR, "done.wav"), error: join(SOUNDS_DIR, "error.wav") };
}

export function playerCommand(player: SoundPlayer, path: string): string[] {
	return [...player.args, path];
}

async function isSoundFile(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}

async function runPlayback(
	pi: ExtensionAPI,
	path: string,
	signal: AbortSignal,
): Promise<void> {
	for (const player of SOUND_PLAYERS) {
		if (signal.aborted) return;
		let result: ExecResult;
		try {
			result = await pi.exec(player.command, playerCommand(player, path), {
				signal,
				timeout: COMMAND_TIMEOUT_MS,
			});
		} catch {
			continue;
		}
		if (signal.aborted) return;
		if (result.code === 0 && !result.killed) return;
	}
}

export default function soundNotificationExtension(pi: ExtensionAPI) {
	let activeController: AbortController | null = null;
	let settledSound: SoundKind | null = null;

	function abortPlayback(): void {
		if (activeController) {
			activeController.abort();
			activeController = null;
		}
	}

	async function playSound(kind: SoundKind): Promise<void> {
		abortPlayback();
		const controller = new AbortController();
		activeController = controller;
		const signal = controller.signal;
		const path = soundPaths()[kind === "done" ? "done" : "error"];
		try {
			if (!(await isSoundFile(path))) return;
			await runPlayback(pi, path, signal);
		} finally {
			if (activeController === controller) activeController = null;
		}
	}

	pi.on("session_start", () => {
		settledSound = null;
	});

	pi.on("agent_start", () => {
		settledSound = null;
	});

	pi.on("agent_end", (event) => {
		settledSound = finalizedSoundKind(event.messages);
	});

	pi.on("agent_settled", (_event, ctx) => {
		const kind = settledSound;
		settledSound = null;
		if (ctx.mode !== "tui") return;
		if (kind === "done" || kind === "error") void playSound(kind);
	});

	pi.on("session_shutdown", () => {
		abortPlayback();
		settledSound = null;
	});
}
