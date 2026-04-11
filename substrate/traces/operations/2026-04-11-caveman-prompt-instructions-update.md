---
status: completed
created_at: 2026-04-11
files_edited:
  - AGENTS.md
  - agent/planner.md
  - command/commit.md
  - command/review.md
  - skills/caveman/SKILL.md
  - skills/caveman-commit/SKILL.md
  - skills/caveman-review/SKILL.md
  - skills/directives-schema/SKILL.md
  - skills/modern-css-snippets/SKILL.md
  - skills/mycelium-migration/SKILL.md
  - skills/replicate-png-generation/SKILL.md
  - skills/replicate-svg-generation/SKILL.md
  - skills/web-design-references/SKILL.md
  - .markdownlintignore
rationale:
  - align shared communication prompts with new caveman skill set
  - route commit and review contexts to dedicated caveman instruction files
  - rewrite prompt and skill wording in direct second person
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - substrate/traces/status/2026-04-11-caveman-skill-workspace-state.md
---

# Caveman prompt instructions update

## Summary of changes

- Added a shared instruction in `AGENTS.md` that tells the active agent directly to follow `skills/caveman/SKILL.md` for chat and user-facing communication.
- Updated `command/commit.md`, `command/review.md`, and `agent/planner.md` so commit and review flows explicitly follow the dedicated caveman commit and review skill files.
- Reworked caveman-related skill files so they act as absolute instruction files instead of trigger-based command logic, kept `full` as the standard mode, and removed Chinese/Wenyan language references.
- Rewrote several existing skill prompts in direct second person or imperative voice so they read like prompts directed to the agent instead of abstract documentation.
- Added `tmp/` to `.markdownlintignore` so markdownlint ignores temporary external content and validates repository markdown cleanly.

## Technical reasoning

- The user wanted prompt files to speak directly to the current agent, not about agents as an abstract group. Rewriting shared and skill prompts to second person keeps prompt style consistent with files under `agent/`.
- Commit and review tasks need narrower communication rules than general chat. Pointing those entry points to `skills/caveman-commit/SKILL.md` and `skills/caveman-review/SKILL.md` keeps behavior explicit and composable.
- Removing trigger phrases and slash-command logic from the caveman skill files turns them into persistent instruction references instead of optional modes.
- Temporary cloned content under `tmp/` is not repository source. Ignoring it in markdownlint avoids false failures while keeping repository markdown fully checked.

## Impact assessment

- Prompt behavior changes only. No runtime product code changed.
- Agents now receive clearer, more direct wording for chat, commit, and review communication.
- Existing skills outside the caveman set now read more consistently as agent-facing prompts.
- Markdown validation is more reliable in local workspaces that contain temporary external directories.

## Validation steps

1. Reviewed final diffs for all touched prompt and skill files with `git diff`.
2. Read modified file contents directly to confirm second-person wording and command routing.
3. Ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot` with zero errors after adding `tmp/` ignores.
4. Confirmed the final working tree only contains the intended prompt, skill, and lint-ignore changes.
