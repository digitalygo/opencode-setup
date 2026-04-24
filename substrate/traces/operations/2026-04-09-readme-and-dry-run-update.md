---
status: completed
created_at: 2026-04-09
updated_at: 2026-04-24
files_edited:
  - README.md
  - setup.sh
  - thoughts/shared/status/2026-04-09-readme-dry-run-preexisting-changes.md
  - thoughts/shared/operations/2026-04-09-readme-and-dry-run-update.md
  - substrate/traces/operations/2026-04-09-readme-and-dry-run-update.md
rationale:
  - align public documentation with the actual repository contents and setup flow
  - add a safe preview mode to the installer without changing normal setup behavior
  - allow setup previews and installs from non-release branches used for agent work
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - thoughts/shared/research/2026-04-09-repository-improvement-opportunities.md
---

# README and dry-run update

## Summary of changes

- Updated `README.md` to match the real repository state, simplify quick start, remove inaccurate references, and document the new `--dry-run` capability.
- Extended `setup.sh` with `--dry-run` and `--help`, while preserving the existing user change that maps channels to clone branches.
- Recorded the pre-existing uncommitted workspace changes before starting this task.

## Technical reasoning

- The README is a product surface for this repository, so it must describe only files and behaviors that actually exist.
- A dry-run mode is a low-risk way to improve installer trust because it exposes target paths, clone branch selection, rsync behavior, and alias handling without modifying the system.
- Preserving the prior uncommitted branch-selection logic in `setup.sh` avoids overwriting user work while layering the new preview mode on top.

## Impact assessment

- Users can now preview setup actions safely before applying them.
- The README now better separates runtime-synced files from repository-internal files and avoids stale structural references.
- No release or sync behavior changed outside the requested dry-run and help additions.

## Validation steps

- Verified the modified file contents directly in `README.md` and `setup.sh`.
- Checked shell syntax with `bash -n setup.sh`.
- Exercised preview mode with `bash ./setup.sh --dry-run --channel alpha`.
- Synced markdownlint configuration and verified Markdown with `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix` followed by a zero-error lint run.

## Update on 2026-04-24

### Summary of changes

- Relaxed `setup.sh` channel parsing so `--channel` can receive arbitrary branch names such as `async`.
- Kept the existing `stable` to `main` mapping and the direct `beta` and `alpha` branch mappings.
- Updated `--help` text to describe channel or branch-name usage.

### Technical reasoning

- Agent development now needs temporary installation branches outside release channels.
- The existing clone flow already resolves `branch="$CHANNEL"`, so removing the whitelist is the smallest compatible change.
- Keeping alias behavior unchanged avoids widening scope beyond branch acceptance.

### Impact assessment

- Contributors can test branches such as `async` through `bash setup.sh --channel async --dry-run` or normal setup execution.
- Release-channel behavior remains compatible for `stable`, `beta`, and `alpha`.
- Invalid or missing remote branches fail at `git clone`, matching Git behavior.

### Validation steps

- Read and inspected `setup.sh`, `AGENTS.md`, `.github/CONTRIBUTING.md`, and `.gitignore`.
- Verified no pre-existing tracked workspace changes before implementation.
- Checked syntax with `bash -n setup.sh`.
- Exercised dry-run behavior for `async`, `main`, `stable`, `beta`, and `alpha`.
- Verified help output with `bash setup.sh --help`.
- Ran ShellCheck with `docker run --rm -v "$PWD/setup.sh:/mnt/setup.sh:ro" koalaman/shellcheck:stable /mnt/setup.sh`.
