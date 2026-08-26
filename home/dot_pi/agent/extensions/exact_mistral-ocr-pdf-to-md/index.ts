import { lstat, readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));
const HELPER_PATH = join(EXTENSION_DIR, "ocr.py");
const DEFAULT_KEY_FILE = join(homedir(), "Documents", ".secrets", "mistral-key");
const MAX_BYTES = 50_000_000;
const EXECUTION_TIMEOUT_MS = 10 * 60 * 1000;

const UPLOAD_SUPPORTED_SUFFIXES = new Set([
	".pdf",
	".docx",
	".pptx",
	".xlsx",
	".odt",
	".ott",
	".png",
	".jpg",
	".bmp",
	".gif",
	".tif",
	".csv",
	".txt",
	".abap",
	".ada",
	".ahk",
	".as",
	".asciidoc",
	".asm",
	".bat",
	".cpp",
	".r",
]);

const BASE64_FALLBACK_SUFFIXES = new Set([".doc", ".ppt", ".rtf", ".html"]);
const ALL_SUPPORTED_SUFFIXES = new Set([...UPLOAD_SUPPORTED_SUFFIXES, ...BASE64_FALLBACK_SUFFIXES]);
const SUPPORTED_SUFFIXES_TEXT = [...ALL_SUPPORTED_SUFFIXES].sort().join(", ");

const OcrParams = Type.Object({
	input_path: Type.String({
		description:
			"Path to a supported local document or image. Relative paths are resolved from the current working directory.",
	}),
});

interface HelperResponse {
	ok: boolean;
	error?: string;
	error_type?: string;
	input_path?: string;
	output_path?: string;
	pages?: number;
	characters?: number;
	output_bytes?: number;
	model?: string;
	transport?: "upload" | "base64_fallback";
}

function normalizeInputPath(rawPath: string, cwd: string): string {
	let value = rawPath.trim();
	if (value.startsWith("@")) value = value.slice(1);
	if (!value) throw new Error("input_path must not be empty.");
	if (value === "~") return homedir();
	if (value.startsWith("~/")) return resolve(homedir(), value.slice(2));
	return resolve(cwd, value);
}

function getKeyFilePath(): string {
	const configured = process.env.MISTRAL_API_KEY_FILE?.trim();
	if (!configured) return DEFAULT_KEY_FILE;
	if (configured === "~") return homedir();
	if (configured.startsWith("~/")) return resolve(homedir(), configured.slice(2));
	return resolve(configured);
}

async function validateKeyFile(): Promise<string> {
	const keyFile = getKeyFilePath();
	let metadata;
	try {
		metadata = await lstat(keyFile);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(`Missing Mistral API key file: ${keyFile}`);
		}
		throw new Error(`Cannot inspect Mistral API key file ${keyFile}: ${error instanceof Error ? error.message : String(error)}`);
	}

	if (metadata.isSymbolicLink()) throw new Error(`Mistral API key file must not be a symlink: ${keyFile}`);
	if (!metadata.isFile()) throw new Error(`Mistral API key path is not a regular file: ${keyFile}`);
	if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
		throw new Error(
			`Mistral API key file permissions are too open (${(metadata.mode & 0o777).toString(8)}). Run: chmod 600 ${keyFile}`,
		);
	}

	const key = (await readFile(keyFile, "utf8")).trim();
	if (!key) throw new Error(`Mistral API key file is empty: ${keyFile}`);
	return keyFile;
}

async function validateInput(rawPath: string, cwd: string): Promise<{
	inputPath: string;
	outputPath: string;
	extension: string;
	fileSize: number;
}> {
	const candidatePath = normalizeInputPath(rawPath, cwd);
	let metadata;
	try {
		metadata = await lstat(candidatePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(`Input file does not exist: ${candidatePath}`);
		}
		throw new Error(`Cannot inspect input file ${candidatePath}: ${error instanceof Error ? error.message : String(error)}`);
	}

	if (metadata.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${candidatePath}`);
	if (!metadata.isFile()) throw new Error(`Input path is not a regular file: ${candidatePath}`);
	if (metadata.size === 0) throw new Error(`Input file is empty: ${candidatePath}`);
	if (metadata.size > MAX_BYTES) {
		throw new Error(`Input file exceeds the ${MAX_BYTES / 1_000_000} MB limit: ${candidatePath} (${metadata.size} bytes)`);
	}

	const inputPath = await realpath(candidatePath);
	const extension = extname(inputPath).toLowerCase();
	if (!ALL_SUPPORTED_SUFFIXES.has(extension)) {
		throw new Error(`Unsupported file type ${extension || "(none)"}. Supported suffixes: ${SUPPORTED_SUFFIXES_TEXT}`);
	}

	const outputPath = join(dirname(inputPath), `${basename(inputPath, extname(inputPath))}.md`);
	return { inputPath, outputPath, extension, fileSize: metadata.size };
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

function parseHelperResponse(stdout: string): HelperResponse | undefined {
	const lines = stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	for (let index = lines.length - 1; index >= 0; index--) {
		try {
			const parsed = JSON.parse(lines[index]) as unknown;
			if (parsed !== null && typeof parsed === "object") return parsed as HelperResponse;
		} catch {
			// Ignore non-JSON progress output and continue searching backwards.
		}
	}
	return undefined;
}

function tail(value: string, maxCharacters = 4000): string {
	const trimmed = value.trim();
	return trimmed.length <= maxCharacters ? trimmed : `…${trimmed.slice(-maxCharacters)}`;
}

export default function mistralOcrExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "mistral_ocr_pdf_to_md",
		label: "Mistral OCR to Markdown",
		description:
			"Fallback to Mistral OCR when the local anydoc or pdf-inspector parsers are unavailable or insufficient (standalone images or scanned PDFs). Convert a supported local document or image to Markdown with Mistral OCR. The source is uploaded to Mistral, remains unchanged locally, and the resulting .md file is written beside it using the same base name. Existing output is replaced atomically. Maximum input size: 50 MB. Supported suffixes: " +
			SUPPORTED_SUFFIXES_TEXT,
		promptSnippet: "Convert local documents and images into Markdown using Mistral OCR",
		promptGuidelines: [
			"Use mistral_ocr_pdf_to_md when the user asks to OCR or convert a supported local document or image into Markdown.",
			"Prefer the local, open-source Firecrawl parsers first for document-to-Markdown conversion: anydoc (Office, RTF, EPUB, CSV, text-based PDF) and pdf-inspector/pdf2md (text-based PDF) run 100% locally with no API key and skip OCR for text-based pages.",
			"Use mistral_ocr_pdf_to_md as the fallback for standalone images (.png, .jpg, .bmp, .gif, .tif) and scanned or image-only PDFs that need actual OCR.",
			"mistral_ocr_pdf_to_md uploads the input file to Mistral and may incur API charges; use it only when requested and avoid duplicate conversions.",
		],
		parameters: OcrParams,
		executionMode: "sequential",
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			await validateKeyFile();
			const input = await validateInput(params.input_path, ctx.cwd);

			onUpdate?.({
				content: [{ type: "text", text: `Running Mistral OCR on ${input.inputPath}…` }],
				details: { inputPath: input.inputPath, outputPath: input.outputPath },
			});

			return withFileMutationQueue(input.outputPath, async () => {
				await rejectUnsafeExistingOutput(input.outputPath);
				const result = await pi.exec("python3", [HELPER_PATH, input.inputPath], {
					cwd: ctx.cwd,
					signal,
					timeout: EXECUTION_TIMEOUT_MS,
				});
				const helper = parseHelperResponse(result.stdout);

				if (signal?.aborted) throw new Error("Mistral OCR conversion cancelled.");
				if (result.killed) throw new Error("Mistral OCR process was terminated or timed out.");
				if (result.code !== 0 || !helper?.ok) {
					const reason = helper?.error || tail(result.stderr) || tail(result.stdout) || `exit code ${result.code}`;
					throw new Error(`Mistral OCR failed: ${reason}`);
				}
				if (!helper.output_path) throw new Error("Mistral OCR helper did not report an output path.");

				const summary = [
					`Markdown saved to ${helper.output_path}`,
					helper.pages !== undefined ? `Pages: ${helper.pages}` : undefined,
					helper.characters !== undefined ? `Characters: ${helper.characters}` : undefined,
					helper.transport ? `Transport: ${helper.transport}` : undefined,
				]
					.filter((value): value is string => Boolean(value))
					.join("\n");

				return {
					content: [{ type: "text", text: summary }],
					details: {
						inputPath: helper.input_path ?? input.inputPath,
						outputPath: helper.output_path,
						inputBytes: input.fileSize,
						outputBytes: helper.output_bytes,
						pages: helper.pages,
						characters: helper.characters,
						model: helper.model,
						transport: helper.transport,
					},
				};
			});
		},
	});

	pi.registerCommand("mistral-ocr", {
		description: "Check Mistral OCR extension configuration",
		handler: async (_args, ctx) => {
			try {
				const keyFile = await validateKeyFile();
				const python = await pi.exec("python3", ["--version"], { timeout: 5000 });
				if (python.code !== 0) throw new Error(tail(python.stderr) || "python3 is unavailable");
				ctx.ui.notify(
					`Mistral OCR is configured. Key: ${keyFile}. ${tail(python.stdout || python.stderr)}. Tool: mistral_ocr_pdf_to_md.`,
					"info",
				);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
			}
		},
	});
}
