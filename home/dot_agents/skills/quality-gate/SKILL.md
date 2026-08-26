---
name: quality-gate
description: Incremental quality review methodology. Load when the orchestrator performs the quality review directly instead of delegating to the quality-gate subagent.
---

# Quality gate review

You are performing the quality review directly as orchestrator. Use exactly the same incremental, read-only contract as the dedicated `quality-gate` subagent. Review only the supplied delta since the last successful quality checkpoint, not the repository, full task requirements, architecture, global scope, or unrelated session work. Do not edit files, implement fixes, or create status or trace artifacts during the review.

Requirements, task completion, global scope, architecture, and general correctness remain orchestrator responsibilities outside this gate.

## Required quality package

Assemble a complete, frozen package containing:

- The repository root, session baseline, and quality cursor identity. The first review in a session covers the full session delta. Each later review identifies the immediately previous successful quality checkpoint.
- A frozen cursor-to-candidate binary diff and SHA-256 hash, or an immutable worktree-local artifact and its SHA-256 hash, with the freezing method stated.
- A complete delta file list, including additions, deletions, renames, and untracked files, excluding `substrate/traces/**`.
- A per-file classification: executable production code, test, configuration, documentation, generated artifact, or other non-executable content.
- A resolved rule manifest for every classified file.
- A behavior-to-test mapping for executable behavior, mapped-test results, coverage evidence or a coverage limitation, and the canonical verification command.
- For non-executable changes, `N/A` tests and coverage with native validation and a justification.
- Per-file line count, changed-line count, above-normal-range rationale where applicable, and separability assessment.
- Known limitations, exceptions, unavailable checks, and proof required for an out-of-scope canonical-suite failure.

Advance the quality cursor only after `PASS`. Leave it unchanged on `FAIL`, so the next review covers the prior failed delta and all corrections. If the cursor, package, hash, file list, or continuity is missing, stale, inconsistent, or untrustworthy, freeze a new full-session package before review. Do not recover missing evidence by broad repository inspection.

## Inspection boundary

Completely ignore `substrate/traces/**` and all of its content. Do not read it, include it in commands, or perform ignore checks on it.

Read only the supplied delta artifact, supplied affected files, supplied rule manifest, supplied mapped tests and verification output, and supplied line-count evidence. Keep all inspection calls bounded to those named inputs, except for the canonical verification command. Do not run repository-wide searches, broad diff discovery, unrelated tests, or exploratory audits. Missing, stale, or inconsistent evidence is a `FAIL`.

## Evaluation

Return `FAIL` when:

- An applicable supplied rule is missing, unclear, or violated.
- Executable behavior lacks suitable mapped tests, coverage evidence, or a passing mapped-test result.
- A newly introduced code comment lacks a repository-rule exception.
- A test was weakened, skipped, or deleted merely to pass.
- Non-executable content lacks native validation or justified `N/A` tests and coverage.
- The frozen delta, classification, test mapping, coverage evidence, or command output cannot be trusted.

A failing canonical suite is non-blocking only when the package proves every mapped delta test completed and passed and demonstrates that the remaining failure is outside the supplied delta. Return `PASS` with only an out-of-scope signal in that case. Otherwise, a relevant failure or incomplete mapped-test proof is a `FAIL`.

Use file length as a contextual maintainability control, not a hard cap. Production code normally falls in the 500 to 700 line range, while cohesive tests may reasonably approach 1000. Do not pass or fail from count alone, reduce coverage, or split cohesive fixtures or long inputs solely to reduce length. Fail only when the line-count and separability evidence show materially poor navigation or maintainability and a meaningful split by behavior or responsibility exists.

## Verdict format

Return only one of these forms:

```markdown
# PASS
```

Optionally add an `## Out-of-scope signals` section only for a demonstrated out-of-scope canonical-suite failure. Do not add generic advice.

```markdown
# FAIL

- `file:line`: violated evidence or rule. Minimum remediation: exact required correction.
```

Every failure needs concrete `file:line` evidence and the minimum remediation. Do not include requirement coverage, global-scope analysis, architecture review, general-correctness advice, or repository-wide recommendations.
