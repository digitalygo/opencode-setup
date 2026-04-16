---
status: completed
created_at: 2026-04-16
files_edited:
  - agent/security-specialist.md
rationale:
  - restrict security-specialist markdown edits to review traces only
  - standardize how security-specialist writes review files so they match planner-style documentation duties and repository review conventions
supporting_docs:
  - agent/planner.md
  - agent/security-specialist.md
  - command/review.md
  - skills/caveman-review/SKILL.md
  - substrate/traces/plans/2026-04-09-mycelium-substrate-migration.md
---

# Summary of changes

- Added `permission.edit` rules to `agent/security-specialist.md` that deny all edits by default and allow only markdown files under `substrate/traces/reviews/`.
- Added a review documentation duties section so `security-specialist` writes review files using a standardized path, filename format, frontmatter schema, and section layout.
- Added explicit guidance to follow `skills/caveman-review/SKILL.md` for review communication style while preserving fuller explanations for critical security findings.

# Technical reasoning

The repository already had a clear pattern for scoped edit permissions in agent frontmatter and a review workflow definition in `command/review.md`, but `security-specialist` lacked both review-specific edit scoping and standardized review-document instructions.

The update aligned `security-specialist` with the same narrow-permission model used elsewhere by:

- denying direct edits outside the intended markdown review area;
- pointing review output to the established `substrate/traces/reviews/` path;
- making review documentation structure explicit so future review files stay consistent.

This keeps the agent operationally flexible for security work while ensuring any direct documentation writes stay tightly bounded and predictable.

# Impact assessment

- `security-specialist` can now directly write only review traces, not arbitrary markdown elsewhere in the repository.
- Future security review artifacts should be more consistent in naming, metadata, and section structure.
- Review communication should better match the repository's terse review style while still allowing deeper explanation for severe security issues.

# Validation steps

- Read `agent/planner.md`, `agent/security-specialist.md`, `command/review.md`, and `skills/caveman-review/SKILL.md` before delegating the change.
- Reviewed final `agent/security-specialist.md` content after subagent edits instead of relying only on the summary.
- Checked the resulting diff to confirm only the intended permission and review-documentation sections changed.
- Synced Markdown lint config and ran:
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
