---
status: completed
created_at: 2026-04-16
files_edited:
  - agent/orchestrator.md
  - agent/security.md
rationale:
  - make orchestrator run mandatory end-of-cycle security validation through security-specialist
  - add a primary security agent that can discover, validate, reproduce, and document vulnerabilities using the pentest toolbox and multiple subagents
supporting_docs:
  - agent/orchestrator.md
  - agent/planner.md
  - agent/security-specialist.md
  - command/review.md
  - substrate/traces/status/2026-04-16-security-workflow-expansion-workspace-state.md
---

# Summary of changes

- Updated `agent/orchestrator.md` so every implementation cycle now ends with a mandatory `security-specialist` gate.
- Added `agent/security.md` as a new primary security agent for aggressive discovery, review writing, and multi-subagent validation of vulnerabilities.
- Preserved the existing `security-specialist` role as the execution-focused security subagent while giving the new main `security` agent broader orchestration and verification duties.

# Technical reasoning

The repository already had a capable security subagent, but it was still optional from the orchestrator's point of view and there was no dedicated primary security workflow for turning findings into verified vulnerabilities.

The update therefore split responsibilities more clearly:

- `orchestrator` now must always run a security gate before calling work complete;
- `security-specialist` remains the pentest-toolbox execution engine;
- `security` becomes the escalation and validation authority that can investigate root cause, write reproduction guidance, and force independent reproduction through multiple subagents.

This preserves separation of concerns while making security validation a mandatory part of delivery instead of an optional add-on.

# Impact assessment

- Orchestrated implementation flows should now surface security findings before work is presented as safe.
- Users now have a dedicated main `security` agent to switch to when a vulnerability needs aggressive follow-up and formal verification.
- Review traces should become stronger because verified findings now require explicit reproduction guidance and confirmation by at least 3 subagent runs.

# Validation steps

- Read `agent/orchestrator.md`, `agent/planner.md`, `agent/security-specialist.md`, and `command/review.md` before delegating edits.
- Researched repository patterns for primary-agent permissions, review conventions, and recent security trace history.
- Read the final contents of `agent/orchestrator.md` and `agent/security.md` directly after subagent edits.
- Reviewed `git diff -- agent/orchestrator.md agent/security.md` to verify only intended prompt changes were introduced.
- Synced markdownlint config and ran:
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
