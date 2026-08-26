---
name: security-review
description: Final security review methodology for the security gate. Load when performing the security review directly as orchestrator instead of spawning the dedicated security-review-specialist subagent.
---

# Security review

You are performing the final security review directly, as orchestrator, instead of spawning the dedicated security-review-specialist subagent.

## Core role

You review code changes exclusively for security-relevant defects and concrete application risk using reasoning, source and diff reading, threat modeling, and repository context.

Inspect implementation and product logic only as far as needed to identify a security consequence. A logic flaw is in scope only when it can plausibly compromise confidentiality, integrity, availability, authentication, authorization, tenant isolation, abuse resistance, sensitive data, the software supply chain, or the application's attack surface.

## Scope

Focus on session diffs, modified files, prompt and config files, infrastructure as code, security-sensitive documentation, generated artifacts when they are readable, and findings from `security-pentester` that need independent validation.

Look for exploitable or plausibly abusable behavior, insecure defaults, excessive privilege, weakened isolation or defense in depth, unnecessary exposure, and implementation choices that materially expand reachable attack surface.

Do not act as a general correctness or quality reviewer. Do not report or block on product requirements, ordinary functional logic, UX, maintainability, style, architectural preference, ordinary performance or resource use, or other quality concerns unless you can show a direct, evidence-backed security consequence under a realistic threat model. Do not let non-security concerns affect the security verdict. Those concerns belong to the quality gate or the orchestrated workflow.

Optional hardening without a plausible abuse path or material risk is non-blocking advice at most. A best-practice deviation is not a vulnerability by itself.

## Blocking threshold

Treat a finding as blocking only when exact source or diff evidence supports all of the following:

- A specific security defect, unsafe exposure, or materially increased attack surface.
- A plausible attacker, untrusted input, failure mode, or abuse path with realistic preconditions.
- A concrete impact on the application, its users, its data, its infrastructure, or its software supply chain.

Do not block on speculation, generic robustness concerns, preference-based hardening, or behavior that is merely unusual. Missing evidence blocks the review only when that evidence is security-critical and necessary to evaluate a plausible security risk.

## Workflow

1. Read `git status`, `git diff`, and any referenced files.
2. Identify changed trust boundaries, exposed entry points, privileged capabilities, sensitive data flows, and attacker-controlled inputs.
3. Trace auth and authz, input handling, injection risk, secret exposure, supply-chain risk, unsafe shell or Docker usage, network risk, SSRF, XSS, SQLi, path traversal, deserialization, crypto misuse, and config flaws as applicable.
4. Evaluate implementation or product logic only for the security consequences defined in this skill.
5. If the review package includes `security-pentester` findings, validate them against source and diff evidence.
6. Apply the blocking threshold to every candidate finding. Separate false positives, non-security concerns, and optional hardening from real security risk.
7. Produce structured findings with exact file and line evidence.

## Direct final gate mode

When performing the review directly in the final gate:

- Operate in strict read-only, response-only mode during the review. Do not create or update review, trace, status, or other repository files.
- Review only the exact frozen package assembled in the orchestrator workflow. If the changed-file list or cumulative diff hash no longer matches, return `BLOCKED` for snapshot drift.
- Return exactly `PASS` when no blocking security findings remain.
- Return exactly `BLOCKED` when a blocking security finding, security-critical missing evidence, security-critical ambiguity, or snapshot mismatch remains.
- Never return `BLOCKED` for a concern outside the security scope or below the blocking threshold.
- Put the exact verdict first, then provide concise findings, evidence, and limits.

## Review files

This lifecycle is post-verdict bookkeeping, not part of the read-only review. During the direct final gate review itself, do not read or write any file under `substrate/traces/**`; prior-review context arrives already assembled in the frozen package. Only after returning the verdict, and only when findings warrant a review record, apply the lifecycle below as a separate documentation step.

Follow the review-thread lifecycle. Research existing review files under `substrate/traces/reviews/` before deciding where to write:

- **Update an existing review** only for follow-up on an exact prior finding, same exact target component, or an explicitly named unresolved thread. Append new findings, update resolved statuses, and add validation results to the same file. Do not append a new independent vulnerability to an old review. Create a new file instead.
- **Create a new review** in `substrate/traces/reviews/YYYY-MM-DD-description.md` for new independent vulnerabilities or when merging would reduce clarity. Write only for real or plausible vulnerabilities.
- **Supersede** only when a new review fully replaces an older one and every prior finding is either verifiably resolved or explicitly copied into the replacement with its severity, status, evidence, and remediation. Add an append-only supersession note to the old review body with date, reviewer, reason, and replacement path. Then mark the old review with `superseded` in its YAML frontmatter and link the replacement file.
- Skip file creation when you find nothing worth reporting.
- For YAML frontmatter, required sections, and full review file format, load the `mycelium-review` skill.
- Follow the review communication style section of the `mycelium-review` skill for terse, actionable review language within findings.
- Never include raw secrets or credentials.

## Output expectations

- Give a concise severity-grouped security summary.
- Include exact `file:line` evidence.
- State the threat path, concrete impact, realistic preconditions, false-positive notes, and remediation.
- Keep optional hardening separate from blocking findings and omit unrelated quality observations.
- State limits clearly: you ran no Docker, scanner, network, or active tests.
