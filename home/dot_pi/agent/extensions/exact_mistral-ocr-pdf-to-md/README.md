# Mistral OCR to Markdown extension for pi

Prefer the local, open-source Firecrawl parsers first: `anydoc` (Office, RTF, EPUB, CSV, and text-based PDF) and `pdf-inspector` (`pdf2md`, text-based PDF) are MIT-licensed and run 100% locally with no API key, extracting embedded text natively so only scanned pages would need OCR. Use this `mistral_ocr_pdf_to_md` tool as the fallback for standalone images (`.png`, `.jpg`, `.bmp`, `.gif`, `.tif`) and scanned PDFs.

Registers the global tool `mistral_ocr_pdf_to_md`.

The tool converts a supported local document or image with `mistral-ocr-latest`, then writes Markdown beside the source using the same base name. For example:

```text
/path/report.pdf -> /path/report.md
```

The original file is not modified. Existing Markdown output is replaced atomically.

## Configuration

The Mistral API key is read from:

```text
~/Documents/.secrets/mistral-key
```

The file must contain only the key and have permissions `600`:

```bash
chmod 600 ~/Documents/.secrets/mistral-key
```

Set `MISTRAL_API_KEY_FILE` to use another key file. The key is never returned in tool output or passed as a command-line argument.

Run `/mistral-ocr` to check the configuration.

## Python dependency

The helper uses `mistralai==2.4.5`. If unavailable, it installs the pinned package with `pip --target` under:

```text
~/.cache/opencode/mistralai_vendor
```

Set `MISTRAL_OCR_VENDOR_DIR` to override that directory.

## Supported formats

- Documents: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xlsx`, `.odt`, `.ott`, `.rtf`, `.html`
- Images: `.png`, `.jpg`, `.bmp`, `.gif`, `.tif`
- Text/code: `.csv`, `.txt`, `.abap`, `.ada`, `.ahk`, `.as`, `.asciidoc`, `.asm`, `.bat`, `.cpp`, `.R`

Maximum input size: 50 MB.

`.doc`, `.ppt`, `.rtf`, and `.html` automatically fall back to a base64 document URL when Mistral rejects file upload.

## Privacy and billing

Calling the tool uploads the source document to Mistral and may incur API charges. Uploaded temporary files are deleted from Mistral after OCR processing.

Source skill:

```text
/home/luca/Documents/github-digitalygo/dotfiles/home/dot_config/exact_opencode/exact_skills/mistral-ocr-pdf-to-md/SKILL.md
```
