---
name: mistral-ocr-pdf-to-md
description: Convert a local document or image file to a Markdown file using Mistral OCR. Supports PDF, Office, OpenDocument, images, and text/code formats. Use when you need to extract text from a file into a clean Markdown file.
---

# Mistral OCR to Markdown

## What you do with this skill

- take a local file and extract all readable text via Mistral OCR
- produce a clean `.md` file with the extracted content, page by page
- keep the original file unchanged
- use token from `~/.config/opencode/.secrets/mistral-key`

## When to use

Use this skill when you need to convert a supported document or image into Markdown.

## Input schema

Required:

- `input_path` (string) — path to the local file. Default: `docs/inbox/example.pdf`. Change this to point to your file.

No other inputs.

## Output schema

- Type: `string`
- Format: `file`
- A `.md` file is written to the same directory as the resolved input file, using the same base filename with `.md` suffix. For example, `docs/inbox/example.pdf` produces `docs/inbox/example.md`.

## Supported file formats

These suffixes were verified with live Mistral OCR tests on 2026-06-14. The skill rejects any suffix not listed below.

**Upload and signed URL OCR** (uploaded to Mistral before processing):

`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.odt`, `.ott`, `.png`, `.jpg`, `.bmp`, `.gif`, `.tif`, `.csv`, `.txt`, `.abap`, `.ada`, `.ahk`, `.as`, `.asciidoc`, `.asm`, `.bat`, `.cpp`, `.R`

**Base64 document URL OCR** (sent directly as a base64-encoded data URI; Mistral's upload endpoint rejects these formats):

`.doc`, `.ppt`, `.rtf`, `.html`

**Key caveat**: Mistral's file upload endpoint is stricter than its OCR processing engine. These four suffixes are rejected by the upload endpoint but succeed when the file is sent as a base64-encoded data URI in the `document_url` field. This skill routes base64-only suffixes directly to the base64 path without attempting upload first.

**Deliberately excluded**: `.xls`, `.ods`, `.ots`, `.xml`, Word 2003 XML, `.svg`, `.eps`, `.psd`, `.psb`, `.pcx`, `.pbm`, `.tga`, `.dbf`, `.dcm`, `.sav`, `.slk`, `.spv`, `.stc`, `.stw`, `.sxc`, `.sxw`, `.uos`, `.uot`, `.pdb`, `.RData`, `.raw`, and any other format not listed above.

## Direct Python workflow

The snippet below is self-sufficient: if `mistralai` is not importable, the script installs a pinned version into a per-user cache directory under `~/.cache/opencode/mistralai_vendor` (compatible with externally managed Python environments via `pip --target`). Before uploading, the script validates the local file: it rejects any path component that is a symlink, resolves the path strictly, checks the extension against the supported set, requires a regular file, and enforces a maximum file size. Validation is suffix-based only — the script does not inspect file signatures or content before Mistral receives the bytes. You only need to set `input_path`.

```python
import base64
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

vendor_dir = os.path.expanduser("~/.cache/opencode/mistralai_vendor")
if vendor_dir not in sys.path:
    sys.path.insert(0, vendor_dir)

try:
    from mistralai.client import Mistral
except ModuleNotFoundError:
    os.makedirs(vendor_dir, exist_ok=True)
    os.chmod(vendor_dir, stat.S_IRWXU)
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--target", vendor_dir, "mistralai==2.4.5"]
    )
    import importlib
    importlib.invalidate_caches()
    from mistralai.client import Mistral

MAX_BYTES = 50_000_000

UPLOAD_SUPPORTED_SUFFIXES = frozenset({
    ".pdf", ".docx", ".pptx", ".xlsx", ".odt", ".ott",
    ".png", ".jpg", ".bmp", ".gif", ".tif",
    ".csv", ".txt",
    ".abap", ".ada", ".ahk", ".as", ".asciidoc", ".asm", ".bat", ".cpp", ".r",
})

BASE64_SUFFIXES = frozenset({".doc", ".ppt", ".rtf", ".html"})

ALL_SUPPORTED_SUFFIXES = UPLOAD_SUPPORTED_SUFFIXES | BASE64_SUFFIXES

MIME_FOR_BASE64 = {
    ".doc": "application/msword",
    ".ppt": "application/vnd.ms-powerpoint",
    ".rtf": "application/rtf",
    ".html": "text/html",
}

_SENSITIVE_RE = re.compile(
    r'Received:[^\n]*?data:[^\n]*'
    r'|data:\S*?;base64,[^\s]*'
    r'|https?://[^\s]*signed[^\s]*'
    r'|[?&](?:token|key|secret|auth|signature|sig)=[^\s&]+',
    re.IGNORECASE,
)

def _sanitize_error(message: str) -> str:
    return _SENSITIVE_RE.sub("[redacted]", message)

input_path = Path("docs/inbox/example.pdf")

check_path = Path()
for part in input_path.parts:
    check_path = check_path / part
    if check_path.is_symlink():
        raise PermissionError(f"Symlinks not allowed: {check_path}")

resolved_path = input_path.resolve(strict=True)

ext = resolved_path.suffix.lower()
if ext not in ALL_SUPPORTED_SUFFIXES:
    raise ValueError(
        f"Unsupported file type: {ext}. "
        f"Supported suffixes: {sorted(ALL_SUPPORTED_SUFFIXES)}"
    )

if not resolved_path.is_file():
    raise ValueError(f"Not a regular file: {resolved_path}")

file_size = resolved_path.stat().st_size
if file_size == 0:
    raise ValueError(f"File is empty: {resolved_path}")
if file_size > MAX_BYTES:
    raise ValueError(
        f"File exceeds {MAX_BYTES // 1_000_000} MB limit: "
        f"{resolved_path} ({file_size} bytes)"
    )

output_path = resolved_path.with_suffix(".md")

secrets_path = Path.home() / ".config" / "opencode" / ".secrets" / "mistral-key"
if not secrets_path.is_file():
    raise FileNotFoundError(f"Missing Mistral token at {secrets_path}")
api_key = secrets_path.read_text(encoding="utf-8").strip()
if not api_key:
    raise ValueError(f"Mistral token at {secrets_path} is empty")

file_bytes = resolved_path.read_bytes()

with Mistral(api_key=api_key) as client:
    if ext in BASE64_SUFFIXES:
        mime_type = MIME_FOR_BASE64[ext]
        document_b64 = base64.b64encode(file_bytes).decode("utf-8")
        try:
            ocr_response = client.ocr.process(
                model="mistral-ocr-latest",
                document={
                    "type": "document_url",
                    "document_url": f"data:{mime_type};base64,{document_b64}",
                },
            )
        except Exception as e:
            raise RuntimeError(_sanitize_error(str(e))) from None
    else:
        uploaded_file = client.files.upload(
            file={
                "file_name": resolved_path.name,
                "content": file_bytes,
            },
            purpose="ocr",
        )
        try:
            signed_url = client.files.get_signed_url(file_id=uploaded_file.id)
            try:
                ocr_response = client.ocr.process(
                    model="mistral-ocr-latest",
                    document={
                        "type": "document_url",
                        "document_url": signed_url.url,
                    },
                )
            except Exception as e:
                raise RuntimeError(_sanitize_error(str(e))) from None
        finally:
            client.files.delete(file_id=uploaded_file.id)

    pages_markdown = [page.markdown for page in ocr_response.pages if page.markdown]
    output_path.write_text("\n\n".join(pages_markdown) + "\n", encoding="utf-8")

    print(f"Markdown saved to {output_path}")
```

## Error handling

- `FileNotFoundError` for `~/.config/opencode/.secrets/mistral-key` — the token file is missing. Create it with your Mistral API key as its sole content. `ValueError` — the token file exists but is empty. Populate it with a valid key.
- `FileNotFoundError` — `input_path` does not exist or cannot be resolved. Adjust `input_path` to point to a real file.
- `PermissionError` — a component of the path (file or parent directory) is a symlink. Symlinks are rejected to prevent traversal. Use a direct path with no symlinked components instead.
- `ValueError` — the file fails validation: unsupported suffix (not in the verified lists), not a regular file, empty, or exceeds the 50 MB size limit. Check the `Supported file formats` section for accepted suffixes.
- `pip` failures during auto-install — the environment may lack network access or `pip`. Run `python3 -m pip install --target ~/.cache/opencode/mistralai_vendor mistralai==2.4.5` manually, then retry.
- `403` / `401` from Mistral — the API key is invalid or has no quota. Check your Mistral account.
- `RuntimeError` from OCR processing — the Mistral OCR API call failed. The error message is sanitized to remove base64 payloads, signed URLs, and credential query parameters. The underlying cause may be an unsupported or malformed file, a transient API error, or a quota issue.
- Empty `ocr_response.pages` — the file may contain no extractable text, or Mistral could not process it.

## References

- [Mistral Basic OCR](https://docs.mistral.ai/studio-api/document-processing/basic_ocr)
- [OCR endpoint reference](https://docs.mistral.ai/api/endpoint/ocr)
- [Local PDF upload cookbook](https://docs.mistral.ai/cookbooks/third_party-gradio-mistralocr)
