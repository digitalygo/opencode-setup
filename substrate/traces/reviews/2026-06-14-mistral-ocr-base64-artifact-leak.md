---
status: completed
created_at: 2026-06-14
updated_at: 2026-06-15
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

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- M1 base64 and signed URL data leak (medium): reopened — the moved skill removed `_sanitize_error`, now raises upload-route exceptions unchanged for non-fallback suffixes and raises base64 fallback exceptions unchanged for `.doc`, `.ppt`, `.rtf`, and `.html` (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:147-167`).
- L1 file validation overclaim / symlink-component handling (low): reopened — the moved skill only checks whether the final `input_path` is a symlink, follows symlinked parent components through `resolve(strict=True)`, and writes output through `input_path.with_suffix(".md")` (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:99-123`).

### New findings

No new independent findings. The chezmoi migration reintroduced the prior OCR issues in the moved runtime path.

#### Medium: M1 reopened: OCR exceptions can leak signed URLs and base64 document bytes

- **Location**: `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:45`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:147-167`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:181-187`
- **Evidence**: `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:45` documents automatic upload-first then base64 fallback behavior. The code obtains a signed URL and passes it to OCR (`:147-155`). On any non-fallback exception it re-raises the original exception unchanged (`:156-158`). For fallback suffixes it builds a full `data:<mime>;base64,...` document URL from file bytes and passes it to OCR without a sanitizing wrapper (`:160-167`). Error docs no longer promise sanitized `RuntimeError`; they only say base64 failure indicates unprocessable content (`:181-187`).
- **Impact**: Failed OCR calls can expose Mistral signed URLs or full base64 document bytes into terminal output, tool logs, chat, traces, or generated review artifacts. This crosses from intended third-party OCR processing into durable local and conversational logs.
- **False-positive notes**: No raw API key was observed. Leakage depends on SDK/API exception text including request material, which prior live compatibility artifacts already proved for this API class. No network, OCR execution, scanner, Docker, or active test was run in this follow-up.
- **Remediation**: Restore `_sanitize_error` or equivalent wrapping for both upload and base64 OCR paths. Redact `data:*;base64,*`, signed URLs, query strings, and credential-like parameters before surfacing errors. Prefer direct base64 routing for base64-only suffixes to avoid unnecessary upload attempts.

#### Low: L1 reopened: symlinked parents can steer input and output paths

- **Location**: `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:51`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:99-123`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:181-184`
- **Evidence**: The docs say validation resolves the path strictly and rejects symlinks (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:51`), but the code checks only `input_path.is_symlink()` (`:99-100`) before resolving (`:102`). It then writes output to `input_path.with_suffix(".md")` (`:123`) rather than the resolved path. Error docs say the resolved path is a symlink (`:181-183`), but symlinked parent directories are still followed.
- **Impact**: A user-supplied path through a symlinked parent can upload bytes from outside the expected directory and write Markdown through the symlinked path. This weakens traversal defenses and can place generated content somewhere the caller did not intend.
- **False-positive notes**: The user normally chooses `input_path`, and final-file symlinks are still rejected. Risk is mainly shared workspaces, automated queues, or untrusted file drops where path components may be attacker-controlled. No active symlink test was run.
- **Remediation**: Restore component-by-component symlink rejection before `resolve(strict=True)`. Write output to `resolved_path.with_suffix(".md")`. Update docs to distinguish suffix validation from content validation and final-file symlink checks from component checks.

### New validation notes

After remediation, force failing upload and base64 OCR paths and scan terminal/tool output for `data:`, `;base64,`, signed URLs, and credential-like query parameters. Test parent-directory symlinks and final-file symlinks; confirm both reject before upload and output writes use the resolved path.

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- M1 base64 and signed URL data leak (medium): resolved — `_sanitize_error` redacts `data:*;base64,*`, URLs, and bearer tokens (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:62-73`). Base64-only suffixes go straight to sanitized base64 OCR without upload (`:159-173`). Upload, signed URL, and upload-route OCR errors are also wrapped before surfacing (`:176-201`).
- L1 symlink-component handling and output-path regression (low): resolved — the snippet rejects symlinks at each path component before resolution (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:114-119`), still rejects final-file symlinks (`:121-124`), writes output via `resolved_path.with_suffix(".md")` (`:145`), and documents suffix-only validation plus component symlink rejection (`:51`, `:219-220`).

### New findings

No new findings in this thread. Residual suffix-only file validation is documented behavior, not an overclaim, at `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:51` and `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:220`.

### New validation notes

Future verification should force failing upload and base64 OCR paths, then scan output for `data:`, `;base64,`, Mistral signed URLs, and credential-like parameters. Also retest parent-directory and final-file symlinks. No Docker, scanner, network, OCR/API execution, or active symlink test was run in this follow-up.

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- M1 base64 and signed URL data leak (medium): unresolved — the intended sanitizer is present, but the helper body uses invalid Python syntax at `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:73` (`return RuntimeError(msg) from None`). As written, the snippet fails before OCR and does not leak document bytes, but the security control is not a runnable remediation. If fixed by only removing `from None`, `raise _sanitize_error(exc)` at `:173`, `:185`, `:190`, and `:201` would chain the original SDK exception and can still print unsanitized signed URLs or base64 data.
- L1 symlink-component handling and output-path regression (low): resolved — path components are checked for symlinks before strict resolution (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:114-124`), and output writes use `resolved_path.with_suffix(".md")` (`:145`).

### New findings

No new independent findings. The prior M1 sanitization thread remains open until the sanitizer is syntactically valid and exception context is suppressed at each raise site.

#### Medium: M1 still open: sanitizer control is not runnable and safe context suppression is misplaced

- **Location**: `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:62-73`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:172-173`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:184-185`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:189-190`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:200-201`
- **Evidence**: `_sanitize_error` builds a redacted message, then attempts `return RuntimeError(msg) from None` (`:62-73`). `from None` belongs on `raise`, not `return`. The exception handlers then call `raise _sanitize_error(exc)` without `from None` (`:172-173`, `:184-185`, `:189-190`, `:200-201`).
- **Impact**: Current snippet fails closed before network/OCR, so it does not leak signed URLs or base64 bytes as written. The remediation is still incomplete: a likely syntax fix that returns `RuntimeError(msg)` without changing the raise sites would preserve Python's implicit exception context and can print the original unsanitized SDK exception above the sanitized RuntimeError.
- **False-positive notes**: No OCR/API execution, syntax test, network, Docker, scanner, or active exploit was run. This is source review of the Markdown snippet. The leak path depends on a future syntax correction that does not also suppress exception context, but the current committed remediation is not runnable and cannot be considered verified.
- **Remediation**: Change the helper to `return RuntimeError(msg)`. Change every handler to `raise _sanitize_error(exc) from None`, or make the helper raise the sanitized exception directly and never expose the original exception context. Then force failing upload and base64 OCR paths and scan output for `data:`, `;base64,`, signed URLs, query strings, and bearer tokens.

### New validation notes

Before closing M1, parse or execute the snippet in a disposable environment, then force one upload failure and one base64 OCR failure. Confirm only sanitized `RuntimeError` text is printed and no chained original SDK exception appears.

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- M1 base64 and signed URL data leak (medium): resolved — `_sanitize_error` now returns a valid `RuntimeError` (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:62-73`), redacts base64 data URIs, URLs, and bearer tokens (`:66-73`), and every upload/OCR exception handler raises the sanitized error with `from None` (`:172-173`, `:184-185`, `:189-190`, `:200-201`). Base64-only suffixes still bypass upload and signed URL generation (`:159-173`).
- L1 symlink-component handling and output-path regression (low): resolved — path components and the final file are checked for symlinks before strict resolution (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:114-124`), output uses `resolved_path.with_suffix(".md")` (`:145`), and suffix-only validation is documented (`:51`, `:220`).

### New findings

No new findings. Residual suffix-only content validation is documented behavior, not an undisclosed validation control, at `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:51` and `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:220`.

### New validation notes

Future verification should parse the snippet, then force one upload failure and one base64 OCR failure. Confirm output contains only sanitized `RuntimeError` text and no `data:`, `;base64,`, signed URL, query-string credential, bearer token, or chained original SDK exception. No Docker, scanner, network, OCR/API execution, or active symlink test was run in this follow-up.
