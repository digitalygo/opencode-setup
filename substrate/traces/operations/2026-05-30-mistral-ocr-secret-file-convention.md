---
status: completed
created_at: 2026-05-30
updated_at: 2026-06-14
files_edited:
  - skills/mistral-ocr-pdf-to-md/SKILL.md
rationale:
  - align mistral-ocr-pdf-to-md secret handling with the repository's established secret-file convention under ~/.config/opencode/.secrets/
  - remove dependency on shell-exported MISTRAL_API_KEY from ~/.bashrc
  - match the pattern already used by replicate-png-generation and replicate-svg-generation skills
  - broaden skill from PDF-only workflow to multi-format OCR supporting upload+signed URL and direct base64 paths
  - harden security by sanitizing OCR errors, suppressing exception chaining, rejecting symlinked path components, routing base64-only suffixes directly, and documenting suffix-only validation
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - skills/replicate-png-generation/SKILL.md
  - skills/replicate-svg-generation/SKILL.md
  - opencode.jsonc
  - README.md
  - setup.sh
  - substrate/traces/reviews/2026-05-20-wiki-ocr-security.md
  - substrate/traces/reviews/2026-06-14-mistral-ocr-base64-artifact-leak.md
---

# Summary of changes

Updated `skills/mistral-ocr-pdf-to-md/SKILL.md` to read the Mistral API token from `~/.config/opencode/.secrets/mistral-key` instead of the `MISTRAL_API_KEY` environment variable exported from `~/.bashrc`. The Python snippet now reads the file, strips whitespace, and raises `FileNotFoundError` when the file is missing or `ValueError` when it is empty. The error handling section was updated to document these new failure modes.

# Technical reasoning

The replicate-png-generation and replicate-svg-generation skills already use the secret-file convention (`~/.config/opencode/.secrets/replicate-key`), and the repository's `setup.sh` and `README.md` document `.secrets/` as a preserved local directory across syncs. The mistral-ocr-pdf-to-md skill was the outlier — it relied on `MISTRAL_API_KEY` sourced from `~/.bashrc`, which requires the user to export the variable in their shell startup file and keep it in process environment memory.

The secret-file approach is safer and more consistent: it keeps the token on disk in a known, preserved path that survives OpenCode setup syncs, avoids leaking the key into subprocess environments unnecessarily, and matches the pattern established by the repository's other API-powered skills.

The updated Python snippet validates the file before use — checking existence with `is_file()`, reading as text, stripping trailing whitespace/newlines, and failing with a clear error message that points to the exact path. The previous `os.environ["MISTRAL_API_KEY"]` raised a generic `KeyError` with no pointer to the file the user needed to create.

# Impact assessment

- The mistral-ocr-pdf-to-md skill no longer depends on a shell-exported environment variable. Users must create `~/.config/opencode/.secrets/mistral-key` with their Mistral API key as the sole file content.
- No other non-trace repository files were changed. No downstream agents or skills reference `MISTRAL_API_KEY` in their prompts.
- The change does not affect the replicate skills, which already use the `~/.config/opencode/.secrets/` convention with their own key file.
- A security-review-specialist review was performed. No new vulnerabilities were found and no new review trace file was written. The prior medium finding about runtime `pip install` supply-chain risk remains unchanged and out of scope for this change. The key source change does not introduce new vulnerabilities: the file is read from a user-owned path under `~/.config/opencode/.secrets/`, the same directory already used by other skills, and the snippet validates the file exists and is non-empty before use.

# Validation steps

- Read `skills/mistral-ocr-pdf-to-md/SKILL.md` in full and confirmed the key source changed from `os.environ["MISTRAL_API_KEY"]` to `Path.home() / ".config" / "opencode" / ".secrets" / "mistral-key"` with existence and emptiness guards.
- Read `skills/replicate-png-generation/SKILL.md` and `skills/replicate-svg-generation/SKILL.md` and confirmed they use the same `~/.config/opencode/.secrets/` convention with their respective key files.
- Read `README.md` and confirmed `.secrets/` is documented as a preserved local directory.
- Ran `git status --short` at implementation-verification time (before this operation record was written) and confirmed only `skills/mistral-ocr-pdf-to-md/SKILL.md` was the intended non-trace change.
- Reviewed scoped `git diff` for the skill file and confirmed three change zones: the description bullet, the Python snippet key-reading logic, and the error handling entry.
- Synced markdownlint configuration and ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`, then reran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot` with zero errors.
- Submitted the change for a `security-review-specialist` review. Result: no new vulnerabilities found. The prior M1 finding (runtime `pip install` supply-chain risk) remains out of scope for this change, and no new review file was written.
- Confirmed no `substrate/directives/` or `substrate/expectations/` files exist in this repository during the session.

# Update: 2026-06-14

## Summary of new work

Broadened the skill from PDF-only wording to a multi-format OCR workflow and hardened security across the Python snippet. The skill name and folder (`skills/mistral-ocr-pdf-to-md/`) were kept unchanged for compatibility. The skill now supports two OCR paths: upload and signed URL for most formats, and direct base64 document URL for `.doc`, `.ppt`, `.rtf`, and `.html`. Security hardening added OCR error sanitization, exception chain suppression with `from None`, symlinked path component rejection, and explicit documentation that local validation is suffix-based only. Temporary `/tmp/opencode/mistral-ocr-compat-*` and verification artifacts were deleted.

## Technical reasoning

The prior skill was described as PDF-only, but Mistral OCR supports a much wider set of formats. Live testing against Mistral's API on 2026-06-14 confirmed which suffixes succeed via upload+signed URL (22 formats including PDF, Office Open XML, OpenDocument, images, CSV, TXT, and text/code formats) and which require base64 direct routing (`.doc`, `.ppt`, `.rtf`, `.html` — these are rejected by Mistral's file upload endpoint but accepted as base64 data URIs in the `document_url` field). Several formats were deliberately excluded because they failed upload, base64, or both paths (e.g., `.xls`, `.ods`, `.svg`, `.eps`, `.psd`).

The security review identified a medium issue where base64 payload and signed URL data could leak through unsanitized OCR exceptions into terminal output, chat logs, and traces. This was resolved by adding a `_sanitize_error` function that redacts base64 payloads, signed URLs, and credential query parameters from error messages, combined with `from None` exception chaining to suppress the original traceback. The review also identified that symlink traversal and overclaimed validation were risks: parent symlink components were still followed by `resolve(strict=True)`. This was resolved by walking each path component and rejecting any symlink before resolution, and by documenting explicitly that validation is suffix-based with no content sniffing.

## Impact assessment

- `skills/mistral-ocr-pdf-to-md/SKILL.md` remains the only non-trace repository file modified.
- The skill now handles 26 verified suffixes across two routing paths, with explicit documentation of which formats use which path.
- Security posture improved: OCR error messages are sanitized, exception details are not leaked via `from None`, symlink traversal is blocked at component level, and suffix-only validation is accurately documented.
- The `markdownlint` check passed with zero errors.
- The final security review (`substrate/traces/reviews/2026-06-14-mistral-ocr-base64-artifact-leak.md`) found no current findings; all prior medium and low issues were resolved.
- No `substrate/directives/` or `substrate/expectations/` files exist in this repository.

## Validation steps

- Verified the skill's `description` frontmatter was broadened from PDF-only to multi-format wording.
- Confirmed the skill name and folder were kept unchanged.
- Verified the Python snippet now contains two OCR paths (upload+signed URL and base64 direct), `_sanitize_error`, `from None`, component-level symlink rejection, and documented suffix-only validation.
- Confirmed the supported suffixes section lists 22 upload-compatible and 4 base64-only formats with explicit excluded formats.
- Verified temporary `/tmp/opencode/mistral-ocr-compat-*` artifacts and verification files were deleted.
- Read `substrate/traces/reviews/2026-06-14-mistral-ocr-base64-artifact-leak.md` in full and confirmed no current findings.
- Synced markdownlint configuration and verified zero errors on the updated operation record.
