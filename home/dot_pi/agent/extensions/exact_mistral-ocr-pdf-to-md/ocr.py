#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import importlib
import json
import os
import stat
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

SDK_VERSION = "2.4.5"
MODEL = "mistral-ocr-latest"
MAX_BYTES = 50_000_000
DEFAULT_VENDOR_DIR = Path.home() / ".cache" / "opencode" / "mistralai_vendor"
DEFAULT_KEY_FILE = Path.home() / "Documents" / ".secrets" / "mistral-key"

UPLOAD_SUPPORTED_SUFFIXES = frozenset(
    {
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
    }
)
BASE64_FALLBACK_SUFFIXES = frozenset({".doc", ".ppt", ".rtf", ".html"})
ALL_SUPPORTED_SUFFIXES = UPLOAD_SUPPORTED_SUFFIXES | BASE64_FALLBACK_SUFFIXES
MIME_FOR_BASE64 = {
    ".doc": "application/msword",
    ".ppt": "application/vnd.ms-powerpoint",
    ".rtf": "application/rtf",
    ".html": "text/html",
}


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), flush=True)


def expand_configured_path(env_name: str, default: Path) -> Path:
    configured = os.environ.get(env_name, "").strip()
    return Path(configured).expanduser() if configured else default


def validate_input(raw_path: str) -> tuple[Path, Path, str, int]:
    candidate = Path(raw_path).expanduser()
    if candidate.is_symlink():
        raise PermissionError(f"Symlinks are not allowed: {candidate}")

    resolved = candidate.resolve(strict=True)
    if not resolved.is_file():
        raise ValueError(f"Not a regular file: {resolved}")

    extension = resolved.suffix.lower()
    if extension not in ALL_SUPPORTED_SUFFIXES:
        supported = ", ".join(sorted(ALL_SUPPORTED_SUFFIXES))
        raise ValueError(f"Unsupported file type: {extension or '(none)'}. Supported suffixes: {supported}")

    file_size = resolved.stat().st_size
    if file_size == 0:
        raise ValueError(f"File is empty: {resolved}")
    if file_size > MAX_BYTES:
        raise ValueError(f"File exceeds {MAX_BYTES // 1_000_000} MB limit: {resolved} ({file_size} bytes)")

    output = resolved.with_suffix(".md")
    if output.is_symlink():
        raise PermissionError(f"Refusing to replace symlink output: {output}")
    if output.exists() and not output.is_file():
        raise ValueError(f"Output path exists and is not a regular file: {output}")

    return resolved, output, extension, file_size


def read_api_key() -> tuple[str, Path]:
    key_file = expand_configured_path("MISTRAL_API_KEY_FILE", DEFAULT_KEY_FILE)
    if key_file.is_symlink():
        raise PermissionError(f"Mistral API key file must not be a symlink: {key_file}")
    if not key_file.is_file():
        raise FileNotFoundError(f"Missing Mistral API key file: {key_file}")

    mode = stat.S_IMODE(key_file.stat().st_mode)
    if os.name != "nt" and mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise PermissionError(
            f"Mistral API key file permissions are too open ({mode:o}). Run: chmod 600 {key_file}"
        )

    api_key = key_file.read_text(encoding="utf-8").strip()
    if not api_key:
        raise ValueError(f"Mistral API key file is empty: {key_file}")
    return api_key, key_file


def load_mistral_class():
    vendor_dir = expand_configured_path("MISTRAL_OCR_VENDOR_DIR", DEFAULT_VENDOR_DIR)
    vendor_path = str(vendor_dir)
    if vendor_path not in sys.path:
        sys.path.insert(0, vendor_path)

    try:
        from mistralai.client import Mistral

        return Mistral
    except ModuleNotFoundError:
        vendor_dir.mkdir(parents=True, exist_ok=True)
        if os.name != "nt":
            vendor_dir.chmod(stat.S_IRWXU)
        subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-warn-script-location",
                "--target",
                vendor_path,
                f"mistralai=={SDK_VERSION}",
            ],
            check=True,
            stdout=sys.stderr,
            stderr=sys.stderr,
        )
        importlib.invalidate_caches()
        from mistralai.client import Mistral

        return Mistral


def write_markdown_atomically(output_path: Path, markdown: str) -> int:
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=output_path.parent,
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_name = temporary.name
            temporary.write(markdown)
            temporary.flush()
            os.fsync(temporary.fileno())

        os.replace(temporary_name, output_path)
        temporary_name = None
        return output_path.stat().st_size
    finally:
        if temporary_name is not None:
            try:
                Path(temporary_name).unlink(missing_ok=True)
            except OSError:
                pass


def run_ocr(input_path: Path, output_path: Path, extension: str, api_key: str) -> dict[str, Any]:
    Mistral = load_mistral_class()
    file_bytes = input_path.read_bytes()
    uploaded_file = None
    transport = "upload"

    with Mistral(api_key=api_key) as client:
        try:
            try:
                uploaded_file = client.files.upload(
                    file={"file_name": input_path.name, "content": file_bytes},
                    purpose="ocr",
                )
                signed_url = client.files.get_signed_url(file_id=uploaded_file.id)
                ocr_response = client.ocr.process(
                    model=MODEL,
                    document={"type": "document_url", "document_url": signed_url.url},
                )
            except Exception:
                if extension not in BASE64_FALLBACK_SUFFIXES:
                    raise

                transport = "base64_fallback"
                mime_type = MIME_FOR_BASE64.get(extension, "application/octet-stream")
                document_b64 = base64.b64encode(file_bytes).decode("ascii")
                ocr_response = client.ocr.process(
                    model=MODEL,
                    document={
                        "type": "document_url",
                        "document_url": f"data:{mime_type};base64,{document_b64}",
                    },
                )
        finally:
            if uploaded_file is not None:
                client.files.delete(file_id=uploaded_file.id)

    pages_markdown = [page.markdown for page in ocr_response.pages if page.markdown]
    if not pages_markdown:
        raise ValueError("Mistral OCR returned no pages containing extractable Markdown")

    markdown = "\n\n".join(pages_markdown).rstrip() + "\n"
    output_bytes = write_markdown_atomically(output_path, markdown)
    return {
        "ok": True,
        "input_path": str(input_path),
        "output_path": str(output_path),
        "pages": len(pages_markdown),
        "characters": len(markdown),
        "output_bytes": output_bytes,
        "model": MODEL,
        "transport": transport,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert a local document or image to Markdown with Mistral OCR")
    parser.add_argument("input_path")
    parser.add_argument("--validate-only", action="store_true", help="Validate the input without calling Mistral")
    args = parser.parse_args()

    api_key = ""
    try:
        input_path, output_path, extension, file_size = validate_input(args.input_path)
        if args.validate_only:
            emit(
                {
                    "ok": True,
                    "input_path": str(input_path),
                    "output_path": str(output_path),
                    "input_bytes": file_size,
                    "extension": extension,
                    "validated_only": True,
                }
            )
            return 0

        api_key, _key_file = read_api_key()
        emit(run_ocr(input_path, output_path, extension, api_key))
        return 0
    except Exception as error:
        message = str(error)
        if api_key:
            message = message.replace(api_key, "[REDACTED]")
        emit({"ok": False, "error_type": type(error).__name__, "error": message})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
