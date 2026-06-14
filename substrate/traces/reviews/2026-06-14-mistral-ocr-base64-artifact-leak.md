---
status: completed
created_at: 2026-06-14
updated_at: 2026-06-14
reviewer: security-review-specialist
target: skills/mistral-ocr-pdf-to-md/SKILL.md and live Mistral OCR compatibility artifacts
scope: current session diff for OCR format broadening, base64 fallback behavior, secret handling, validation, cleanup, and generated verification artifacts under /tmp/opencode/mistral-ocr-compat-*
supporting_docs:
  - skills/mistral-ocr-pdf-to-md/SKILL.md
  - substrate/traces/operations/2026-05-30-mistral-ocr-secret-file-convention.md
  - substrate/traces/reviews/2026-05-20-wiki-ocr-security.md
  - /tmp/opencode/mistral-ocr-compat-report.md
  - /tmp/opencode/mistral-ocr-compat-test.py
  - /tmp/opencode/mistral-ocr-compat-results/results.json
  - /tmp/opencode/mistral-ocr-compat-results/results.jsonl
---

# Summary

Found 1 medium and 1 low finding. The new base64 fallback works, but failed OCR paths can echo document bytes and signed URLs into logs and temp artifacts. The broadened validator also overclaims safety: it now accepts by suffix only and still rejects only the final symlink component.

# Scope and methodology

Reviewed `git status --short`, scoped `git diff`, the full updated OCR skill, the operation trace, the prior OCR security review, and live compatibility artifacts under `/tmp/opencode/mistral-ocr-compat-*`. Checked trust boundaries, third-party upload behavior, secret exposure, error logging, artifact cleanup, input validation, symlink/path handling, output writes, and generated Markdown risk. No Docker, scanner, network, OCR execution, pip install, or active tests run during this review.

# Findings by severity

## Medium

### M1: base64 and signed URL data can leak through OCR errors and temp artifacts

- **Location**: `skills/mistral-ocr-pdf-to-md/SKILL.md:160-167`, `/tmp/opencode/mistral-ocr-compat-test.py:68`, `/tmp/opencode/mistral-ocr-compat-test.py:82`, `/tmp/opencode/mistral-ocr-compat-test.py:98`, `/tmp/opencode/mistral-ocr-compat-test.py:119`, `/tmp/opencode/mistral-ocr-compat-results/results.json:391`, `/tmp/opencode/mistral-ocr-compat-results/results.json:472`, `/tmp/opencode/mistral-ocr-compat-results/results.jsonl:21`, `/tmp/opencode/mistral-ocr-compat-results/results.jsonl:25`
- **Evidence**: `skills/mistral-ocr-pdf-to-md/SKILL.md:160-167` base64-encodes full file bytes and sends them as a `data:<mime>;base64,...` `document_url`. The skill does not sanitize SDK exceptions from this base64 OCR call before they can reach terminal, chat, tool output, or traces. The compatibility harness stores raw `str(e)[:500]` from upload, signed URL OCR, base64 document OCR, and base64 image OCR errors (`/tmp/opencode/mistral-ocr-compat-test.py:68`, `:82`, `:98`, `:119`). The generated results prove the API echoes sensitive request material: `/tmp/opencode/mistral-ocr-compat-results/results.json:391` contains an error with `Received: data:<mime>;base64,...`, and `/tmp/opencode/mistral-ocr-compat-results/results.json:472` contains a Mistral signed file URL. The JSONL copy repeats the same classes at lines 21 and 25. A sanitized scan found 23 data URI references and 6 signed URL references in each raw results file.
- **Impact**: Sensitive document bytes can move from intended third-party OCR processing into local temp files, tool output, chat logs, traces, or later reports when base64 fallback fails on malformed `.doc`, `.ppt`, `.rtf`, or `.html` content. Signed URLs are bearer-style access links while valid; deletion and expiry reduce exposure, but artifacts can persist and be copied. `/tmp/opencode` artifacts remained after verification, so cleanup is incomplete.
- **False-positive notes**: No raw Mistral API key or authorization header was observed in the reviewed artifacts. The current test corpus appears non-secret, and uploaded files were deleted by the harness when deletion succeeded. Risk remains for future sensitive files and any failed base64 OCR path, because exception text can include request data before local redaction.
- **Remediation**: Wrap the base64 OCR call and re-raise sanitized errors that remove `data:*;base64,*`, signed URLs, request bodies, and query strings. Do not persist raw `str(e)` in compatibility scripts; store status code, error type, and a redacted summary only. Delete `/tmp/opencode/mistral-ocr-compat-*` raw result files after review, or regenerate them under a `0700` temporary directory with automatic cleanup. Skip upload-first for known base64-only suffixes unless needed, to avoid generating signed URLs for fallback formats.

## Low

### L1: file validation overclaims safety after format broadening

- **Location**: `skills/mistral-ocr-pdf-to-md/SKILL.md:51`, `skills/mistral-ocr-pdf-to-md/SKILL.md:99-109`, `skills/mistral-ocr-pdf-to-md/SKILL.md:111-123`, `skills/mistral-ocr-pdf-to-md/SKILL.md:160-167`, `skills/mistral-ocr-pdf-to-md/SKILL.md:183`, `substrate/traces/operations/2026-05-30-mistral-ocr-secret-file-convention.md:69`
- **Evidence**: The documentation says the script validates the local file and rejects symlinks (`skills/mistral-ocr-pdf-to-md/SKILL.md:51`) and the operation trace says validation was strengthened (`substrate/traces/operations/2026-05-30-mistral-ocr-secret-file-convention.md:69`). Current code only checks whether the final `input_path` itself is a symlink (`skills/mistral-ocr-pdf-to-md/SKILL.md:99-102`), then accepts files by suffix only (`skills/mistral-ocr-pdf-to-md/SKILL.md:104-109`) plus regular-file and size checks (`skills/mistral-ocr-pdf-to-md/SKILL.md:111-121`). For fallback suffixes, it chooses MIME type from extension and sends base64 bytes directly (`skills/mistral-ocr-pdf-to-md/SKILL.md:160-167`). The error text also says the resolved path is a symlink (`skills/mistral-ocr-pdf-to-md/SKILL.md:183`), but parent symlink components are still followed by `resolve(strict=True)`.
- **Impact**: Renamed files or files reached through symlinked parent directories can be uploaded despite not matching the intended format or location. The upload endpoint may reject some mismatches, but the bytes still cross the local-to-Mistral trust boundary; the base64 fallback bypasses upload MIME validation entirely. Output is written to `input_path.with_suffix(".md")`, so a symlinked parent can also steer the generated Markdown location.
- **False-positive notes**: The user normally chooses `input_path`, and current `agent/wiki.md` still auto-processes only `.pdf` files. Mistral's upload endpoint gives an extra MIME gate for upload-supported formats. Risk is lower for deliberate one-off conversions, higher for automated queues, shared workspaces, or untrusted file drops.
- **Remediation**: Add content sniffing for supported families before any network call: PDF magic, OLE CFB for `.doc` and `.ppt`, RTF prefix, safe text/HTML checks, ZIP container checks for OOXML and ODF, and image magic. Reject symlink components or confine `resolved_path` under an approved workspace root. Use a resolved, verified output path, or document that only the final symlink is rejected and no workspace confinement exists.

# Remediation timeline

1. **Medium**: Sanitize base64 and signed URL errors, then delete or regenerate compatibility artifacts with redaction and `0700` permissions.
2. **Low**: Add content and symlink-component validation, or narrow documentation so it matches suffix-only behavior.

# Validation notes

After remediation, force a malformed `.doc`, `.ppt`, `.rtf`, and `.html` through the base64 path and confirm no exception, trace, result JSON, or tool output contains `data:*;base64,*`, signed URLs, raw query strings, or document bytes. Re-run validation with a parent-directory symlink and a renamed wrong-type file; confirm the script rejects them before any Mistral network call.

## Update: 2026-06-14 by security-review-specialist

### Prior finding status

- M1 base64 and signed URL data leak (medium): resolved — base64-only suffixes now bypass upload and go directly to the sanitized base64 path (`skills/mistral-ocr-pdf-to-md/SKILL.md:150-162`), OCR exceptions are sanitized by `_sanitize_error` (`skills/mistral-ocr-pdf-to-md/SKILL.md:98-107`) and re-raised with `from None` (`skills/mistral-ocr-pdf-to-md/SKILL.md:161-162`, `skills/mistral-ocr-pdf-to-md/SKILL.md:181-182`). Upload-route OCR errors are also wrapped before surfacing (`skills/mistral-ocr-pdf-to-md/SKILL.md:173-182`). A `/tmp/opencode` artifact check during this review found zero `mistral-ocr-compat-*` or `verify_ocr_*` files.
- L1 file validation overclaim (low): partially resolved — symlinked path components are rejected before resolution (`skills/mistral-ocr-pdf-to-md/SKILL.md:111-117`), output is written next to the resolved input file (`skills/mistral-ocr-pdf-to-md/SKILL.md:138`), and documentation now states component symlink rejection (`skills/mistral-ocr-pdf-to-md/SKILL.md:51`, `skills/mistral-ocr-pdf-to-md/SKILL.md:196`). Remaining low risk: file type validation is still suffix-only (`skills/mistral-ocr-pdf-to-md/SKILL.md:119-124`) before bytes are read and sent to Mistral (`skills/mistral-ocr-pdf-to-md/SKILL.md:147`, `skills/mistral-ocr-pdf-to-md/SKILL.md:150-159`, `skills/mistral-ocr-pdf-to-md/SKILL.md:164-180`).

### New findings

No new independent findings.

#### Low: L1 residual: suffix-only content validation remains

- **Location**: `skills/mistral-ocr-pdf-to-md/SKILL.md:119-124`, `skills/mistral-ocr-pdf-to-md/SKILL.md:147`, `skills/mistral-ocr-pdf-to-md/SKILL.md:150-159`, `skills/mistral-ocr-pdf-to-md/SKILL.md:164-180`, `skills/mistral-ocr-pdf-to-md/SKILL.md:197`
- **Evidence**: The only format check is `resolved_path.suffix.lower()` membership in `ALL_SUPPORTED_SUFFIXES` (`skills/mistral-ocr-pdf-to-md/SKILL.md:119-124`). The file bytes are then read (`skills/mistral-ocr-pdf-to-md/SKILL.md:147`) and sent either as base64 for `.doc`, `.ppt`, `.rtf`, and `.html` (`skills/mistral-ocr-pdf-to-md/SKILL.md:150-159`) or uploaded for other supported suffixes (`skills/mistral-ocr-pdf-to-md/SKILL.md:164-180`). Error docs list unsupported suffix, regular-file, empty-file, and size checks only (`skills/mistral-ocr-pdf-to-md/SKILL.md:197`).
- **Impact**: A renamed or mislabeled file can cross the local-to-Mistral boundary before local content-type validation rejects it. This is mainly a safety and consent precision issue, not a path traversal issue now that symlink components and resolved output are fixed.
- **False-positive notes**: This skill is normally invoked on a user-selected file, and Mistral still performs server-side validation. Current docs describe suffix-based support more accurately than before. Risk remains for automated queues or untrusted file drops where suffix alone is treated as approval for external OCR.
- **Remediation**: Add lightweight local content sniffing before `read_bytes()`: PDF magic, OLE CFB for `.doc` and `.ppt`, RTF prefix, ZIP container checks for OOXML/ODF, common image magic, and bounded text/HTML validation. If suffix-only validation is intentional, document that content is not locally verified and that suffix approval controls Mistral upload.

### New validation notes

Re-test M1 by forcing failures on both base64 and upload OCR paths and scanning terminal/tool output for `data:`, `;base64,`, Mistral file URLs, signed URL query parameters, and raw document chunks. Re-test L1 with parent symlinks, final-file symlinks, a resolved output path check, and wrong-content files renamed to accepted suffixes.

## Update: 2026-06-14 by security-review-specialist

### Prior finding status

- L1 residual suffix-only content validation (low): resolved — the skill now explicitly states that validation is suffix-based only and that file signatures or content are not inspected before Mistral receives the bytes (`skills/mistral-ocr-pdf-to-md/SKILL.md:51`). The error handling section also accurately limits validation failures to unsupported suffix, non-regular file, empty file, and size limit (`skills/mistral-ocr-pdf-to-md/SKILL.md:197`). This resolves the overclaim. Suffix-only routing is now documented behavior, not an undisclosed validation gap.

### New findings

No current findings.

### New validation notes

If future edits reintroduce claims of content validation, re-check the implementation for local magic/signature checks before bytes are sent to Mistral.
