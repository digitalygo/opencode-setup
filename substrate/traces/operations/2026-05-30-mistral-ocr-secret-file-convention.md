---
status: completed
created_at: 2026-05-30
files_edited:
  - skills/mistral-ocr-pdf-to-md/SKILL.md
rationale:
  - align mistral-ocr-pdf-to-md secret handling with the repository's established secret-file convention under ~/.config/opencode/.secrets/
  - remove dependency on shell-exported MISTRAL_API_KEY from ~/.bashrc
  - match the pattern already used by replicate-png-generation and replicate-svg-generation skills
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - skills/replicate-png-generation/SKILL.md
  - skills/replicate-svg-generation/SKILL.md
  - opencode.jsonc
  - README.md
  - setup.sh
  - substrate/traces/reviews/2026-05-20-wiki-ocr-security.md
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
