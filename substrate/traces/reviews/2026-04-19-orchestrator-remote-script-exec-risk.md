---
status: completed
created_at: 2026-04-19
updated_at: 2026-06-15
reviewer: security-specialist
target: agent/orchestrator.md
scope: session-modified prompt files and generated traces in this repository only
supporting_docs:
  - agent/orchestrator.md
  - substrate/traces/status/2026-04-19-orchestrator-operation-reuse-workspace-state.md
  - substrate/traces/operations/2026-04-19-orchestrator-operation-record-reuse.md
---

# Summary

1 high finding. No secrets found in repo scan.

# Scope and methodology

Reviewed modified prompt files and traces in scope. Checked `git diff`, scanned repo with `gitleaks`, `semgrep`, and `trivy fs`, and read final file contents directly.

# Findings by severity

## High

- 🔴 `agent/orchestrator.md:20-21` — auto-runs remote `curl | bash` bootstrap from GitHub `main` on every orchestrator start; remote code execution and supply-chain risk. Fix: remove auto-exec, pin update logic to a reviewed commit or signed artifact, and require explicit user approval before any remote bootstrap.

# Remediation timeline

1. Remove auto-executed remote bootstrap.
2. Replace with pinned, verified update step.
3. Keep output visible; do not hide failures.

# Validation notes

Retest by re-reading `agent/orchestrator.md` and confirming no prompt path auto-executes remote shell. Re-run secret and config scans after the fix.

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- Remote bootstrap auto-exec (high): unresolved — the prompt no longer runs `curl | bash`, but `home/dot_config/exact_opencode/agent/orchestrator.md:26` still auto-runs `chezmoi update || chezmoi init --apply digitalygo/opencode-setup` at every orchestrator start and still says output may be ignored.

### New findings

No new independent finding. The same high-risk auto-update thread remains open under the chezmoi migration.

#### High: H1 unresolved: orchestrator still auto-applies unpinned remote configuration

- **Location**: `home/dot_config/exact_opencode/agent/orchestrator.md:26`, `README.md:10`, `README.md:16`, `.chezmoiroot:1`
- **Evidence**: `home/dot_config/exact_opencode/agent/orchestrator.md:26` instructs the agent to run `chezmoi update || chezmoi init --apply digitalygo/opencode-setup` before doing user work and permits ignoring output. `README.md:10` documents `chezmoi init --apply digitalygo/opencode-setup` as the install path, `README.md:16` documents `chezmoi update` for later updates, and `.chezmoiroot:1` makes `home/` the chezmoi source root.
- **Impact**: Agent startup can fetch and apply unpinned remote state without current-session user approval. `chezmoi update` uses whatever chezmoi source the user has configured, so users with an existing dotfiles source can have unrelated dotfiles updated/applied. Chezmoi apply can also run source scripts if present in the configured source. A compromised upstream branch, wrong local chezmoi source, or malicious future source entry can change agent prompts/config or execute local update logic before review.
- **False-positive notes**: This is lower risk than the prior direct `curl | bash` because the current source tree does not add a `run_` script in the reviewed diff. Risk remains because the prompt still auto-applies remote mutable state, does not pin a commit or signed release, does not verify the source repository/branch, and hides failures by allowing ignored output. No chezmoi command, network fetch, Docker, scanner, or active test was run.
- **Remediation**: Remove automatic update/apply from the orchestrator prompt. Make updates a user-run command with visible `chezmoi diff` first. If startup freshness is mandatory, verify the chezmoi source path and remote, pin to a reviewed tag or commit, disallow scripts, require explicit current-session approval before apply, and never ignore output.

### New validation notes

After remediation, re-read `home/dot_config/exact_opencode/agent/orchestrator.md` and confirm no session-start prompt runs `chezmoi update`, `chezmoi init --apply`, remote shell, or any other remote apply path automatically. Confirm update docs require preview and user approval before apply.

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- H1 auto-apply on session start (high): resolved — `home/dot_config/exact_opencode/agent/orchestrator.md:26` now forbids `chezmoi update`, `chezmoi init --apply`, and any other automatic self-update during session start or user work. It requires an explicit user request, visible `chezmoi diff`, explicit confirmation before `chezmoi update`, and visible output.

### New findings

No new findings in this thread. `README.md:10` and `README.md:16` still document user-run install/update commands, but no reviewed agent prompt now auto-applies them on session start.

### New validation notes

Re-check agent prompts for `chezmoi update`, `chezmoi init --apply`, `curl | bash`, and hidden-output update logic before closing future remediation passes. No Docker, scanner, network, chezmoi command, or active test was run in this follow-up.
