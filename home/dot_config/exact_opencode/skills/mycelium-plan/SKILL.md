---
name: mycelium-plan
description: Authoring guidance for Mycelium implementation plans — step-by-step procedures researched and written before execution
---

# Mycelium plan authoring

Use this guidance when you write implementation plans under `substrate/traces/plans/`. Plans bridge research and execution. They capture findings, divide complex problems into step-by-step procedures, and document constraints, boundaries, and dependencies before any code changes happen.

## What plans are

Plans are pre-execution documents that:

- Capture all research findings relevant to the task
- Break the problem into an ordered sequence of steps
- Document constraints, trade-offs, and explicit decisions
- Identify risks, dependencies, and verification checkpoints
- Reference supporting research, directives, and expectations

Plans must not be written after execution. They are the input to the orchestrator, not its output.

Capture all findings and explain how to assess the task, break the problem into a step-by-step procedure, and include useful implementation information: cited websites, verified constraints, and boundaries of the task. Every plan must explain why the chosen step sequence is the right approach.

## When to write a plan

- A non-trivial task requires multiple steps or agents to complete
- Decisions about architecture, migration, or tooling need explicit documentation before work starts
- Trade-offs and risks need to be stated before implementation commits to a path

Skip plans for trivial edits, single-line fixes, or already well-understood simple tasks.

## File naming

Use this format:

```text
substrate/traces/plans/YYYY-MM-DD-description.md
```

- `YYYY-MM-DD` is today's date
- `description` is a brief kebab-case summary

If you need to write documentation under `docs/` or `tmp/` instead of `substrate/traces/plans/`, follow the repository guidelines in `AGENTS.md`, `.github/CONTRIBUTING.md`, directives, and expectations.

## Frontmatter

No standardized frontmatter is required for plans. If you add frontmatter, use these optional fields:

```yaml
---
status: draft | in-review | completed
created_at: YYYY-MM-DD
---
```

## Body structure

Use these sections as a guide. Adjust to the task.

1. **Problem statement** — what problem the plan solves, why it exists now
2. **Decision summary** — explicit decisions made during planning, with rationale
3. **Target state** — what the result should look like after implementation
4. **Step-by-step procedure** — ordered, actionable steps with expected subagent assignments
5. **Risks and mitigations** — table of risks, impact, and mitigation strategy
6. **Success criteria** — verifiable checklist of what completion looks like
7. **Research references** — links to research docs, directives, expectations, and traces used

## Agent responsibility

Plans are written by the planner agent. The planner researches with subagents, writes the plan, and stops. The planner never executes implementation work. When the user is ready to implement, they switch to the orchestrator agent.

## Plan vs research

| Aspect | Plan | Research |
|--------|------|----------|
| Output | Ordered steps for execution | Findings and analysis |
| Audience | Orchestrator and implementers | Decision-makers |
| Actionability | Must be executable | May inform but not prescribe |
| File path | `substrate/traces/plans/` | `substrate/traces/research/` |
| Author | Planner agent | Planner or quick agent |

## Available references

See existing plans under `substrate/traces/plans/` for working examples of the format and depth expected.
