import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

function localIso8601(date: Date): string {
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const abs = Math.abs(offsetMinutes);
	const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
}

export default function currentTimeExtension(pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		return {
			systemPrompt: `${event.systemPrompt}\n\nCurrent date and time (ISO 8601): ${localIso8601(new Date())}`,
		};
	});
}
