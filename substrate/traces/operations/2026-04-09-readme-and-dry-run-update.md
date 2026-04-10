---
status: completed
created_at: 2026-04-09
files_edited:
  - README.md
  - setup.sh
  - thoughts/shared/status/2026-04-09-readme-dry-run-preexisting-changes.md
  - thoughts/shared/operations/2026-04-09-readme-and-dry-run-update.md
rationale:
  - align public documentation with the actual repository contents and setup flow
  - add a safe preview mode to the installer without changing normal setup behavior
supporting_docs:
  - .github/CONTRIBUTING.md
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
