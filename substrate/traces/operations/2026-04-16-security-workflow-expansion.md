---
status: completed
created_at: 2026-04-16
updated_at: 2026-04-24
files_edited:
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - agent/security-review-specialist.md
  - agent/security-specialist.md
  - agent/security.md
rationale:
  - make orchestrator run mandatory end-of-cycle security validation and later route that gate through security-review-specialist
  - add a primary security agent that can discover, validate, reproduce, and document vulnerabilities using the pentest toolbox and multiple subagents
  - add a model-only changed-code security review subagent that does not use Docker or scanner tooling
  - route orchestrator final security review through security-review-specialist while preserving security-specialist for toolbox-based testing
  - let the primary security agent validate security-specialist findings through security-review-specialist before treating them as real
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - agent/security-review-specialist.md
  - agent/security-specialist.md
  - agent/security.md
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

# Update 2026-04-24

## Summary of changes

- Added `agent/security-review-specialist.md` as a model-only changed-code security review subagent using `opencode/claude-opus-4-7`.
- Updated `agent/orchestrator.md` so its final security gate uses `security-review-specialist` instead of the Docker-backed `security-specialist`.
- Updated `agent/security.md` so the primary security coordinator uses `security-review-specialist` for model-only code review and independent validation of `security-specialist` findings, while keeping `security-specialist` for toolbox-backed pentesting and active scans.
- Updated `agent/planner.md` and `agent/quick.md` so primary agents with `security-*` delegation know when to use each security subagent.
- Added a brief peer-findings note to `agent/security-specialist.md` so toolbox validation can use reviewer findings without duplicating model-only work.

## Technical reasoning

The previous workflow made `security-specialist` serve both end-of-cycle code review and heavy security testing. That blurred two different jobs: fast changed-code review and toolbox-backed assessment. The new split keeps `security-specialist` focused on Docker, pentest tooling, active scans, and authorized offensive validation, while `security-review-specialist` performs fast model-only review over diffs, readable generated artifacts, prompts, configuration, and infrastructure files.

The orchestrator now defaults to the model-only reviewer for prompt and code-change security gates. If the review surfaces a real or plausible issue, the orchestrator must send the user toward the primary `security` agent, which can combine reviewer reasoning with toolbox validation through `security-specialist` when active testing is needed and authorized.

## Impact assessment

- Orchestrator completion checks no longer require Docker or the pentest toolbox for changed-code security review.
- The security primary agent gains a cleaner two-subagent workflow: `security-review-specialist` for reasoning-based review and validation, `security-specialist` for hands-on testing.
- Planner and quick agents can now distinguish low-friction model review from authorized active testing when researching or planning security-sensitive work.
- No runtime application code changed; the update is prompt-only.

## Validation steps

- Confirmed no `DRC-*` or `EXP-*` files exist for this repository state.
- Read referenced agent files, shared `AGENTS.md`, `.github/CONTRIBUTING.md`, `skills/caveman-review/SKILL.md`, and relevant prior security operation traces.
- Delegated implementation to `documentation-writer` and verified final contents directly with `read`.
- Reviewed `git status`, full non-dependency diff, and `git diff --check`.
- Ran a read-only `codebase-analyzer` verification over the modified agent prompts; it passed all user requirements and found no collateral damage.
- Synced markdownlint config and ran:
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
- Final security gate was skipped because this session changed only prompt Markdown and trace documentation, with no executable code, infrastructure implementation, runtime service, or container artifact modified.
