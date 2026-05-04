---
status: completed
created_at: 2026-05-04
files_edited:
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - agent/directives-writer.md
  - substrate/traces/status/2026-05-04-orchestrator-researcher-threshold-workspace-state.md
  - substrate/traces/operations/2026-05-04-complex-problem-researcher-selection-guidance.md
rationale:
  - replace vague difficulty-only guidance for `complex-problem-researcher` with clearer escalation criteria
  - reduce unnecessary use of the expensive deep-reasoning subagent without creating a cost-only bias
  - keep duplicated primary-agent guidance aligned so prompt drift does not reintroduce overuse
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - agent/directives-writer.md
  - substrate/traces/status/2026-05-04-orchestrator-researcher-threshold-workspace-state.md
  - substrate/traces/operations/2026-04-16-security-agent-prompt-test.md
  - substrate/traces/operations/2026-04-16-security-workflow-expansion.md
  - substrate/traces/research/2026-04-09-repository-improvement-opportunities.md
---

# Summary of changes

- Updated `agent/orchestrator.md` so `complex-problem-researcher` is no longer gated by a vague difficulty label.
- Replaced that wording with explicit selection logic: do not call the agent by default, do not avoid it only because of cost, try simpler research first, and escalate when ambiguity or validation difficulty remains.
- Synced the same intent into `agent/planner.md`, `agent/quick.md`, and `agent/directives-writer.md` with smaller one-line guidance updates to reduce prompt drift.

# Technical reasoning

The user wanted a better balance than the existing manual tweak provided. The previous wording only said to use `complex-problem-researcher` for mid-difficulty tasks and above, which left too much room for subjective judgment. That makes it easy for the orchestrator to overuse the agent on routine work or underuse it for work that is genuinely risky or ambiguous.

The new guidance uses observable triggers instead of vague difficulty labels. It now tells the caller to start with simpler research agents and escalate only when those paths do not produce high-confidence results or when the task involves non-trivial refactors, trade-offs, feasibility questions, risky changes, or hard-to-validate findings. At the same time, it explicitly says not to avoid the agent only because of cost, which preserves the user's intent that usefulness should still win when deeper reasoning is actually needed.

The smaller sync edits in `planner`, `quick`, and `directives-writer` keep related primary-agent prompts aligned. This follows the repository's own research about duplicated operational instructions being a maintenance hotspot.

No `DRC-*` or `EXP-*` files exist in this repository state, so there were no directive or expectation documents to reconcile against this change.

# Impact assessment

- The orchestrator should call `complex-problem-researcher` less often for trivial or already well-understood tasks.
- The orchestrator should still call it when simpler agents cannot resolve uncertainty with high confidence.
- Related primary agents now carry the same anti-default guardrail, which lowers the chance of prompt drift reintroducing overuse.
- This task does not address the pre-existing high-risk review about orchestrator step 0 auto-running remote `curl | bash`; that security finding remains open and unchanged.

# Validation steps

- Read `agent/orchestrator.md`, `agent/complex-problem-researcher.md`, `agent/planner.md`, `agent/quick.md`, `agent/directives-writer.md`, `agent/expectations-writer.md`, `agent/security.md`, `AGENTS.md`, and `.github/CONTRIBUTING.md` before final verification.
- Checked repository state with `git status --short` and reviewed the initial prompt diff before delegating edits.
- Recorded the user's pre-existing manual edit in `substrate/traces/status/2026-05-04-orchestrator-researcher-threshold-workspace-state.md`.
- Used locator and analyzer subagents for directives, expectations, traces, and codebase research; all confirmed there are no current `DRC-*` or `EXP-*` files.
- Delegated the prompt update to `documentation-writer`, then caught a list-indentation regression during verification and delegated a second narrow fix instead of correcting it directly.
- Re-read the final contents of all modified prompt files and reviewed targeted `git diff` output to confirm only intended wording changes remained.
- Ran `git diff --check` to confirm no whitespace errors remained.
- Synced Markdown lint config and ran:
  - `curl -fsSL https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlint.json -o ./.markdownlint.json && curl -fsSL https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlintignore -o ./.markdownlintignore`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
- Final security gate was skipped intentionally because this session changed only prompt Markdown and trace documentation. No code, infrastructure, runtime configuration, or other executable artifact was modified, and the orchestrator rule explicitly allows a documented skip for prompt-only and other non-executable changes.
