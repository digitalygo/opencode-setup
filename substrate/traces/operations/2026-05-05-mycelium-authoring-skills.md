---
status: completed
created_at: 2026-05-05
updated_at: 2026-05-05
files_edited:
  - README.md
  - agent/directives-writer.md
  - agent/expectations-writer.md
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - agent/security-review-specialist.md
  - agent/security-specialist.md
  - agent/security.md
  - command/review.md
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
  - skills/mycelium-directive/SKILL.md
  - skills/mycelium-directive/references/_schema.yaml
  - skills/mycelium-directive/references/_templates/api.md
  - skills/mycelium-directive/references/_templates/default.md
  - skills/mycelium-directive/references/_templates/logic.md
  - skills/mycelium-directive/references/_templates/security.md
  - skills/mycelium-directive/references/_templates/ui.md
  - skills/mycelium-expectation/SKILL.md
  - skills/mycelium-expectation/references/_schema.yaml
  - skills/mycelium-expectation/references/_templates/default.md
  - skills/mycelium-migration/SKILL.md
  - skills/mycelium-operation/SKILL.md
  - skills/mycelium-plan/SKILL.md
  - skills/mycelium-research/SKILL.md
  - skills/mycelium-review/SKILL.md
  - skills/mycelium-status/SKILL.md
  - substrate/traces/operations/2026-05-05-mycelium-authoring-skills.md
  - substrate/traces/status/2026-05-05-orchestrator-status-skill-tightening-workspace-state.md
  - substrate/traces/status/2026-05-05-planner-documentation-skill-tightening-workspace-state.md
  - substrate/traces/status/2026-05-05-orchestrator-operation-skill-delegation-workspace-state.md
rationale:
  - replace inline embedded authoring schemas with dedicated skills agents load on demand
  - unify all Mycelium trace and document types under one `mycelium-` skill prefix
  - remove the migration-awareness skill now that the hard cutover is complete and no legacy layout exists
  - keep historical trace references to removed skills because those are audit history, not active routing
  - consolidate review output guidance into a single `mycelium-review` skill
  - tighten orchestrator status guidance so inline mechanics move fully into `mycelium-status`, keeping the orchestrator prompt minimal and delegating concrete status record creation steps to the status skill
  - tighten planner markdown-documentation guidance and move removed inline context into `mycelium-plan` and `mycelium-research` skills
  - tighten orchestrator operation-record guidance by removing the inline `### Operation records` prompt section and keeping operation-record rules entirely in `mycelium-operation`
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - substrate/traces/operations/2026-04-11-mycelium-expectations-directives-reset.md
  - substrate/traces/operations/2026-04-19-orchestrator-operation-record-reuse.md
  - substrate/traces/operations/2026-05-04-complex-problem-researcher-selection-guidance.md
  - substrate/traces/plans/2026-04-09-mycelium-substrate-migration.md
  - substrate/traces/research/2026-04-09-repository-improvement-opportunities.md
  - substrate/traces/status/2026-05-05-orchestrator-status-skill-tightening-workspace-state.md
  - substrate/traces/status/2026-05-05-planner-documentation-skill-tightening-workspace-state.md
  - substrate/traces/status/2026-05-05-orchestrator-operation-skill-delegation-workspace-state.md
---

# Summary of changes

This operation replaced the old inline authoring-schema pattern with seven dedicated Mycelium-prefixed skills covering every substrate trace type and document class:

- `mycelium-operation` — operation record format and frontmatter rules
- `mycelium-plan` — plan document format and frontmatter rules
- `mycelium-research` — research document format and frontmatter rules
- `mycelium-status` — workspace state snapshot format and frontmatter rules
- `mycelium-review` — review file format, finding structure, and frontmatter rules
- `mycelium-directive` — developer-facing directive (`DRC-*.md`) schema and templates
- `mycelium-expectation` — client-facing expectation (`EXP-*.md`) schema and templates

Previously, agents embedded authoring schemas directly in their prompt bodies. This refactor replaced those inline instructions with `Load the ... skill` references, so schema details live in one place per type and agents consume them on demand.

The old `directives-schema` and `expectations-schema` skill directories were renamed under the `mycelium-` prefix and their reference assets migrated intact. The `mycelium-migration` skill and the active README reference to it were removed because the migration is complete and no legacy layout exists in this repository.

All review guidance across security agents and the review command was consolidated to reference `mycelium-review` instead of carrying duplicated review-format instructions inline. Status-file naming guidance was resolved to match the repository's real hyphenated-date examples.

# Technical reasoning

The prior pattern violated the repository's own research finding about duplicated operational instructions being a maintenance hotspot. Every agent that wrote a trace file or directive/expectation document carried its own copy of the schema rules. That meant changing a frontmatter field or section requirement required editing four or more agent prompts, with drift inevitable.

The new pattern follows the skill-load approach already used for design references and image generation: the authoritative schema lives in a single skill file, and agents reference it by name. This reduces prompt bloat in agents that don't need the schema on every invocation, and it keeps frontmatter, section, and format rules consistent across all writers.

The `mycelium-` prefix unifies the skill namespace so agents and humans can visually group all substrate authoring tools. The migration skill was retired rather than refactored into the new namespace because its purpose was a one-time cutover that has already completed for this repository. Historical traces that reference `mycelium-migration`, `directives-schema`, or `expectations-schema` were deliberately left untouched because those records are audit history, not active routing instructions — a policy the migration plan explicitly established.

# Impact assessment

## Behavioral impact

- agents that write substrate trace files now load a dedicated skill for format rules instead of relying on embedded inline schema text
- directive and expectation writers now load `mycelium-directive` or `mycelium-expectation` instead of the old unprefixed schema skills
- security agents and the review command now route review output through `mycelium-review` instead of carrying duplicated review format instructions
- no agent is instructed to load `mycelium-migration`, `directives-schema`, or `expectations-schema` as an active skill

## Documentation impact

- README no longer references the migration skill in the Mycelium section
- each Mycelium trace type now has a discoverable, loadable skill definition
- the old schema skill directories are fully removed from the repository

## Migration impact

- no impact on existing repositories; the `migrate-to-mycelium` command is unchanged
- historical trace files that mention deleted skills are preserved as-is per the established historical-documents policy

## Risk assessment

- if a new agent prompt is written without a `mycelium-*` skill reference and attempts to write a trace file, format drift could occur — this risk existed in the prior inline-schema model too and is smaller now because the skills are easier to discover and reference

# Validation steps

- verified all seven new skill files exist under `skills/mycelium-*/SKILL.md` with correct schema content
- verified old `skills/directives-schema/`, `skills/expectations-schema/`, and `skills/mycelium-migration/` directories are absent from the repository
- verified no agent prompt, command definition, or README body contains stale `directives-schema`, `expectations-schema`, or `mycelium-migration` references
- verified `mycelium-*` skill references are present in `agent/orchestrator.md`, `agent/planner.md`, `agent/quick.md`, `agent/directives-writer.md`, `agent/expectations-writer.md`, `agent/security.md`, `agent/security-specialist.md`, `agent/security-review-specialist.md`, and `command/review.md`
- verified historical operation records that cite deleted skills remain unchanged on disk
- synced Markdown lint config and ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
- ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot` and confirmed zero errors
- no pre-existing workspace changes existed at task start, so no status file was created for this session
- final security gate skipped intentionally: this session changed only prompt Markdown, skill Markdown, and skill schema/template reference files. No executable code, runtime configuration, infrastructure, or service behavior was modified.

# Update 2026-05-05

## Summary of changes

- Tightened `agent/orchestrator.md` so status mechanics are fully delegated to `mycelium-status`. The orchestrator now says only: if changes exist, load `mycelium-status` and follow instructions carefully.
- Moved the removed inline mechanics into `skills/mycelium-status/SKILL.md`. The status skill now covers ensuring `substrate/traces/status/` exists, ensuring `.gitignore` includes `substrate/traces/status/`, creating the status record with a summary (not raw diffs), and not dumping raw diffs.
- Created `substrate/traces/status/2026-05-05-orchestrator-status-skill-tightening-workspace-state.md` to separate this follow-up task from the pre-existing refactor changes already in the working tree.

## Technical reasoning

The previous orchestrator prompt (after the main refactor) already loaded `mycelium-status` but still carried inline instructions about creating status records. That duplicated the instructions the skill itself should own, creating the same maintenance hotspot the original refactor was designed to eliminate.

This follow-up completes the separation: the orchestrator now delegates status handling fully to the skill, and the skill carries all concrete steps. If the status creation workflow needs to change, only the skill file needs an update.

The user message mentioned `mycelium-research`, but the concrete request to move gitignore/status mechanics into the status instructions made `mycelium-status` the coherent target skill. Status record creation is the natural scope of the status skill, not the research skill.

## Impact assessment

- The orchestrator prompt is now one line shorter for status handling while being more correct in its delegation.
- Future changes to status record creation mechanics only need to touch `skills/mycelium-status/SKILL.md`.
- No new duplication risk: the orchestrator no longer carries any status-creation instructions beyond the skill reference.
- The `.gitignore` already contained `substrate/traces/status/` from the main refactor, so the status skill's instruction to ensure it is a defensive check, not a new gitignore entry.

## Validation steps

- Read `agent/orchestrator.md` and confirmed the status block now says only: "If changes exist, load the `mycelium-status` skill and follow the instructions carefully."
- Read `skills/mycelium-status/SKILL.md` and confirmed the usage workflow covers directory creation, gitignore verification, status record creation, and the no-raw-diffs rule.
- Confirmed `substrate/traces/status/2026-05-05-orchestrator-status-skill-tightening-workspace-state.md` exists and correctly documents the pre-existing refactor changes.
- Synced Markdown lint config and ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`.
- Final security gate skipped intentionally: this follow-up changed only prompt Markdown, skill Markdown, and trace Markdown. No executable code, runtime configuration, infrastructure, or service behavior was modified.

# Update 2026-05-05 — planner documentation-skill tightening

## Summary of changes

- Tightened `agent/planner.md` step 4 so documentation guidance is fully delegated to `mycelium-plan` and `mycelium-research` skills. The planner now says only three bullets: load `mycelium-research` for research output, load `mycelium-plan` for plan output, and follow repository guidelines when writing under `docs/` or `tmp/`.
- Moved the removed inline documentation context into `skills/mycelium-research/SKILL.md` and `skills/mycelium-plan/SKILL.md`.
- `mycelium-research` now explicitly says capture all findings in detail and keep user scope in mind, plus follow repository guidelines when writing under `docs/` or `tmp/`.
- `mycelium-plan` now explicitly says capture all findings, assess the task, break it into steps, include cited sites / verified constraints / boundaries, plus follow repository guidelines when writing under `docs/` or `tmp/`.
- Created `substrate/traces/status/2026-05-05-planner-documentation-skill-tightening-workspace-state.md` to separate this task from pre-existing changes already in the working tree.

## Technical reasoning

The planner prompt (after the main authoring-skill refactor) already loaded `mycelium-plan` and `mycelium-research` but still carried inline instructions about documentation structure and conventions. That duplicated the instructions the skills themselves should own, creating the same maintenance hotspot the original refactor was designed to eliminate.

This follow-up completes the separation: the planner now delegates documentation guidance fully to the skills, and the skills carry all concrete documentation conventions. If research or plan output conventions need to change, only the respective skill file needs an update. The `docs/` and `tmp/` repository-guidelines reminder stays in the planner prompt as a routing hint, not as duplicated authoring rules.

## Impact assessment

- The planner prompt step 4 is now a concise three-bullet delegation block instead of carrying inline documentation structure rules.
- `mycelium-research` and `mycelium-plan` skills now own the documentation conventions that previously sat in the planner prompt.
- Future changes to plan or research output conventions only need to touch one skill file each.
- No new duplication risk: the planner no longer carries any documentation-convention instructions beyond skill references and a `docs/`/`tmp/` routing hint.

## Validation steps

- Read `agent/planner.md` and confirmed step 4 now says: load `mycelium-research` and follow instructions carefully for research, load `mycelium-plan` and follow instructions carefully for plans, and follow repository guidelines when updating files under `docs/` or `tmp/`.
- Read `skills/mycelium-research/SKILL.md` and confirmed it now includes "Capture all findings in detail and keep the user scope in mind" and the `docs/`/`tmp/` repository-guidelines reference.
- Read `skills/mycelium-plan/SKILL.md` and confirmed it now includes "Capture all findings and explain how to assess the task, break the problem into a step-by-step procedure, and include useful implementation information: cited websites, verified constraints, and boundaries of the task" and the `docs/`/`tmp/` repository-guidelines reference.
- Confirmed `substrate/traces/status/2026-05-05-planner-documentation-skill-tightening-workspace-state.md` exists and correctly documents the two layers of pre-existing refactor changes before this follow-up.
- Final security gate skipped intentionally: this follow-up changed only prompt Markdown, skill Markdown, and trace Markdown. No executable code, runtime configuration, infrastructure, or service behavior was modified.

# Update 2026-05-05 — orchestrator operation-record skill delegation

## Summary of changes

- Removed the entire `### Operation records` instruction block from `agent/orchestrator.md`.
- Replaced it with a single routing line: "For exact YAML frontmatter, required sections, and update protocol, load the `mycelium-operation` skill and follow the instructions carefully." This mirrors the status-delegation pattern already applied to `mycelium-status`.
- `skills/mycelium-operation/SKILL.md` already carried almost all concrete operation-record rules (when to create vs update, file naming, YAML frontmatter format, required body sections, update protocol, discordant follow-up handling). Clarified only where gaps existed:
  - Added explicit instruction that related completed tasks may live in the same operation record when tied to the same decision, process, or feature.
  - Added explicit call for supporting documentation links, related research traces, and related tickets when available.
- Created `substrate/traces/status/2026-05-05-orchestrator-operation-skill-delegation-workspace-state.md` to document the three layers of pre-existing uncommitted changes in the working tree (authoring-skill refactor, status tightening, planner tightening) before this follow-up began.
- Updated this operation record with frontmatter additions and the new update section to capture the follow-up.

## Technical reasoning

The orchestrator prompt (after the main authoring-skill refactor and the status/planner tightening follow-ups) already loaded `mycelium-operation` but still carried inline instructions about operation-record creation, naming, frontmatter format, and update protocol. That duplicated the instructions the operation skill itself should own, creating the same maintenance hotspot the original refactor was designed to eliminate.

This follow-up completes the separation: the orchestrator now delegates operation-record handling fully to the skill, and the skill carries all concrete rules. If the operation-record creation or update workflow needs to change, only `skills/mycelium-operation/SKILL.md` needs an update. The orchestrator prompt is now one paragraph shorter while being more correct in its delegation.

## Impact assessment

- The orchestrator prompt is simplified. It no longer carries any operation-record creation or update instructions beyond a single skill-delegation line.
- `skills/mycelium-operation/SKILL.md` is now the single source of truth for operation-record behavior. Future changes to operation-record rules only touch one file.
- No new duplication risk: the orchestrator no longer carries any operation-record instructions beyond the skill reference.
- The status file `substrate/traces/status/2026-05-05-orchestrator-operation-skill-delegation-workspace-state.md` documents pre-existing working-tree state (three layers of uncommitted changes) so this follow-up's scope is clearly separated from prior work.

## Validation steps

- Read `agent/orchestrator.md` and confirmed the `### Operation records` section is fully removed. Only a single routing line remains: "For exact YAML frontmatter, required sections, and update protocol, load the `mycelium-operation` skill and follow the instructions carefully."
- Read `skills/mycelium-operation/SKILL.md` and confirmed it carries all concrete operation-record rules: creation vs update decision tree, file naming conventions, YAML frontmatter format, required body sections, supporting documentation links, related research traces, related tickets, update protocol with labeled sections, and discordant follow-up handling.
- Confirmed the skill now explicitly says related completed tasks may live in the same operation record when tied to the same decision/process/feature.
- Confirmed the skill now explicitly calls for supporting documentation links, related research traces, and related tickets when available.
- Confirmed `substrate/traces/status/2026-05-05-orchestrator-operation-skill-delegation-workspace-state.md` exists and correctly documents the three layers of pre-existing refactor changes before this follow-up.
- Final security gate skipped intentionally: this follow-up changed only prompt Markdown, skill Markdown, and trace Markdown. No executable code, runtime configuration, infrastructure, or service behavior was modified.
