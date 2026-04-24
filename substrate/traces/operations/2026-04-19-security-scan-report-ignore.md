---
status: completed
created_at: 2026-04-19
files_edited:
  - .gitignore
  - agent/security-specialist.md
  - agent/security.md
rationale:
  - keep raw security scan artifacts untracked while preserving tracked review documents
  - align security agent prompts with a single repository-level folder for generated scan outputs
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - agent/security-specialist.md
  - agent/security.md
  - substrate/traces/operations/2026-04-16-security-specialist-pentest-toolbox.md
  - substrate/traces/operations/2026-04-16-security-review-docs-standardization.md
  - substrate/traces/operations/2026-04-16-security-workflow-expansion.md
---

# Summary of changes

- Added `scan-reports/` to `.gitignore` so raw security scan artifacts stay untracked.
- Updated `agent/security-specialist.md` to save raw outputs in `scan-reports/`, keep review docs in `substrate/traces/reviews/`, and use the same path in the Docker output mount example.
- Updated `agent/security.md` with the same raw-output rule, supporting docs reference, and Docker output mount example.

# Technical reasoning

The repository already separates temporary state from tracked documentation through ignored paths like `substrate/traces/status/`. Security scans need the same split: bulky machine-generated outputs should not pollute git history, while human-written review documents should remain tracked under `substrate/traces/reviews/`.

Using one standard folder, `scan-reports/`, removes ambiguity for both the primary `security` agent and `security-specialist`. Adding the ignore rule at repository level prevents accidental tracking when scans write JSON, SARIF, XML, or raw logs.

# Impact assessment

- Future security scans should write raw artifacts into an ignored location by default.
- Review traces remain tracked and separate from generated scanner output.
- Existing tracked `scan-reports/` content in other repositories will still need manual untracking there if it is already committed.

# Validation steps

- Checked repository state with `git status` and reviewed targeted diffs for `.gitignore`, `agent/security-specialist.md`, and `agent/security.md`.
- Read final file contents directly to confirm prompt wording and Docker mount examples use `scan-reports/` consistently.
- Synced Markdown lint config and ran:
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
