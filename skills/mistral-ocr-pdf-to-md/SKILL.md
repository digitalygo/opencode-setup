---
name: mistral-ocr-pdf-to-md
description: Convert a local PDF file to a Markdown file using Mistral OCR. Use when you need to extract text from a PDF into a clean Markdown file.
---

# Mistral OCR PDF to Markdown

## What you do with this skill

- take a local `.pdf` file and extract all readable text via Mistral OCR
- produce a clean `.md` file with the extracted content, page by page
- keep the original PDF unchanged
- use `MISTRAL_API_KEY` already exported from `~/.bashrc`

## When to use

Use this skill when you need to convert a PDF into Markdown.

## Input schema

Required:

- `pdf_path` (string) — path to the local PDF file. Default: `docs/inbox/example.pdf`. Change this to point to your PDF.

No other inputs.

## Output schema

- Type: `string`
- Format: `file`
- A `.md` file is written to the same directory as the input PDF, using the same base filename with `.md` suffix. For example, `docs/inbox/example.pdf` produces `docs/inbox/example.md`.

## Direct Python workflow

The snippet below is self-sufficient: if `mistralai` is not importable, the script installs a pinned version into a per-user cache directory under `~/.cache/opencode/mistralai_vendor` (compatible with externally managed Python environments via `pip --target`). Before uploading, the script validates the local file: it resolves the path strictly, rejects symlinks, requires a `.pdf` suffix and a regular file, checks the PDF magic header, and enforces a maximum file size. You only need to set `pdf_path`.

```python
import os
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

MAX_PDF_BYTES = 50_000_000

pdf_path = Path("docs/inbox/example.pdf")

if pdf_path.is_symlink():
    raise PermissionError(f"Symlinks are not allowed: {pdf_path}")

resolved_path = pdf_path.resolve(strict=True)

if resolved_path.suffix.lower() != ".pdf":
    raise ValueError(f"File must have a .pdf suffix: {resolved_path}")

if not resolved_path.is_file():
    raise ValueError(f"Not a regular file: {resolved_path}")

file_size = resolved_path.stat().st_size
if file_size == 0:
    raise ValueError(f"File is empty: {resolved_path}")
if file_size > MAX_PDF_BYTES:
    raise ValueError(f"File exceeds {MAX_PDF_BYTES // 1_000_000} MB limit: {resolved_path} ({file_size} bytes)")

with resolved_path.open("rb") as f:
    header = f.read(5)
if header != b"%PDF-":
    raise ValueError(f"Not a valid PDF (missing %%PDF- header): {resolved_path}")

output_path = pdf_path.with_suffix(".md")

api_key = os.environ["MISTRAL_API_KEY"]

with Mistral(api_key=api_key) as client:
    uploaded_pdf = client.files.upload(
        file={
            "file_name": pdf_path.name,
            "content": resolved_path.read_bytes(),
        },
        purpose="ocr",
    )

    try:
        signed_url = client.files.get_signed_url(file_id=uploaded_pdf.id)

        ocr_response = client.ocr.process(
            model="mistral-ocr-latest",
            document={
                "type": "document_url",
                "document_url": signed_url.url,
            },
        )

        pages_markdown = [page.markdown for page in ocr_response.pages if page.markdown]
        output_path.write_text("\n\n".join(pages_markdown) + "\n", encoding="utf-8")

        print(f"Markdown saved to {output_path}")

    finally:
        client.files.delete(file_id=uploaded_pdf.id)
```

## Error handling

- `KeyError: 'MISTRAL_API_KEY'` — the environment variable is not set. Verify `~/.bashrc` exports it and that the shell session has sourced it.
- `FileNotFoundError` — `pdf_path` does not exist or cannot be resolved. Adjust `pdf_path` to point to a real PDF.
- `PermissionError` — the resolved path is a symlink. Symlinks are rejected to prevent traversal. Use the direct path to the real file instead.
- `ValueError` — the file fails validation: missing `.pdf` suffix, not a regular file, empty, exceeds the 50 MB size limit, or lacks the `%PDF-` magic header. Check that the path points to a valid, reasonably-sized PDF.
- `pip` failures during auto-install — the environment may lack network access or `pip`. Run `python -m pip install --target ~/.cache/opencode/mistralai_vendor mistralai==2.4.5` manually, then retry.
- `403` / `401` from Mistral — the API key is invalid or has no quota. Check your Mistral account.
- Empty `ocr_response.pages` — the PDF may contain no extractable text, or Mistral could not process it.

## References

- [Mistral Basic OCR](https://docs.mistral.ai/studio-api/document-processing/basic_ocr)
- [OCR endpoint reference](https://docs.mistral.ai/api/endpoint/ocr)
- [Local PDF upload cookbook](https://docs.mistral.ai/cookbooks/third_party-gradio-mistralocr)
