---
status: completed
created_at: 2026-04-16
files_edited:
  - agent/security.md
rationale:
  - require validation before user-facing escalation of security findings
  - keep the primary security agent limited to review documentation and read-only research subagents plus security-specialist
supporting_docs:
  - agent/orchestrator.md
  - agent/security.md
  - substrate/traces/status/2026-04-16-security-policy-tuning-workspace-state.md
---

# Summary of changes

- Updated `agent/security.md` so the main security agent writes only review files, never operation records.
- Tightened `agent/security.md` subagent permissions to read-only research agents plus `security-specialist`.

# Technical reasoning

The previous workflow surfaced possible vulnerabilities too early. That made user-facing alerts weaker because the issue could still be a false positive or an unverified suspicion. The updated flow now forces validation first and user escalation second.

The primary `security` agent also needed a cleaner documentation boundary. Since its job is to discover and validate vulnerabilities, review traces are the right artifact. Operation records would add noise and overlap with orchestrator-owned workflow records.

Subagent scope was also tightened so the main `security` agent stays focused on security execution and read-only analysis rather than broader operational delegation.

# Impact assessment

- The main `security` agent now has a cleaner artifact model: review files only, and only when there is a meaningful finding state to document.
- Security investigations should now stay within the intended delegation boundary of read-only research agents plus `security-specialist`.

# Validation steps

- Read the current `agent/security.md` and `agent/orchestrator.md` before delegating changes.
- Reviewed the resulting diffs to confirm the validation-before-warning flow and review-only documentation model.
- Verified `general` remained available to `orchestrator` after the follow-up correction.
- Synced markdownlint config and ran:
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
