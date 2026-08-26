import { randomUUID } from "node:crypto";
import { lstat, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const REPLICATE_API_BASE_URL = "https://api.replicate.com/v1";
const IMAGE_MODEL = "openai/gpt-image-2";
const SVG_MODEL = "recraft-ai/recraft-v4-svg";
const DEFAULT_KEY_FILE = join(homedir(), "Documents", ".secrets", "replicate-key");
const PREDICTION_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_RASTER_BYTES = 100 * 1024 * 1024;
const MAX_SVG_BYTES = 10 * 1024 * 1024;

const ImageParams = Type.Object({
	prompt: Type.String({ description: "Image description or editing instruction.", minLength: 1, maxLength: 32_000 }),
	aspect_ratio: Type.Optional(
		StringEnum(
			[
				"1:1",
				"3:2",
				"2:3",
				"4:3",
				"3:4",
				"16:9",
				"9:16",
				"auto",
				"1024x1024",
				"1536x1024",
				"1024x1536",
				"1536x1152",
				"1152x1536",
				"2048x2048",
				"2048x1152",
				"1152x2048",
				"3840x2160",
				"2160x3840",
			] as const,
			{ description: "Output aspect ratio or dimensions. Defaults to 1:1.", default: "1:1" },
		),
	),
	input_images: Type.Optional(
		Type.Array(Type.String({ description: "HTTPS image URL used for editing or composition." }), {
			description: "Optional source image URLs for editing or composition.",
			minItems: 1,
			maxItems: 16,
		}),
	),
	quality: Type.Optional(
		StringEnum(["low", "medium", "high", "auto"] as const, {
			description: "Generation quality. Defaults to high.",
			default: "high",
		}),
	),
	number_of_images: Type.Optional(
		Type.Integer({ description: "Number of images. Defaults to 1.", minimum: 1, maximum: 10 }),
	),
	background: Type.Optional(
		StringEnum(["auto", "opaque"] as const, {
			description: "Background handling. Defaults to auto.",
			default: "auto",
		}),
	),
	transparent_background: Type.Optional(
		Type.Boolean({
			description:
				"Request best-effort transparency. Forces PNG and appends a transparent-cutout instruction; downloaded PNGs are checked for alpha.",
		}),
	),
	output_compression: Type.Optional(
		Type.Integer({
			description: "Compression from 0 to 100 for JPEG/WebP. Defaults to 0; ignored for PNG.",
			minimum: 0,
			maximum: 100,
		}),
	),
	output_format: Type.Optional(
		StringEnum(["png", "jpeg", "webp"] as const, {
			description: "Local and remote output format. Defaults to PNG.",
			default: "png",
		}),
	),
	moderation: Type.Optional(
		StringEnum(["auto", "low"] as const, {
			description: "Moderation level. Defaults to low.",
			default: "low",
		}),
	),
	user_id: Type.Optional(Type.String({ description: "Optional end-user identifier passed to OpenAI." })),
	output_path: Type.Optional(
		Type.String({
			description:
				"Optional local output path. The extension must match output_format. For multiple images, -1, -2, etc. are added before the extension.",
		}),
	),
});

const SvgParams = Type.Object({
	prompt: Type.String({ description: "Description of the vector image to generate.", minLength: 1, maxLength: 32_000 }),
	aspect_ratio: Type.Optional(
		StringEnum(
			["Not set", "1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16", "1:2", "2:1", "14:10", "10:14", "4:5", "5:4", "6:10"] as const,
			{ description: "Aspect ratio. Defaults to 1:1. Use 'Not set' to use size instead.", default: "1:1" },
		),
	),
	size: Type.Optional(
		StringEnum(
			[
				"1024x1024",
				"1536x768",
				"768x1536",
				"1280x832",
				"832x1280",
				"1216x896",
				"896x1216",
				"1152x896",
				"896x1152",
				"832x1344",
				"1280x896",
				"896x1280",
				"1344x768",
				"768x1344",
			] as const,
			{ description: "Output dimensions; used only when aspect_ratio is 'Not set'. Defaults to 1024x1024." },
		),
	),
	output_path: Type.Optional(
		Type.String({ description: "Optional local .svg output path. A unique filename in the working directory is used by default." }),
	),
});

type JsonRecord = Record<string, unknown>;
type PredictionStatus = "starting" | "processing" | "succeeded" | "failed" | "canceled" | "aborted";

interface Prediction {
	id?: string;
	status?: PredictionStatus;
	output?: unknown;
	error?: unknown;
	urls?: {
		get?: string;
		cancel?: string;
	};
}

interface SavedFile {
	path: string;
	bytes: number;
	alpha?: boolean;
}

function asRecord(value: unknown): JsonRecord | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as JsonRecord)
		: undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeUserPath(rawPath: string, cwd: string): string {
	let value = rawPath.trim();
	if (value.startsWith("@")) value = value.slice(1);
	if (!value) throw new Error("output_path must not be empty.");
	if (value === "~") return homedir();
	if (value.startsWith("~/")) return resolve(homedir(), value.slice(2));
	return resolve(cwd, value);
}

function getKeyFilePath(): string {
	const configured = process.env.REPLICATE_API_KEY_FILE?.trim();
	if (!configured) return DEFAULT_KEY_FILE;
	if (configured === "~") return homedir();
	if (configured.startsWith("~/")) return resolve(homedir(), configured.slice(2));
	return resolve(configured);
}

async function readReplicateToken(): Promise<{ token: string; keyFile: string }> {
	const keyFile = getKeyFilePath();
	let metadata;
	try {
		metadata = await lstat(keyFile);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(`Missing Replicate API key file: ${keyFile}`);
		}
		throw new Error(`Cannot inspect Replicate API key file ${keyFile}: ${error instanceof Error ? error.message : String(error)}`);
	}

	if (metadata.isSymbolicLink()) throw new Error(`Replicate API key file must not be a symlink: ${keyFile}`);
	if (!metadata.isFile()) throw new Error(`Replicate API key path is not a regular file: ${keyFile}`);
	if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
		throw new Error(
			`Replicate API key file permissions are too open (${(metadata.mode & 0o777).toString(8)}). Run: chmod 600 ${keyFile}`,
		);
	}

	const token = (await readFile(keyFile, "utf8")).trim();
	if (!token) throw new Error(`Replicate API key file is empty: ${keyFile}`);
	return { token, keyFile };
}

function combineSignal(signal: AbortSignal | undefined, timeoutMs: number): {
	signal: AbortSignal;
	timedOut: () => boolean;
} {
	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	return {
		signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
		timedOut: () => timeoutSignal.aborted,
	};
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	signal: AbortSignal | undefined,
	timeoutMs: number,
): Promise<Response> {
	const combined = combineSignal(signal, timeoutMs);
	try {
		return await fetch(url, { ...init, signal: combined.signal });
	} catch (error) {
		if (signal?.aborted) throw new Error("Replicate request cancelled.");
		if (combined.timedOut()) throw new Error(`Replicate request timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`);
		throw new Error(`Could not reach Replicate: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function errorMessageFromPayload(payload: unknown): string | undefined {
	if (typeof payload === "string") return payload.trim() || undefined;
	const record = asRecord(payload);
	if (!record) return undefined;
	const value = record.error ?? record.detail ?? record.message;
	if (typeof value === "string") return value;
	if (value !== undefined) return JSON.stringify(value);
	return undefined;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return {};
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

async function replicateJsonRequest(
	url: string,
	init: RequestInit,
	token: string,
	signal: AbortSignal | undefined,
	timeoutMs: number,
): Promise<JsonRecord> {
	const response = await fetchWithTimeout(
		url,
		{
			...init,
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${token}`,
				...(init.body ? { "Content-Type": "application/json" } : {}),
				...(init.headers ?? {}),
			},
		},
		signal,
		timeoutMs,
	);
	const payload = await parseJsonResponse(response);
	if (!response.ok) {
		const detail = errorMessageFromPayload(payload) ?? response.statusText;
		const hint =
			response.status === 401
				? " Check the Replicate API key."
				: response.status === 402
					? " Check Replicate billing or quota."
					: "";
		throw new Error(`Replicate API returned HTTP ${response.status}: ${detail}.${hint}`);
	}
	const record = asRecord(payload);
	if (!record) throw new Error("Replicate returned an unexpected non-JSON response.");
	return record;
}

function toPrediction(payload: JsonRecord): Prediction {
	const urls = asRecord(payload.urls);
	return {
		id: asNonEmptyString(payload.id),
		status: asNonEmptyString(payload.status) as PredictionStatus | undefined,
		output: payload.output,
		error: payload.error,
		urls: urls
			? {
					get: asNonEmptyString(urls.get),
					cancel: asNonEmptyString(urls.cancel),
				}
			: undefined,
	};
}

async function cancelPrediction(prediction: Prediction, token: string): Promise<void> {
	const cancelUrl = prediction.urls?.cancel;
	if (!cancelUrl) return;
	try {
		await fetchWithTimeout(
			cancelUrl,
			{ method: "POST", headers: { Authorization: `Bearer ${token}` } },
			undefined,
			10_000,
		);
	} catch {
		// Cancellation is best effort.
	}
}

async function createAndWaitForPrediction(
	model: string,
	input: JsonRecord,
	token: string,
	signal?: AbortSignal,
): Promise<Prediction> {
	const [owner, name] = model.split("/");
	const endpoint = `${REPLICATE_API_BASE_URL}/models/${owner}/${name}/predictions`;
	let prediction = toPrediction(
		await replicateJsonRequest(
			endpoint,
			{
				method: "POST",
				headers: { Prefer: "wait=60" },
				body: JSON.stringify({ input }),
			},
			token,
			signal,
			75_000,
		),
	);
	const deadline = Date.now() + PREDICTION_TIMEOUT_MS;

	while (prediction.status === "starting" || prediction.status === "processing" || !prediction.status) {
		if (signal?.aborted) {
			await cancelPrediction(prediction, token);
			throw new Error("Replicate generation cancelled.");
		}
		if (Date.now() >= deadline) {
			await cancelPrediction(prediction, token);
			throw new Error(`Replicate prediction timed out after ${PREDICTION_TIMEOUT_MS / 60_000} minutes.`);
		}
		if (!prediction.urls?.get) {
			throw new Error(`Replicate prediction ${prediction.id ?? "(unknown)"} is still processing but has no polling URL.`);
		}

		try {
			await delay(1500, undefined, signal ? { signal } : undefined);
		} catch {
			await cancelPrediction(prediction, token);
			throw new Error("Replicate generation cancelled.");
		}
		prediction = toPrediction(
			await replicateJsonRequest(prediction.urls.get, { method: "GET" }, token, signal, 20_000),
		);
	}

	if (prediction.status !== "succeeded") {
		const detail = errorMessageFromPayload(prediction.error) ?? String(prediction.error ?? "No error details");
		throw new Error(`Replicate prediction ${prediction.status ?? "failed"}: ${detail}`);
	}
	return prediction;
}

function extractOutputUrls(output: unknown): string[] {
	const rawValues = typeof output === "string" ? [output] : Array.isArray(output) ? output : [];
	const urls = rawValues.map(asNonEmptyString).filter((value): value is string => Boolean(value));
	if (urls.length === 0) throw new Error("Replicate prediction succeeded but returned no output URL.");
	for (const value of urls) {
		let parsed: URL;
		try {
			parsed = new URL(value);
		} catch {
			throw new Error(`Replicate returned an invalid output URL: ${value}`);
		}
		if (parsed.protocol !== "https:") throw new Error(`Replicate output URL must use HTTPS: ${value}`);
	}
	return urls;
}

function validateHttpsInputUrls(urls: string[] | undefined): string[] | undefined {
	if (!urls) return undefined;
	return urls.map((value, index) => {
		let parsed: URL;
		try {
			parsed = new URL(value);
		} catch {
			throw new Error(`input_images[${index}] is not a valid URL: ${value}`);
		}
		if (parsed.protocol !== "https:") throw new Error(`input_images[${index}] must use HTTPS: ${value}`);
		return parsed.toString();
	});
}

async function canonicalizeOutputBase(rawPath: string, cwd: string, extension: string): Promise<string> {
	let candidate = normalizeUserPath(rawPath, cwd);
	const currentExtension = extname(candidate).toLowerCase();
	if (!currentExtension) candidate += extension;
	else if (currentExtension !== extension) {
		throw new Error(`output_path must end with ${extension}, received: ${candidate}`);
	}

	const parentCandidate = dirname(candidate);
	let parentMetadata;
	try {
		parentMetadata = await lstat(parentCandidate);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(`Output directory does not exist: ${parentCandidate}`);
		}
		throw error;
	}
	if (!parentMetadata.isDirectory()) throw new Error(`Output parent is not a directory: ${parentCandidate}`);
	const parent = await realpath(parentCandidate);
	return join(parent, basename(candidate));
}

function numberedOutputPaths(basePath: string, count: number): string[] {
	if (count === 1) return [basePath];
	const extension = extname(basePath);
	const stem = basename(basePath, extension);
	const parent = dirname(basePath);
	return Array.from({ length: count }, (_, index) => join(parent, `${stem}-${index + 1}${extension}`));
}

async function rejectUnsafeExistingOutput(outputPath: string): Promise<void> {
	try {
		const metadata = await lstat(outputPath);
		if (metadata.isSymbolicLink()) throw new Error(`Refusing to replace symlink output: ${outputPath}`);
		if (!metadata.isFile()) throw new Error(`Output path exists and is not a regular file: ${outputPath}`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
}

async function downloadOutput(url: string, signal: AbortSignal | undefined, maxBytes: number): Promise<Buffer> {
	const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" }, signal, 120_000);
	if (!response.ok) throw new Error(`Failed to download Replicate output: HTTP ${response.status} ${response.statusText}`);
	const contentLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		throw new Error(`Replicate output exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB download limit.`);
	}
	const data = Buffer.from(await response.arrayBuffer());
	if (data.length === 0) throw new Error("Downloaded Replicate output is empty.");
	if (data.length > maxBytes) {
		throw new Error(`Replicate output exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB download limit.`);
	}
	return data;
}

function validateRaster(data: Buffer, format: "png" | "jpeg" | "webp"): { alpha?: boolean } {
	if (format === "png") {
		const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		if (data.length < 29 || !data.subarray(0, 8).equals(signature) || data.toString("ascii", 12, 16) !== "IHDR") {
			throw new Error("Downloaded output is not a valid PNG.");
		}
		const colorType = data[25];
		return { alpha: colorType === 4 || colorType === 6 || data.includes(Buffer.from("tRNS", "ascii")) };
	}
	if (format === "jpeg") {
		if (data.length < 3 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
			throw new Error("Downloaded output is not a valid JPEG.");
		}
		return {};
	}
	if (
		data.length < 12 ||
		data.toString("ascii", 0, 4) !== "RIFF" ||
		data.toString("ascii", 8, 12) !== "WEBP"
	) {
		throw new Error("Downloaded output is not a valid WebP image.");
	}
	return {};
}

function validateSvg(data: Buffer): void {
	const prefix = data.subarray(0, Math.min(data.length, 16_384)).toString("utf8").replace(/^\uFEFF/, "");
	if (!/<svg(?:\s|>)/i.test(prefix)) throw new Error("Downloaded output does not contain an SVG root element.");
}

async function writeAtomically(outputPath: string, data: Buffer): Promise<void> {
	await withFileMutationQueue(outputPath, async () => {
		await rejectUnsafeExistingOutput(outputPath);
		const temporaryPath = join(dirname(outputPath), `.${basename(outputPath)}.${randomUUID()}.tmp`);
		try {
			await writeFile(temporaryPath, data, { mode: 0o600, flag: "wx" });
			await rename(temporaryPath, outputPath);
		} finally {
			await unlink(temporaryPath).catch(() => undefined);
		}
	});
}

async function saveRasterOutputs(
	urls: string[],
	outputPaths: string[],
	format: "png" | "jpeg" | "webp",
	signal?: AbortSignal,
): Promise<SavedFile[]> {
	const saved: SavedFile[] = [];
	for (let index = 0; index < urls.length; index++) {
		const data = await downloadOutput(urls[index], signal, MAX_RASTER_BYTES);
		const validation = validateRaster(data, format);
		await writeAtomically(outputPaths[index], data);
		saved.push({ path: outputPaths[index], bytes: data.length, alpha: validation.alpha });
	}
	return saved;
}

async function saveSvgOutput(url: string, outputPath: string, signal?: AbortSignal): Promise<SavedFile> {
	const data = await downloadOutput(url, signal, MAX_SVG_BYTES);
	validateSvg(data);
	await writeAtomically(outputPath, data);
	return { path: outputPath, bytes: data.length };
}

export default function replicateGenerationExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "replicate_image_generation",
		label: "Replicate Image Generation",
		description:
			"Generate or edit raster images with openai/gpt-image-2 on Replicate. Saves validated PNG, JPEG, or WebP files locally and returns both local paths and Replicate output URLs. Requires ~/Documents/.secrets/replicate-key. Replicate generation is billed.",
		promptSnippet: "Generate or edit raster images with Replicate and save them locally",
		promptGuidelines: [
			"Use replicate_image_generation only when the user requests raster image generation or editing because Replicate calls are billed.",
			"For replicate_image_generation, generate one image unless the user explicitly requests multiple outputs.",
			"For replicate_image_generation transparency requests, set transparent_background=true; only report transparency when transparencyVerified is true.",
		],
		parameters: ImageParams,
		executionMode: "sequential",
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const prompt = params.prompt.trim();
			if (!prompt) throw new Error("prompt must not be empty.");
			const { token } = await readReplicateToken();
			const transparent = params.transparent_background ?? false;
			const format = transparent ? "png" : (params.output_format ?? "png");
			const numberOfImages = params.number_of_images ?? 1;
			const inputImages = validateHttpsInputUrls(params.input_images);
			const effectivePrompt = transparent
				? `${prompt.replace(/[.\s]+$/, "")}. Isolated subject, transparent background, centered cutout, clean edges, PNG asset, no shadow, no environment.`
				: prompt;
			const input: JsonRecord = {
				prompt: effectivePrompt,
				aspect_ratio: params.aspect_ratio ?? "1:1",
				quality: params.quality ?? "high",
				number_of_images: numberOfImages,
				background: params.background ?? "auto",
				output_compression: params.output_compression ?? 0,
				output_format: format,
				moderation: params.moderation ?? "low",
				...(inputImages ? { input_images: inputImages } : {}),
				...(params.user_id?.trim() ? { user_id: params.user_id.trim() } : {}),
			};

			const defaultName = `replicate-image-${Date.now()}-${randomUUID().slice(0, 8)}.${format}`;
			const outputBase = await canonicalizeOutputBase(params.output_path ?? defaultName, ctx.cwd, `.${format}`);
			onUpdate?.({
				content: [{ type: "text", text: `Generating ${numberOfImages} image(s) with ${IMAGE_MODEL}…` }],
				details: { model: IMAGE_MODEL, outputBase },
			});

			const prediction = await createAndWaitForPrediction(IMAGE_MODEL, input, token, signal);
			const urls = extractOutputUrls(prediction.output);
			const outputPaths = numberedOutputPaths(outputBase, urls.length);
			const files = await saveRasterOutputs(urls, outputPaths, format, signal);
			const transparencyVerified = transparent ? files.every((file) => file.alpha === true) : undefined;
			const warning =
				transparent && !transparencyVerified
					? "Warning: transparency was requested, but at least one PNG has no alpha channel. Do not describe it as transparent."
					: undefined;

			const lines = files.flatMap((file, index) => [
				`Image ${index + 1}: ${file.path}`,
				`URL ${index + 1}: ${urls[index]}`,
			]);
			if (warning) lines.push(warning);
			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: {
					model: IMAGE_MODEL,
					predictionId: prediction.id,
					format,
					files,
					urls,
					transparencyRequested: transparent,
					transparencyVerified,
					warning,
				},
			};
		},
	});

	pi.registerTool({
		name: "replicate_svg_generation",
		label: "Replicate SVG Generation",
		description:
			"Generate a vector SVG with recraft-ai/recraft-v4-svg on Replicate. Saves a validated .svg file locally and returns its local path and Replicate output URL. Requires ~/Documents/.secrets/replicate-key. Replicate generation is billed.",
		promptSnippet: "Generate SVG vector images with Replicate and save them locally",
		promptGuidelines: [
			"Use replicate_svg_generation only when the user explicitly requests vector or SVG image generation because Replicate calls are billed.",
			"For replicate_svg_generation, do not set size unless aspect_ratio is 'Not set'.",
		],
		parameters: SvgParams,
		executionMode: "sequential",
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const prompt = params.prompt.trim();
			if (!prompt) throw new Error("prompt must not be empty.");
			const { token } = await readReplicateToken();
			const aspectRatio = params.aspect_ratio ?? "1:1";
			if (aspectRatio !== "Not set" && params.size !== undefined) {
				throw new Error("size must be omitted unless aspect_ratio is 'Not set'.");
			}
			const input: JsonRecord =
				aspectRatio === "Not set"
					? { prompt, size: params.size ?? "1024x1024" }
					: { prompt, aspect_ratio: aspectRatio };
			const defaultName = `replicate-svg-${Date.now()}-${randomUUID().slice(0, 8)}.svg`;
			const outputPath = await canonicalizeOutputBase(params.output_path ?? defaultName, ctx.cwd, ".svg");

			onUpdate?.({
				content: [{ type: "text", text: `Generating SVG with ${SVG_MODEL}…` }],
				details: { model: SVG_MODEL, outputPath },
			});
			const prediction = await createAndWaitForPrediction(SVG_MODEL, input, token, signal);
			const urls = extractOutputUrls(prediction.output);
			const file = await saveSvgOutput(urls[0], outputPath, signal);
			return {
				content: [{ type: "text", text: `SVG saved to ${file.path}\nOutput URL: ${urls[0]}` }],
				details: {
					model: SVG_MODEL,
					predictionId: prediction.id,
					file,
					url: urls[0],
				},
			};
		},
	});

	pi.registerCommand("replicate", {
		description: "Check Replicate generation extension configuration",
		handler: async (_args, ctx) => {
			try {
				const { keyFile } = await readReplicateToken();
				ctx.ui.notify(
					`Replicate is configured via ${keyFile}. Tools: replicate_image_generation, replicate_svg_generation.`,
					"info",
				);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
			}
		},
	});
}
