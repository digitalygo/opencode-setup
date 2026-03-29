---
status: completed
created_at: 2026-03-30
files_edited:
  - skills/intents-schema/SKILL.md
  - skills/intents-schema/references/_schema.yaml
  - skills/intents-schema/references/_templates/default.md
  - skills/intents-schema/references/_templates/ui.md
  - skills/intents-schema/references/_templates/api.md
  - skills/intents-schema/references/_templates/logic.md
  - skills/intents-schema/references/_templates/security.md
  - agent/intents-writer.md
  - agent/intents-analyzer.md
  - agent/intents-locator.md
  - agent/documentation-writer.md
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - agent/complex-problem-researcher.md
  - agent/docker-specialist.md
  - agent/frontend-html-css-specialist.md
  - agent/general.md
  - agent/security-specialist.md
  - agent/static-site-dev.md
  - agent/web-app-dev.md
  - .markdownlint.json
  - .markdownlintignore
  - thoughts/shared/operations/2026-03-30-intents-expectations-refresh.md
rationale: redefine expectations schema and templates to focus on role-based behaviors without tags and keep templates centralized in skill
supporting_docs:
  - thoughts/shared/status/2026-03-29-intents-workspace-changes.md
---

## Summary of changes

- Updated intents-schema skill and templates to enforce role-aware expectations, remove tags, add Inputs & Outputs and acceptance criteria requirements, and add `other` type.
- Refreshed intents-writer prompt to auto-infer frontmatter from user answers, require Actors and Roles, mandate Inputs & Outputs for API/Logic, and forbid placeholders in acceptance criteria.
- Synced markdownlint configuration and ran lint fix across markdown files.

## Technical reasoning

- Role distinctions are now first-class via mandatory Actors and Roles section and role-aware acceptance criteria.
- Frontmatter remains required but is designed to be auto-inferred by intents-writer, reducing user burden while preserving validation.
- Templates are kept inside the skill references only, aligning with the requirement to avoid duplicating schema/templates across repos.

## Impact assessment

- Documentation-only changes; no runtime code touched.
- Expectations authored with new templates will capture role-based behavior and required inputs/outputs, improving clarity for API/Logic cases.
- Removal of tags simplifies maintenance for human editors post-creation.

## Validation steps

- Reviewed updated schema, templates, and intents-writer content for section order and required fields.
- Synced markdownlint config and ran lint: `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`.
