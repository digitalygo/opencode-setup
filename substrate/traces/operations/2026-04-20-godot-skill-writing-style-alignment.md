---
status: completed
created_at: 2026-04-20
updated_at: 2026-04-20
files_edited:
  - skills/godot-game-dev/SKILL.md
  - skills/godot-game-dev/references/godot-3d-generation.md
  - skills/godot-game-dev/references/godot-3d-rigging.md
  - skills/godot-game-dev/references/godot-api.md
  - skills/godot-game-dev/references/godot-asset-planner.md
  - skills/godot-game-dev/references/godot-capture.md
  - skills/godot-game-dev/references/godot-decomposer.md
  - skills/godot-game-dev/references/godot-executor.md
  - skills/godot-game-dev/references/godot-orchestrator.md
  - skills/godot-game-dev/references/godot-quirks.md
  - skills/godot-game-dev/references/godot-scaffold.md
  - skills/godot-game-dev/references/godot-visual-qa.md
rationale:
  - adapt the new Godot skill package to repository prompt-writing style
  - make prompt files address the active AI directly instead of describing skills abstractly
  - preserve detailed Godot guidance while removing generic or detached wording
  - align Tripo3D reference docs more closely with Replicate skill document style without refactoring schemas or code snippets yet
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - substrate/traces/operations/2026-04-11-caveman-prompt-instructions-update.md
  - substrate/traces/status/2026-04-20-godot-skill-preexisting-changes.md
  - skills/replicate-png-generation/SKILL.md
  - skills/replicate-svg-generation/SKILL.md
---

# Godot skill writing style alignment

## Summary of changes

- Reworked `skills/godot-game-dev/SKILL.md` so the top-level skill reads as a direct operating prompt for the active AI, not as abstract documentation about a skill package.
- Rewrote all eleven reference files under `skills/godot-game-dev/references/` to use repository house style: direct second-person or imperative phrasing, explicit scope limits, and concrete usage guidance.
- Preserved the original Godot-specific technical content, including GDScript contracts, validation loops, capture workflows, Tripo3D sidecar rules, and example snippets.
- Added a preexisting-changes status note before adaptation work so later review can distinguish original user-provided content from house-style rewriting.

## Technical reasoning

- `.github/CONTRIBUTING.md` requires prompt and instruction files to speak directly to the AI reader in second person and to use active, direct phrasing. The new Godot package was detailed and useful, but many sections still read like external documentation with detached labels such as “this skill covers”, “rules”, “action”, and third-person boundaries.
- Existing repository skill work, especially `skills/caveman-commit/SKILL.md`, `skills/mycelium-migration/SKILL.md`, and the earlier caveman prompt update operation, establishes a pattern where instruction files behave like live prompts. Aligning the Godot package to that pattern keeps future agent behavior more consistent.
- The rewrite intentionally kept the technical contracts stable. The work changed presentation and prompting style, not the underlying Godot workflows or source-derived constraints.

## Impact assessment

- Agents loading `godot-game-dev` should now receive clearer, more actionable instructions with less risk of generic or passive interpretation.
- The skill package remains suitable for end-to-end Godot work across planning, scaffolding, execution, capture, visual QA, asset generation, and rigging workflows.
- No runtime code, setup logic, or executable behavior changed in the repository. Impact is limited to prompt quality and agent guidance.

## Validation steps

1. Checked repository state with `git status --short` and confirmed the Godot package was preexisting untracked content before adaptation.
2. Read `skills/godot-game-dev/SKILL.md` and every referenced file completely before delegating edits.
3. Used repository research traces and style examples to derive house-style patterns for direct AI-facing prompt writing.
4. Verified modified file contents directly after subagent edits instead of relying only on subagent summaries.
5. Ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot` and confirmed a zero-error result.

## Security gate

- Skipped mandatory security review because this task changed Markdown prompt files only and did not introduce executable, runtime-affecting, infrastructure, or generated code artifacts.

## Update on 2026-04-20: Tripo3D docs style alignment

### Summary of changes

- Refined `skills/godot-game-dev/references/godot-3d-generation.md` and `skills/godot-game-dev/references/godot-3d-rigging.md` so their top-level structure and tone align more closely with the existing Replicate PNG and SVG skills.
- Standardized the opening flow around concise sections such as what the skill does, when to use it, when not to use it, and references.
- Kept existing Tripo3D snippets, contracts, payload details, sidecar examples, and integration notes intact because deeper schema and code harmonization was explicitly deferred.

### Technical reasoning

- The Replicate skills already establish a concise integration-skill pattern in this repository: a short capability summary up front, clear usage gates, then concrete operational details. The two Tripo3D documents had the right technical content but still felt more like hybrid internal notes than standalone integration skills.
- The user asked for stylistic convergence first, not a full normalization of schemas or snippets. The update therefore focused on section framing and document flow while leaving technical payload structure untouched.

### Impact assessment

- The Tripo3D documents now read more consistently next to `skills/replicate-png-generation/SKILL.md` and `skills/replicate-svg-generation/SKILL.md`.
- Future follow-up work can align snippets, schema blocks, and contract formatting from a cleaner stylistic baseline.
- No executable or runtime behavior changed.

### Validation

- Re-read both Tripo3D files after the rewrite and compared them against the Replicate PNG and SVG skills.
- Confirmed the changes stayed limited to the two Tripo3D Markdown files and this operation record.
- Ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot` with zero errors after the update.
