---
status: draft
created_at: 2026-04-19
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
