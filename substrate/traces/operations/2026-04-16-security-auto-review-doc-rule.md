---
status: completed
created_at: 2026-04-16
files_edited:
  - agent/security-specialist.md
rationale:
  - make review-document creation mandatory after security reviews that find real vulnerabilities
  - avoid unnecessary review files for no-findings and pure false-positive outcomes
supporting_docs:
  - agent/security-specialist.md
  - substrate/traces/operations/2026-04-16-security-review-docs-standardization.md
---

# Summary of changes

- Updated `agent/security-specialist.md` so the agent now decides review-file creation explicitly based on assessment results.
- Added a mandatory rule to create a review document under `substrate/traces/reviews/` when one or more real vulnerabilities are found.
- Added default skip behavior for no-findings and pure false-positive outcomes unless the parent agent explicitly requests documentation.

# Technical reasoning

The prompt already told `security-specialist` how to write review documents, but it did not yet say clearly when a review file must or must not be created. That ambiguity could lead to inconsistent review-trace generation between runs.

The update therefore added a simple result-based decision rule at the start of the review documentation section so the agent can behave consistently:

- vulnerabilities found → write review file;
- no vulnerabilities found → report no findings and skip file creation;
- pure false positives only → skip file creation unless explicitly asked.

# Impact assessment

- Security review traces should now appear automatically when there are real findings worth tracking.
- Clean assessments should stay lighter, with no unnecessary review markdown unless specifically requested.
- False-positive-only reviews should no longer create noise in `substrate/traces/reviews/` by default.

# Validation steps

- Read the updated review-documentation section in `agent/security-specialist.md` after the subagent edit.
- Verified the diff only added the intended result-based review-file decision rules.
- Synced Markdown lint config and ran:
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
