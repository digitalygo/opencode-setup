---
status: completed
created_at: 2026-04-09
files_edited:
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - agent/traces-locator.md
  - agent/traces-analyzer.md
  - agent/directives-locator.md
  - agent/directives-analyzer.md
  - agent/intents-writer.md
  - agent/complex-problem-researcher.md
  - command/review.md
  - command/migrate-to-mycelium.md
  - skills/directives-schema/SKILL.md
  - skills/mycelium-migration/SKILL.md
  - README.md
rationale:
  - establish clear separation between agent-written traces and human-authored directives
  - remove unnecessary shared/ subdirectory layer from traces
  - unify framework under consistent substrate/ namespace
  - enable hard cutover without backward-compatible ambiguity
supporting_docs:
  - substrate/traces/plans/2026-04-09-mycelium-substrate-migration.md
  - .github/CONTRIBUTING.md
---

# Mycelium framework migration

## Summary of changes

migrated the repository from legacy `thoughts/` and `intents/` layout to the Mycelium substrate standard. the new structure uses `substrate/traces/` for agent-written documentation and `substrate/directives/` for human-authored behavioral directives.

key changes:

- updated all agent frontmatter permissions from `thoughts/` and `intents/` to `substrate/traces/` and `substrate/directives/`
- removed `shared/` from all trace paths; content now lives directly under traces subdirectories
- updated prompt bodies to reference new paths and use consistent "directives" terminology
- created `mycelium-migration` skill with hard cutover enforcement rules
- created `migrate-to-mycelium` command definition for orchestrator execution
- updated README.md to reflect new sync semantics and folder structure
- fixed remaining terminology inconsistencies ("intents" to "directives" in compliance sections)

## Technical reasoning

the previous `thoughts/` and `intents/` structure lacked clear authorship semantics and forced an unused `shared/` intermediate layer. the Mycelium framework addresses this by:

1. **clear naming**: `traces/` for agent output, `directives/` for human expectations
2. **flatter hierarchy**: removing `shared/` reduces path complexity
3. **unified namespace**: `substrate/` contains all framework-related content
4. **hard cutover**: prevents drift between old and new conventions

agent permissions were the most critical change; stale paths would immediately break read/write access after migration.

## Impact assessment

**breaking changes:**

- agents now require `substrate/` paths in permissions
- legacy repositories must migrate before agents can write traces or directives
- setup.sh exclusions updated to `substrate/traces/` (directives remain synced)

**migration path:**

existing repositories using `thoughts/` and `intents/` must run the `migrate-to-mycelium` command to move files to new locations. the command detects layout, refuses mixed states, and preserves all content.

**documentation:**

historical documents retain original path references in their body text (acceptable as historical records). only active prompts and permissions were updated.

## Validation steps

1. verified all agent files use new permission globs (`substrate/traces/*.md`, `substrate/directives/*.md`)
2. confirmed `shared/` removed from all active path conventions
3. validated sentence case throughout modified files
4. ran markdownlint on all changed files; zero errors
5. confirmed setup.sh excludes only `substrate/traces/` (not directives)
6. verified README.md sync semantics match setup.sh behavior
7. checked that legacy paths only appear in migration/help context
8. ensured hard cutover rule is explicit: agents must not create files in legacy paths

all validation passed. the framework is ready for use.
