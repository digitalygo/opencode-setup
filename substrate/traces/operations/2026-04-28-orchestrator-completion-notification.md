---
status: completed
created_at: 2026-04-28
files_edited:
  - agent/orchestrator.md
  - substrate/traces/operations/2026-04-28-orchestrator-completion-notification.md
rationale:
  - add explicit audible success and error notifications for orchestrator completion states so the user gets immediate desktop feedback even when AFK
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - agent/orchestrator.md
---

# Summary of changes

- Added `## Task completion notification` section to `agent/orchestrator.md`, placed immediately after core workflow step 8.
- Success command: `canberra-gtk-play --id=complete` runs only when the assigned task is completed successfully and 100% done.
- Error command: `canberra-gtk-play --id=dialog-error` runs when user input is needed, a blocker prevents continuation, or the task is not 100% complete for any reason.
- Outside this operation record, no other files were modified. The new section is prompt-only with no runtime, code, or infrastructure impact.

# Technical reasoning

The orchestrator previously had no audible notification mechanism. When the user steps away (the AFK workflow in `## Autonomy and Urgency` explicitly encourages), there was no desktop-level signal to indicate completion or a blocking condition. The user had to manually check the terminal to know whether the orchestrator finished or needed input.

The two `canberra-gtk-play` invocations solve this by:

- Signaling success with a familiar "complete" sound when 100% done, letting the user return knowing work is finished.
- Signaling an error with a distinct "dialog-error" sound for three distinct non-success states: user input needed, a blocker halting progress, or incomplete work for any reason.

Both commands use standard system sound themes via libcanberra, which is commonly available on Linux desktop environments without additional dependencies.

No DRC or EXP files exist in the repository, so no directive or expectation compliance checks were needed.

# Impact assessment

- Orchestrator runs gain audible desktop notifications for completion and error states.
- The AFK workflow becomes more practical because the user gets an acoustic signal instead of needing to poll the terminal.
- No change to existing orchestrator behavior outside of the new notification step added after core workflow step 8.
- No other agents, prompts, or non-trace repository files are affected.

# Validation steps

- Read `agent/orchestrator.md` in full and confirmed the new `## Task completion notification` section appears correctly after core workflow step 8, before `## Autonomy and Urgency`.
- Reviewed `git diff -- agent/orchestrator.md` to verify only the intended 5-line addition was made and no other content shifted.
- Confirmed no DRC (`substrate/directives/`) or EXP (`substrate/expectations/`) files exist in the repository.
- Read `AGENTS.md` and `.github/CONTRIBUTING.md` to confirm no policy violation: the change is prompt/documentation-only, sentence-case headings are used, no comments were added, and the notification section uses direct second-person address consistent with the contribution style guide.
- Final security gate (core workflow step 7) was intentionally skipped because the change is prompt/documentation-only and non-executable. No code, IaC, runtime configuration, or executable artifact was modified. The orchestrator's own security-gate exception rule explicitly permits skipping the gate for documentation-only, trace-only, prompt-only, or otherwise non-executable changes, with documentation of the skip reason — which is satisfied here.
- Synced Markdown lint configuration and ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix` followed by the same command without `--fix`; both completed with zero reported errors.
