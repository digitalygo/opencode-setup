---
name: mycelium-plan
description: "Authoring guidance for Mycelium implementation plans: immutable planner baselines with an orchestrator-owned execution ledger"
---

# Mycelium plan authoring

Use this guidance when you write implementation plans under `substrate/traces/plans/`. A plan is one living Markdown document: it starts as the planner's research-backed baseline and, when execution begins, the orchestrator adds a concise execution ledger to that same document. It captures findings, divides complex problems into step-by-step procedures, and documents constraints, boundaries, and dependencies before any code changes happen.

## What plans are

Plans preserve two distinct records in one file:

- The **planner baseline** is immutable evidence of the original research, hypotheses, proposed work, predicted files and tests, risks, constraints, and rationale.
- The **execution ledger** is an orchestrator-owned, append-only record of material implementation evidence, decisions, gate outcomes, and closure.

Do not create a separate execution file or rewrite the planner baseline after work reveals new facts. Later discoveries belong in execution checkpoints and the plan-variation ledger, where they remain comparable with the original prediction.

Capture all findings and explain how to assess the task, break the problem into a step-by-step procedure, and include useful implementation information: cited websites, verified constraints, and boundaries of the task. Every plan must explain why the chosen phase sequence is the right approach.

## When to write a plan

- A non-trivial task requires multiple steps or agents to complete.
- Decisions about architecture, migration, or tooling need explicit documentation before work starts.
- Trade-offs and risks need to be stated before implementation commits to a path.
- The work needs a durable, resumable execution ledger and closure evidence.

Skip plans for trivial edits, single-line fixes, or already well-understood simple tasks.

## File naming

Use this format:

```text
substrate/traces/plans/YYYY-MM-DD-description.md
```

- `YYYY-MM-DD` is today's date.
- `description` is a brief kebab-case summary.

If you need to write documentation under `docs/` or `tmp/` instead of `substrate/traces/plans/`, follow the repository guidelines in `AGENTS.md`, `.github/CONTRIBUTING.md`, directives, and expectations.

## Lifecycle and ownership

The lifecycle values are `draft`, `ready-for-execution`, `in-progress`, `blocked`, `completed`, and `cancelled`.

- The planner creates the document, completes the planner baseline, creates empty execution-ledger sections, sets the initial status to `ready-for-execution`, and stops.
- The planner does not start execution, write execution checkpoints, alter an execution snapshot, record gate outcomes, or create an operation record.
- The orchestrator is the only agent that updates the plan after execution starts. Subagents return evidence to the orchestrator; they do not update the plan.
- The orchestrator keeps the current execution snapshot current, appends material entries, and closes the document after independently verified work and gates complete.

A planner may correct its own draft before handoff. Once the status is `ready-for-execution`, preserve the baseline. If execution exposes an error in it, append a variation with evidence rather than silently revising the original.

## Required frontmatter

Every new plan must use this frontmatter. Fill values that are known at planning time and retain the fields throughout execution.

```yaml
---
document_type: mycelium-plan
plan_id: YYYY-MM-DD-description
status: ready-for-execution
created_at: YYYY-MM-DD
planner: planner
baseline_version: 1
execution_owner: orchestrator
execution_started_at: null
last_updated_at: YYYY-MM-DD
---
```

The orchestrator updates `status`, `execution_started_at`, and `last_updated_at` as execution progresses. `baseline_version` identifies the frozen planner baseline and must not be reused to conceal a changed prediction.

## Required body structure

Use the following structure for every new plan. Keep the headings even when a section is initially empty so the orchestrator can resume in the same document without creating a parallel record.

```markdown
# Plan title

## Current execution snapshot

- **Status:** Ready for execution.
- **Baseline identity:** `plan_id`, baseline version, and planner handoff date.
- **Execution baseline:** Not started.
- **Active phase:** Phase 1: phase name.
- **Last verified checkpoint:** None.
- **Last successful checks:** None.
- **Open blockers:** None.
- **Required approvals and gates:** List known approval points and required gates.
- **Next action:** Orchestrator validates this plan and records the execution baseline.

## Planner baseline

### Problem statement

### Research and evidence

### Hypotheses, decisions, and rationale

### Planned phases

#### Phase 1: phase name

- **Objective:** Intended result.
- **Planner predictions:** Expected files, behavior, dependencies, risks, and constraints.
- **Proposed steps:** Ordered work the planner expects the executor to perform.
- **Predicted verification:** Commands, tests, review, or observable checks and why they prove this phase.
- **Completion criterion:** Evidence that should permit independent completion verification.

## Execution ledger

### Ledger rules

### Phase 1 execution checkpoints

## Plan-variation ledger

## Closure evidence

### Final outcome

### Quality and security evidence

### Operation record
```

The planner fills every planner-baseline subsection, including each phase's predictions, proposed steps, predicted scope, predicted verification, completion criterion, and rationale. It leaves the execution ledger, plan-variation ledger, and closure evidence without entries. The initial snapshot must make the next action and first phase clear while showing that no execution evidence exists yet.

## Evidence labels and checkpoint rules

Use these labels exactly enough to distinguish the source and strength of every material conclusion:

- **Planner prediction:** Frozen baseline expectation or rationale. It is not evidence that execution achieved it.
- **Subagent claim:** A reported result that remains untrusted until the orchestrator inspects it.
- **Orchestrator finding:** The orchestrator's conclusion after inspecting relevant source, diff, artifacts, or outputs.
- **Independently verified fact:** A command, test, review, artifact inspection, or other check the orchestrator performed independently, with its result and relevant limitation.

Execution checkpoints are append-only. If a statement needs correction, append a later correction that references the earlier checkpoint. Do not rewrite an old checkpoint, the variation ledger, or the planner baseline.

Record a checkpoint only for a material event:

- Validation or rejection of a planner hypothesis.
- A scope or implementation-decision change.
- A phase completion supported by independently verified artifacts and checks.
- A failed check, blocker, handoff, or resumption.
- A quality or security gate outcome.
- Final closure.

Do not turn the ledger into a raw tool-call log. Omit routine commands and intermediate chatter that do not change the verified state, decision, risk, scope, or next action.

A phase remains in progress until its required independent checks pass. A subagent's statement, a code diff, or an unreviewed command result alone cannot mark a phase complete.

## Execution checkpoint template

The orchestrator appends checkpoints under the relevant planned phase using this template. Update the current execution snapshot at the same time, but do not use it to replace ledger history.

```markdown
#### Checkpoint YYYY-MM-DDThh:mm:ssZ: concise event

- **Event:** Material event and phase status.
- **Planner prediction:** Reference the relevant frozen baseline item.
- **Subagent claims:** Claimed artifacts or results, or `None`.
- **Orchestrator finding:** What inspection established.
- **Independently verified facts:** Commands or checks, results, artifacts, and limitations.
- **Decision and impact:** Accepted decision, variance, approval state, and effect on later phases.
- **Next action:** Exact next phase, blocker resolution, handoff, or gate.
```

At execution start, the orchestrator verifies that the named plan follows this schema, records the plan identity and repository or session baseline, sets the status to `in-progress`, initializes the snapshot, and appends the first baseline-validation checkpoint. If the document is not schema-compliant, execution does not proceed until the plan is corrected in place without losing its original baseline.

## Plan-variation ledger

The variation ledger is the durable comparison point between the baseline and execution reality. Append an entry whenever verified evidence requires a material deviation from a planner prediction, phase sequence, predicted scope, or verification approach.

```markdown
### Variation V-001: concise title

- **Baseline reference:** Exact planner-baseline prediction or phase item. Do not alter it.
- **Discovered evidence:** Subagent claim, orchestrator finding, and independently verified fact.
- **Decision:** Accepted or rejected deviation and rationale.
- **Scope and downstream impact:** Files, behavior, phases, tests, risks, or gates affected.
- **Approval:** Existing user-approval gate status when requirements, scope, or observable behavior changes.
- **Resolution:** Checkpoint reference and resulting state.
```

Existing user approval requirements remain binding. The orchestrator must obtain the required approval before accepting a deviation that changes agreed scope, behavioral requirements, intended logic, or observable behavior. Evidence of a deviation does not itself authorize the change.

## Resume and handoff

On handoff or resume, the orchestrator reconstructs state from the current execution snapshot, the latest independently verified checkpoint, open blockers, required approvals and gates, and the exact next action. It then rechecks the worktree, repository baseline, relevant artifacts, and gate continuity before trusting the recorded state. A stale snapshot or an unverified subagent claim is not a completion fact.

Append a material handoff or resumption checkpoint that identifies what was rechecked and any changed state. Do not create a new plan or duplicate the ledger to resume execution.

## Quality, security, and closure evidence

Plan updates under `substrate/traces/`, including the living plan itself, remain outside frozen quality and security code-review packages. This exclusion does not remove the evidence requirement. The execution ledger and closure evidence must capture each applicable quality or security package identifier and hash, review mode and verdict, verification commands and results, and limitations or unavailable checks.

Close the plan only when every planned phase is independently verified or explicitly recorded as blocked or cancelled, all required approvals are resolved, and required quality and security outcomes are recorded. The final operation record follows the existing operation-record workflow. It links to the completed living plan and summarizes the outcome, rather than duplicating the plan's full evidence ledger.

## Plan vs research

| Aspect | Plan | Research |
| --- | --- | --- |
| Output | Frozen implementation baseline plus execution ledger | Findings and analysis |
| Audience | Orchestrator, implementers, and handoffs | Decision-makers |
| Actionability | Must be executable and resumable | May inform but not prescribe |
| File path | `substrate/traces/plans/` | `substrate/traces/research/` |
| Author | Planner baseline, then orchestrator ledger | Planner or quick agent |

## Available references

See existing plans under `substrate/traces/plans/` for task-specific examples. When creating a new plan, use this schema rather than copying an older pre-ledger structure.
