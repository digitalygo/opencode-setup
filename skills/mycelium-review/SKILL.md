---
name: mycelium-review
description: Unified authoring guidance for Mycelium review documents — covers security assessments and repository-compliance reviews in one schema
---

# Mycelium review authoring

Use this guidance when you write review documents under `substrate/traces/reviews/`. This schema unifies security reviews and repository-compliance reviews into one standard. Use the same format whether you are reviewing code for vulnerabilities or checking changes against contributing guidelines.

## What review documents are

Review documents capture findings from structured assessment of code, configuration, or repository changes. They group findings by severity, provide evidence, and recommend remediation.

## When to write a review

- Security assessment found one or more real or plausible vulnerabilities
- Repository-compliance review found violations of `.github/CONTRIBUTING.md` or other standards
- The parent agent explicitly requested review documentation

Skip when no findings exist. Do not write review files for clean assessments or pure false positives unless the parent agent requires it.

## File naming

Use this format:

```text
substrate/traces/reviews/YYYY-MM-DD-description.md
```

- `YYYY-MM-DD` is today's date
- `description` is a brief kebab-case summary of the target or finding type

## Frontmatter

Use YAML frontmatter with these fields:

```yaml
---
status: draft | in-review | completed | superseded
created_at: YYYY-MM-DD
reviewer: <agent-name>
target: <what was assessed>
scope: <boundaries of the assessment>
supporting_docs:
  - <logs, scan outputs in scan-reports/, related traces, or repro notes>
---
```

Required fields:

- `status` — one of `draft`, `in-review`, `completed`, or `superseded`
- `created_at` — date in YYYY-MM-DD format
- `reviewer` — name of the agent that conducted the review
- `target` — what was assessed (file, service, image, commit range)
- `scope` — boundaries of the assessment
- `supporting_docs` — array of references

Optional fields:

- `git_commit` — current HEAD or specified commit ref (use for compliance reviews)
- `branch` — current branch name (use for compliance reviews)
- `topic` — brief description e.g. "code style and naming review" (use for compliance reviews)
- `updated_at` — date of most recent append-only update in YYYY-MM-DD format
- `superseded_by` — path to the replacement review file when status is `superseded`

## Review lifecycle: reuse over new files

Reviews are thread documents, not one-shot reports. Before creating a new file, research existing reviews under `substrate/traces/reviews/` for related threads.

### Decision tree

Update an existing review only when follow-up work addresses one of:

1. **Exact prior finding** — you are validating or remediating a finding already documented in the existing review.
2. **Exact target component** — the same file, service, image, or named component as the existing review, and the work continues the same unresolved thread.
3. **Explicitly named unresolved thread** — the existing review body names a specific thread and the new work extends that thread directly.

Create a new review when:

- The target is new or different from all existing reviews, or
- The work introduces a new independent vulnerability or compliance issue not already documented in an open thread — even if it is in the same repository or broad risk family.

### Marking a review superseded

Supersede is allowed only when a new review fully replaces an older one and every prior finding is accounted for. Before superseding, confirm:

- **Resolved or carried forward** — every finding in the old review is either verifiably resolved (with evidence) or explicitly copied into the replacement with the same severity, status, evidence, and remediation.
- **Carry-forward listing** — the new review lists all carried-forward findings under a `## Carried-forward findings` section with origin path, original date, and preservation of severity and evidence.
- **Supersession note** — append an update section to the old review body with date, reviewer, reason, and path to the replacement. This note is append-only and lives in the body (not only frontmatter).

Then apply the frontmatter changes:

- Set the older review's status to `superseded`.
- Set `superseded_by` in the older review's frontmatter to the path of the replacement file.
- Mention in the new review that it supersedes the older file (e.g., "Supersedes `substrate/traces/reviews/YYYY-MM-DD-old-review.md`").

### How to update an existing review

When updating an existing review:

1. **Preserve the frontmatter**: keep the original `created_at` and set or update `updated_at` to today's date.
2. **Preserve existing content**: do not delete or rewrite prior findings; the body is append-only.
3. **Append an update section** at the bottom of the body with the following structure:

```markdown
## Update: YYYY-MM-DD by <reviewer>

### Prior finding status

- Finding 1 (severity): resolved | unresolved | partially resolved — brief note
- Finding 2 (severity): resolved | unresolved | partially resolved — brief note

### New findings

(reuse the finding format from the original body: location, evidence, impact, false-positive notes, remediation)

### New validation notes

How to retest and confirm fixes for the new findings.
```

If no prior findings remain, summarize that all prior findings are resolved before documenting new ones.

This lifecycle applies equally to security reviews and compliance reviews.

## Body structure

Every review must include these sections:

### 1. Summary

High-level findings count by severity and key takeaways. One paragraph.

### 2. Scope and methodology

What was tested, tools used, time window, and any limitations.

### 3. Findings by severity

Group findings as: critical, high, medium, low, informational. For each finding include:

- **Location** — exact file path and line numbers
- **Evidence** — request, response, output, or configuration snippet
- **Impact** — what an attacker could achieve (security) or what standard is violated (compliance)
- **False-positive notes** — verification steps taken and remaining uncertainty
- **Remediation** — specific fix with code or configuration examples

For compliance reviews, the location must reference the specific section of `.github/CONTRIBUTING.md` or other standards being violated.

### 4. Remediation timeline

Prioritized fix order with severity justification.

### 5. Validation notes

How to retest and confirm fixes after remediation.

## Review communication style

Read and follow `skills/caveman-review/SKILL.md` for terse, actionable review language. Each finding should use the format: location, problem, fix.

Use severity prefixes when findings vary:

- `🔴 bug:` — broken behavior, will cause incident
- `🟡 risk:` — works but fragile
- `🔵 nit:` — style, naming, micro-optim. Author can ignore
- `❓ q:` — genuine question, not a suggestion

Drop throat-clearing phrases and hedging. State the fix concretely.

Exception to terse mode: critical security findings (CVE-class bugs) require full explanation with references, as per caveman-review auto-clarity rules, plus architectural disagreements and onboarding contexts.

## Security-specific rules

When the review is a security assessment:

- Trace trust boundaries, auth and authz, input handling, injection risk, secret exposure, supply-chain risk, unsafe shell or Docker usage, network risk, SSRF, XSS, SQLi, path traversal, deserialization, crypto misuse, and config flaws as applicable
- Mark likely false positives and separate them from real risk
- Never include raw secrets, credentials, or tokens in review files; redact sensitive values
- State your limits clearly: if you ran no Docker, scanner, network, or active tests, say so

## Compliance-specific rules

When the review is a repository-compliance check:

- Cross-reference every finding against specific sections of `.github/CONTRIBUTING.md` or `AGENTS.md`
- Check code style, naming conventions, no-comments policy, Docker standards, API design, and commit message format
- Run `git status` and `git diff` to assess the working tree before reviewing
- If `substrate/traces/` does not exist, check for legacy `thoughts/` directory and report that the repository needs migration before creating review files

## Output expectations

- Do not expose secrets, tokens, or credentials
- State tool choices and why they fit the target
- Never claim the work is safe while verified findings remain open
- Use structured output, group findings by severity

## Available references

See existing reviews under `substrate/traces/reviews/` for working examples. See `skills/caveman-review/SKILL.md` for terse review communication style.
