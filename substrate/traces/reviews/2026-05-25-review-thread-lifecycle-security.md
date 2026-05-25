---
status: completed
created_at: 2026-05-25
updated_at: 2026-05-25
reviewer: security-review-specialist
target: skills/mycelium-review/SKILL.md, command/review.md, agent/security.md, agent/security-review-specialist.md, agent/security-specialist.md
scope: prompt-level security review of review-thread lifecycle guidance; update, supersede, audit-integrity, and under-reporting risks only
supporting_docs:
  - skills/mycelium-review/SKILL.md
  - command/review.md
  - agent/security.md
  - agent/security-review-specialist.md
  - agent/security-specialist.md
---

# Summary

2 medium findings. Main risks: supersede flow can hide unresolved findings because replacement requirements are not explicit, and update criteria are broad enough to bury new vulnerabilities in old review threads. No raw secrets observed.

# Scope and methodology

Reviewed `git status --short`, targeted `git diff -- skills/mycelium-review/SKILL.md command/review.md agent/security.md agent/security-review-specialist.md agent/security-specialist.md`, full target files, and existing review files under `substrate/traces/reviews/` to decide whether this belonged to an existing thread. Treated `substrate/traces/research/2026-05-25-review-trace-lifecycle-options.md` as pre-existing baseline and not an implementation target. No Docker, scanner, network, or active tests run.

# Findings by severity

## Medium

### M1: supersede flow can hide unresolved findings

- **Location**: `skills/mycelium-review/SKILL.md:83-89`, `agent/security-review-specialist.md:42-44`, `agent/security-specialist.md:260-262`, `command/review.md:74-75`
- **Evidence**: `skills/mycelium-review/SKILL.md:83-89` says a replacement review can mark an older review `superseded` and set `superseded_by`, but does not require the replacement to copy every prior unresolved finding, prove each old finding is resolved, or append a supersession reason to the old body. `agent/security-review-specialist.md:44` weakens this further by saying to supersede when a new review "replaces" an older one, without the "fully replaces" qualifier used elsewhere. `agent/security-review-specialist.md:42` and `agent/security-specialist.md:260-262` also allow status changes during updates without explicit evidence gates.
- **Impact**: A mistaken or prompt-injected review agent can mark an older vulnerability report superseded while omitting an unresolved issue from the new file. Any workflow that filters out `status: superseded` then loses the open finding, causing audit tampering and dangerous under-reporting.
- **False-positive notes**: The phrase "fully replaces" in `skills/mycelium-review/SKILL.md:85` and `agent/security-specialist.md:262` implies restraint. Risk remains because no concrete replacement criteria, unresolved-finding carry-forward rule, or evidence requirement exists, and `agent/security-review-specialist.md:44` omits that qualifier.
- **Remediation**: Define supersede as allowed only when every prior finding is either verifiably resolved or copied into the replacement with same severity, status, evidence, and remediation. Require the new review to list all carried-forward findings and require the old review body to receive an append-only supersession note with date, reviewer, reason, and replacement path.

### M2: broad update criteria can bury new vulnerabilities in old threads

- **Location**: `skills/mycelium-review/SKILL.md:66-81`, `agent/security-review-specialist.md:40-43`, `agent/security.md:92`, `agent/security-specialist.md:258-262`, `command/review.md:64-75`
- **Evidence**: `skills/mycelium-review/SKILL.md:66-76` makes reviews thread documents and permits update when target, scope, and thread align; target can be a whole `repository`, and thread can be a broad `risk family` or compliance topic. `agent/security-review-specialist.md:42` repeats `same risk family or unresolved finding thread`, making `same risk family` enough when target and scope overlap. `agent/security.md:92`, `agent/security-specialist.md:258-262`, and `command/review.md:64-75` spread the same lifecycle into security and compliance workflows.
- **Impact**: A new independent vulnerability in the same repository and broad risk family can be appended to an older review instead of getting a new dated report. Users and downstream agents that look for fresh review files or review summaries may miss the new issue, reducing finding visibility and delaying remediation.
- **False-positive notes**: The decision tree also says to create a new file when merging would reduce clarity (`skills/mycelium-review/SKILL.md:78-81`). Risk remains because `repository` targets and `risk family` threads are broad, and the prompts prefer reuse before new files.
- **Remediation**: Limit updates to follow-up on an exact prior finding, exact target component, or explicitly named unresolved thread. Require a new review for any new vulnerability unless it validates or remediates a previously documented finding. If appending new findings remains allowed, require an index/frontmatter update that exposes new finding count, highest severity, and update date.

# Remediation timeline

1. **Immediate (medium)**: Add supersede gates that preserve or carry forward every unresolved finding before any review can be marked `superseded`.
2. **Immediate (medium)**: Narrow update rules so broad repository/risk-family matches cannot absorb new independent vulnerabilities.

# Validation notes

After remediation, re-read the five target files and confirm supersede requires full finding carry-forward or validated resolution, old review bodies receive append-only supersession notes, and update criteria require an exact prior finding or named unresolved thread. Confirm new independent vulnerabilities still produce new review files.

## Update: 2026-05-25 by security-review-specialist

### Prior finding status

- M1 (medium): resolved — `skills/mycelium-review/SKILL.md:83-95` now gates supersession on every prior finding being resolved with evidence or carried forward with severity, status, evidence, and remediation; `agent/security-review-specialist.md:44`, `agent/security-specialist.md:262`, and `command/review.md:76-80` mirror the gate and require an append-only supersession note.
- M2 (medium): resolved — `skills/mycelium-review/SKILL.md:72-81` now limits updates to exact prior findings, same exact target component in the same unresolved thread, or explicitly named unresolved threads, and requires a new review for new independent issues even in the same repository or broad risk family; `agent/security-review-specialist.md:42-43`, `agent/security-specialist.md:260-261`, `agent/security.md:92`, and `command/review.md:67-75` mirror the split.

### New findings

None. All prior findings are resolved, and no new security findings remain in the reviewed lifecycle guidance.

### New validation notes

Re-read the prior review, full current `skills/mycelium-review/SKILL.md`, `command/review.md`, `agent/security.md`, `agent/security-review-specialist.md`, and `agent/security-specialist.md`, plus existing review files under `substrate/traces/reviews/` for lifecycle placement. Ran `git status`, `git diff --stat`, and targeted `git diff`. No Docker, scanner, network, or active tests run.
