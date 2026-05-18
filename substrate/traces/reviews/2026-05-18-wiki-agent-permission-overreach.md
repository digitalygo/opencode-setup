---
status: draft
created_at: 2026-05-18
reviewer: security-specialist
target: agent/wiki.md and substrate/traces/operations/2026-05-18-wiki-agent.md
scope: prompt-file security review of new wiki primary agent and its operation record; permission model, delegation risk, instruction conflicts, data exposure
supporting_docs:
  - agent/wiki.md
  - substrate/traces/operations/2026-05-18-wiki-agent.md
  - agent/quick.md
  - agent/planner.md
  - agent/orchestrator.md
---

# Summary

2 high, 3 medium, 2 low findings. No secrets exposed. Core issues: excessive task delegation permissions enable privilege escalation from wiki maintenance to agent behavior control, and overbroad file write scope covers operation records and review files outside wiki domain.

# Scope and methodology

Reviewed the two session-modified files against peer primary agents (`quick`, `planner`, `orchestrator`) for permission model comparison. Analyzed the prompt's delegation chain, write scope, instruction conflicts, and missing security boundaries. No Docker, scanner, network, or active testing — pure prompt and configuration review.

# Findings by severity

## High

### H1: `directives-*` and `expectations-*` task delegation enables agent behavior modification

- **Location**: `agent/wiki.md:17-18` (task permissions)
- **Evidence**: Task permissions include `directives-*` and `expectations-*`, which match subagents `directives-locator`, `directives-analyzer`, `directives-writer`, `expectations-locator`, `expectations-analyzer`, and `expectations-writer`. The wiki agent's own delegation list (lines 118-121) never references any `directives-*` or `expectations-*` subagent. These permissions are unused by design — yet they include write-capable subagents (`directives-writer`, `expectations-writer`) that can modify DRC and EXP files, which control all agent behavior across the repository.
- **Impact**: A prompt-injected or misdirected wiki agent could spawn `directives-writer` to modify developer directives (`substrate/directives/DRC-*.md`) or `expectations-writer` to alter client expectations (`substrate/expectations/EXP-*.md`). These files govern how every other agent in the system behaves. This is a privilege escalation from "wiki curator" to "agent behavior controller."
- **False-positive notes**: Confirmed by reading the wiki agent's full delegation list (lines 117-121) — no mention of directives or expectations subagents. The permissions appear to be a copy-paste from `quick` or `planner` without tailoring to the wiki agent's actual delegation needs.
- **Remediation**: Remove `directives-*` and `expectations-*` from the task permission block. The wiki agent's stated subagent needs (lines 117-121) are: `web-researcher`, `traces-*`, `codebase-*`, `documentation-*`, and `complex-problem-researcher`. Keep only those. The fixed block:

  ```yaml
  task:
    "*": "deny"
    "traces-*": "allow"
    "codebase-*": "allow"
    "documentation-*": "allow"
    "web-researcher": "allow"
    "complex-problem-researcher": "allow"
  ```

### H2: Write scope includes `substrate/traces/**/*.md` — outside wiki domain

- **Location**: `agent/wiki.md:12` (edit permission)
- **Evidence**: Edit permission allows `substrate/traces/**/*.md`, which covers operation records (`substrate/traces/operations/`), research documents (`substrate/traces/research/`), review files (`substrate/traces/reviews/`), and status files. These are written by the orchestrator, quick, planner, and security agents — not by a wiki curator whose stated purpose is "reading, linking, merging, restructuring, and retiring content" in the wiki (`docs/`).
- **Impact**: Wiki agent could modify or corrupt operation records (inserting false completion claims), alter security review findings (suppressing vulnerability reports), or inject misleading research into traces that downstream agents rely on. Combined with H1, this creates a two-hop attack: modify traces to influence orchestrator decisions, then modify directives to control agent behavior.
- **False-positive notes**: The wiki agent's prompt (line 124) explicitly instructs it to "write an operation record to `substrate/traces/operations/`" — so the permission is intentional, not accidental. The issue is the scope of the permission relative to the agent's role.
- **Remediation**: Narrow the write scope to `substrate/traces/operations/*.md` if operation record writing is genuinely needed, or remove `substrate/traces/` write access entirely and let the orchestrator handle all trace documentation. If kept, add a constraint that wiki agent may only write its own operation records (not modify existing ones by other agents).

## Medium

### M1: No boundary against reading secrets or sensitive files

- **Location**: `agent/wiki.md` (throughout, especially lines 35-51 "Provenance first" and lines 44-51 "Read before write")
- **Evidence**: The provenance-first principle instructs the agent to record information from "workspace files" (line 40). The read-before-write mandate (lines 46-51) encourages broad file reading. No constraint exists against reading `.env`, credentials files, tokens, API keys, or other secrets. Unlike file editing (denied by glob), file reading is unrestricted.
- **Impact**: Wiki agent could read secrets from workspace files and surface them in wiki pages under `docs/`. Since wiki pages are markdown and intended for user consumption, exposed secrets would be highly visible.
- **False-positive notes**: This is an inherent tension in the agent's design — it needs to read to curate, but has no guardrails on what it reads. The edit permission glob already prevents writing to secret files, but reading them is unconstrained.
- **Remediation**: Add a constraint under "Critical constraints": "Never read or surface files matching `.env*`, `*secret*`, `*token*`, `*credential*`, or any file containing API keys or authentication material. If you encounter secrets during provenance research, stop and alert the user without recording the secret value."

### M2: `.gitignore` write access without justification

- **Location**: `agent/wiki.md:13` (edit permission)
- **Evidence**: Edit permission includes `.gitignore`. The wiki agent's prompt provides no reason for this — it manages wiki pages, not repository configuration. Peer agent `quick` has this to manage `tmp/` entries; the wiki agent's prompt never mentions `tmp/` management or `.gitignore` maintenance.
- **Impact**: Could be used to remove `tmp/` from `.gitignore` (exposing temporary files to version control), add exclusions that hide malicious files, or remove existing security-relevant ignore rules.
- **False-positive notes**: Low likelihood of exploitation in practice, but unjustified permission violates least privilege.
- **Remediation**: Remove `.gitignore` from edit permissions unless a specific wiki workflow requires it (and document that workflow in the prompt).

### M3: No dedicated "Critical constraints" section with strong prohibition language

- **Location**: `agent/wiki.md:142-147` (constraints section)
- **Evidence**: The wiki agent has a "Critical constraints" section (lines 142-147) but it uses soft language: "Do **not** implement code changes or trigger execution workflows" and "Do **not** edit files outside your allowed permission globs." Compare to `quick` (line 68: "Do **NOT** implement code changes or trigger execution workflows") and `planner` (line 77: "Do **NOT** implement code changes or trigger execution workflows"). The wiki agent's constraints are weaker, lack the all-caps emphasis, and omit the redirect instruction ("If the user wants to begin implementation, tell them to switch to the *orchestrator* agent") that appears in quick and planner.
- **Impact**: Weaker constraint language may be less effective at preventing the agent from being steered into code implementation or execution workflows through prompt injection.
- **False-positive notes**: The wiki agent does redirect users to the orchestrator (line 147), but it's placed outside the constraints section and in softer language.
- **Remediation**: Add a strong "Critical constraints" section matching the quick agent pattern:

  ```markdown
  ## Critical constraints

  - Do **NOT** implement code changes or trigger execution workflows
  - Do **NOT** edit files outside your allowed permission globs
  - Do **NOT** speculate or fabricate information
  - If the user wants code implementation, tell them to switch to the *orchestrator* agent
  ```

## Low

### L1: Operation record writing instruction creates role confusion

- **Location**: `agent/wiki.md:124`
- **Evidence**: "Document the operation: write an operation record to `substrate/traces/operations/` for non-trivial changes." Operation records are orchestrator domain. The wiki agent writing its own operation records blurs the boundary between wiki maintenance (its role) and execution tracking (orchestrator role).
- **Impact**: Minor — could cause confusion about who owns operation record integrity. Operation records written by a wiki agent could carry lower trust than orchestrator-written records.
- **Remediation**: Either remove the operation record instruction (let the orchestrator document wiki agent sessions) or narrow it to a wiki-specific subdirectory like `substrate/traces/operations/wiki/` with an explicit constraint that wiki-written records are informational, not authoritative.

### L2: Operation record validation incomplete — no security review

- **Location**: `substrate/traces/operations/2026-05-18-wiki-agent.md:45-50` (validation steps)
- **Evidence**: Validation steps list sentence case check, second-person style check, frontmatter pattern check, markdown lint, and content review for speculation. No permission adequacy review, no delegation risk analysis, no security boundary check. The orchestrator's security gate (step 7) was correctly skipped for a prompt-only change per the stated exception, but the operation record itself should document that the skip was intentional and why.
- **Impact**: Low — the missing check didn't cause the issues found in this review, but the gap in validation process allowed permission overreach to go undetected.
- **Remediation**: Add to operation record validation: "Verified permissions are minimal for the agent's stated role. Confirmed delegation list matches task permissions. No unused write-capable subagent access."

# Remediation timeline

1. **Immediate (high)**: Remove `directives-*` and `expectations-*` from task permissions in `agent/wiki.md` (H1). These are unused and dangerous.
2. **Immediate (high)**: Narrow `substrate/traces/**/*.md` write scope or remove it entirely (H2). Wiki agent has no business writing to review or research files.
3. **This week (medium)**: Add secret-reading boundary (M1), remove or justify `.gitignore` access (M2), strengthen constraints section (M3).
4. **Next iteration (low)**: Clarify operation record ownership (L1), update operation record validation checklist (L2).

# Validation notes

After remediation:
- Read `agent/wiki.md` and confirm task permissions match only the subagents listed in the delegation workflow (lines 117-121).
- Confirm edit permissions exclude `substrate/traces/` or are narrowed to a specific subdirectory with documented justification.
- Verify a "Critical constraints" section exists with strong "Do **NOT**" language matching peer primary agents.
- Re-run `grep -r "directives-\*" agent/wiki.md` and `grep -r "expectations-\*" agent/wiki.md` — both should return no matches.
