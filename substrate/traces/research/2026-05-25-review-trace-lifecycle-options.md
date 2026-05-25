# Review trace lifecycle options

## Scope

This research investigates how review documents are currently created and managed in `substrate/traces/reviews/`, why long-lived targets can accumulate many review files, and whether the repository should adopt an update-first lifecycle similar to operation records.

## Executive summary

The repository already solved this exact fragmentation problem for operation records. `skills/mycelium-operation/SKILL.md:33-35` makes reuse the default when new work extends the same decision, process, or feature, and `skills/mycelium-operation/SKILL.md:64-80` defines how to update a record without losing chronology. Review documents do not have an equivalent lifecycle. `skills/mycelium-review/SKILL.md:14-20` and the security agents tell writers when to create or skip a review file, but they never explain when to update one, how to append follow-up findings, or how to use the existing `superseded` status in practice. The result is visible in the wiki-agent review trail: the same target accumulated several separate review files over a few days. The best fit is not a full copy of the operation model, but a narrower reuse rule: update an existing review when the target and risk area overlap materially; create a new review when the target is different or the scope changes enough that merging would blur the audit trail.

## What I reviewed

- `skills/mycelium-review/SKILL.md:1-138`
- `skills/mycelium-operation/SKILL.md:1-88`
- `command/review.md:1-88`
- `agent/security.md:1-286`
- `agent/security-review-specialist.md:1-52`
- `agent/security-specialist.md:251-286`
- `agent/orchestrator.md:81-88`
- `substrate/traces/operations/2026-04-16-security-review-docs-standardization.md:1-48`
- `substrate/traces/operations/2026-04-16-security-auto-review-doc-rule.md:1-42`
- `substrate/traces/operations/2026-04-19-orchestrator-operation-record-reuse.md:1-70`
- `substrate/traces/operations/2026-05-05-mycelium-authoring-skills.md:68-224`
- `substrate/traces/reviews/2026-04-19-orchestrator-remote-script-exec-risk.md:1-35`
- `substrate/traces/reviews/2026-05-18-wiki-agent-permission-overreach.md:1-117`
- `substrate/traces/reviews/2026-05-19-wiki-agent-delegation-security.md:1-61`
- `substrate/traces/reviews/2026-05-20-wiki-ocr-security.md:1-45`
- Repository directory read of `substrate/`, which currently contains only `traces/`

## Findings

### 1. Operation records already have an update-first lifecycle

The repository treats operation records as the primary running audit trail for related work. `skills/mycelium-operation/SKILL.md:33-35` explicitly says to research existing records first and update an existing record instead of creating a new one when the work extends the same decision, process, or feature. `skills/mycelium-operation/SKILL.md:64-80` then defines the mechanics: keep `created_at`, add `updated_at`, extend metadata arrays, and append a labeled update section.

This policy was added deliberately to reduce trace fragmentation. `substrate/traces/operations/2026-04-19-orchestrator-operation-record-reuse.md:28-30` states that the prior gap encouraged fragmented traces and that reuse became the default to preserve decision continuity.

### 2. Review documents have creation rules but no lifecycle rules

Review guidance is strong on format and creation thresholds but silent on reuse.

- `skills/mycelium-review/SKILL.md:16-20` says to write reviews when findings exist and skip them for clean assessments or pure false positives.
- `agent/security-review-specialist.md:40-45` allows review files only for real or plausible vulnerabilities.
- `agent/security.md:81-84` says to create them for verified vulnerabilities and plausible findings needing validation.
- `agent/security-specialist.md:258-267` says to create a review when real vulnerabilities are found and skip clean or false-positive-only outcomes.
- `command/review.md:62-75` does the same for repository-compliance reviews.

None of these files defines an update protocol. There is no review equivalent of `skills/mycelium-operation/SKILL.md:64-80`.

### 3. The review schema contains `superseded` but does not explain how to use it

`skills/mycelium-review/SKILL.md:37-56` defines frontmatter with `status: draft | in-review | completed | superseded`, but it provides no rule for when a review should become `superseded`, how it should link to the newer review, or whether a follow-up should amend the existing file instead of creating a new one.

This makes `superseded` effectively dead metadata today. The schema hints at lifecycle awareness, but the workflow never activates it.

### 4. The current review trail already shows the crowding pattern

The wiki-agent history demonstrates the exact problem described in the user question.

- `substrate/traces/reviews/2026-05-18-wiki-agent-permission-overreach.md` reviews `agent/wiki.md` for permission and delegation overreach.
- `substrate/traces/reviews/2026-05-19-wiki-agent-delegation-security.md` reviews the same target again for delegated-search changes.
- `substrate/traces/reviews/2026-05-20-wiki-ocr-security.md` reviews the same target family again for OCR flow changes.

The 2026-05-20 follow-up partially compensates by adding a manual `# Prior findings status` section at `substrate/traces/reviews/2026-05-20-wiki-ocr-security.md:21-25`, but this is an ad hoc author choice, not a repository standard.

### 5. Review sprawl is more likely than operation sprawl by design

Operation records have a high bar for creation and a reuse mandate. Review files have a low bar for creation whenever findings exist and no reuse rule. That asymmetry means review directories will naturally grow faster than operation directories on long-lived targets.

The difference is structural:

- operations optimize for continuity of decision history;
- reviews optimize for documenting findings in the current assessment;
- only operations currently define how continuity should work over time.

### 6. A full operation-style reuse rule would be too broad for reviews

Operation records group work by decision, process, or feature. Reviews group findings by target and assessment scope. These are not identical containers.

For reviews, reusing an existing file only because the target is the same would sometimes reduce clarity. For example, prompt-permission overreach, delegated-source trust boundaries, and OCR supply-chain risk can all touch `agent/wiki.md`, but they are different risk families and may be reviewed by different agents over different change sets.

The reuse test for reviews therefore needs a tighter key than operations. Same target alone is not enough.

### 7. No directives or expectations currently govern this lifecycle

The repository currently has no `substrate/directives/DRC-*.md` or `substrate/expectations/EXP-*.md` files. Governance for review lifecycle lives only in agent prompts, command definitions, skills, and operational traces.

That means the policy can still be changed cleanly, but it also means there is no higher-level single-source rule yet for long-term review trace management.

## Analysis

The user's intuition is correct: the repository already has a proven pattern for reducing document sprawl, and reviews are the next place where the same class of problem appears. The right move is not to mirror operations exactly, but to borrow the same lifecycle concepts and adapt the correlation test.

The strongest reusable ideas from operations are:

- research existing related records before creating a new one;
- prefer a single narrative container when follow-up work extends the same thread;
- preserve chronology with `updated_at` and appended dated update sections;
- keep unrelated work in separate files when merging would reduce clarity.

For review documents, the missing piece is the thread key. A practical key would be:

- same `target`;
- overlapping `scope`;
- same risk family or same unresolved finding thread.

That model keeps useful historical continuity without collapsing unrelated findings into one oversized file.

## Recommendations

### Recommended policy

Adopt a review-thread lifecycle rather than a pure create-new-file lifecycle.

Before creating a new review file, the reviewer should research existing reviews and apply this decision tree:

1. If no prior review exists for the target, create a new file.
2. If a prior review exists for the same target and the new work is a follow-up on the same risk family, update that existing review.
3. If a prior review exists for the same target but the new work covers a materially different risk family or a much broader or narrower scope, create a new file.
4. If a new review fully replaces the older one, mark the old review `superseded` and link the replacement explicitly.

### Schema changes worth planning

If the repository adopts the policy above, the review schema should likely gain:

- `updated_at` for amended reviews
- `superseded_by` for old files that are replaced
- `reviewer` retention for the original file plus an update section label that names the follow-up reviewer when different

The body should also gain a standard appended section pattern similar to operations, for example:

- `# Update YYYY-MM-DD`
- summary of new findings or status changes
- finding-resolution status for earlier items
- validation notes for the follow-up pass

### Alternatives

#### Option A — Target-and-risk review threads

One active review file per target and risk family. This is the best balance between low clutter and high audit clarity.

#### Option B — Keep separate review files, but standardize supersession and indexing

Do not reuse review files. Instead, require every follow-up review to mark prior related files as `superseded` or `related`, and maintain an index file under `substrate/traces/reviews/` for discovery. This reduces navigational pain but not file count.

#### Option C — Fully mimic operations

Always update the existing review for the same target. This minimizes file count most aggressively, but it risks turning one file into a mixed bag of unrelated security and compliance findings. This is not the recommended option.

### Preferred direction

Option A is the best fit. It preserves the user's goal of keeping all past findings, reuses the repository's successful operation-record philosophy, and avoids forcing unrelated review narratives into one file.
