---
status: completed
created_at: 2026-04-11
files_edited:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - README.md
  - agent/directives-analyzer.md
  - agent/directives-locator.md
  - agent/directives-writer.md
  - agent/expectations-analyzer.md
  - agent/expectations-locator.md
  - agent/expectations-writer.md
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - command/migrate-to-mycelium.md
  - skills/directives-schema/SKILL.md
  - skills/directives-schema/references/_schema.yaml
  - skills/directives-schema/references/_templates/api.md
  - skills/directives-schema/references/_templates/default.md
  - skills/directives-schema/references/_templates/logic.md
  - skills/directives-schema/references/_templates/security.md
  - skills/directives-schema/references/_templates/ui.md
  - skills/expectations-schema/SKILL.md
  - skills/expectations-schema/references/_schema.yaml
  - skills/expectations-schema/references/_templates/default.md
  - skills/mycelium-migration/SKILL.md
rationale:
  - separate customer-facing expectations from developer-facing directives in the Mycelium model
  - keep legacy intents migration aligned with existing structured developer instruction semantics
  - introduce dedicated tooling, naming, and guidance for both document classes
supporting_docs:
  - substrate/traces/plans/2026-04-09-mycelium-substrate-migration.md
  - substrate/traces/operations/2026-04-09-mycelium-framework-migration.md
  - .github/CONTRIBUTING.md
---

# Mycelium expectations and directives reset

## Summary of changes

This update split the old mixed “directives/expectations” concept into two distinct Mycelium document classes:

- `substrate/directives/` now means structured developer instructions for human and AI developers
- `substrate/expectations/` now means higher-level client expectations about product behavior and outcomes
- `DRC-*` became the directive prefix
- `EXP-*` remained the expectation prefix

The framework documentation, agent prompts, schema guidance, and migration docs were updated to reflect this new model.

Follow-up clarification applied in the same operation: expectations are not generic end-user UX notes. They represent what a commissioning client expects the product, workflow, or business mechanism to do at a higher level.

## Technical reasoning

The previous setup mixed two concerns under one label:

1. detailed implementation guidance for developers
2. higher-level statements about what the final product should deliver for the commissioning client

That overlap made “directive” and “expectation” ambiguous. The new split restores a clearer contract:

- expectations define the business outcomes, operational behavior, and product results expected by the commissioning client
- directives define how developers and AI agents should realize those outcomes

The migration logic still maps legacy `intents/` into `substrate/directives/` because those historical files were already acting as developer instructions rather than customer-level expectations.

## Impact assessment

### Behavioral impact

- orchestrator, planner, and quick now research both expectations and directives
- directive-specific agents now target `DRC-*` files only
- new expectation-specific agents now target `EXP-*` files under `substrate/expectations/`

### Documentation impact

- the directives schema is now explicitly implementation-focused
- a new lighter expectations schema was added for client/business expectation docs
- expectation wording was refined away from generic customer-facing UX language toward client/business expectation language
- README, contributing guidance, and migration docs now describe a three-part substrate model: traces, directives, expectations

### Migration impact

- legacy `intents/` still migrate into `substrate/directives/`
- `substrate/expectations/` is a new destination with no legacy source
- new repositories should create all three substrate directories from the start

## Validation steps

1. reviewed changed markdown files directly after subagent edits
2. verified new agent permissions include `expectations-*` where needed
3. verified naming split is consistent: `DRC-*` for directives, `EXP-*` for expectations
4. checked schema and template heading consistency for expectations and directives
5. synced markdownlint config and ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
6. removed temporary `tmp/caveman-main/` clone content so repository-wide markdown lint could pass cleanly
7. reran markdown lint and confirmed zero errors
8. verified expectation-related prompts and docs now refer to commissioning-client expectations rather than generic end-user expectations

All checks passed.
