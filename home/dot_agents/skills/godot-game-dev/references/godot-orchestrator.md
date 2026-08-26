# Godot orchestrator workflow

## Purpose

Coordinate a complete game build, major rebuild, or substantial extension that spans architecture, gameplay, assets, and visual validation.

Follow the version policy in `../SKILL.md`.

## When to use this

- The requester wants a complete game built.
- A major rebuild changes architecture, gameplay, and presentation together.
- A substantial extension needs resumable coordination across multiple stages.

## When not to use this

- A narrow engine API question.
- Screenshot review only.
- One isolated gameplay bug.
- A small change that the existing repository workflow can handle directly.

## Stage-loading rule

Load a stage reference only when reaching that stage. The stage names below are reference workflows, not callable subagents.

## Persistent state policy

Use the repository's existing planning and architecture documents when available. For a new full-game workflow, create only the files that materially help the project:

- `PLAN.md` for tasks, status, and verification criteria.
- `STRUCTURE.md` for architecture, scenes, scripts, signals, and build order.
- `ASSETS.md` when the project has a substantial asset inventory.
- `MEMORY.md` only for project-local discoveries that are not better captured by code, tests, or maintained documentation.
- `reference.png` only when a concrete visual target exists or is required.

Do not create these files for narrow or incremental work by default.

## Pipeline

```text
request
  -> scope and resume check
  -> optional visual target
  -> decomposition
  -> optional scaffold
  -> optional asset planning
  -> implementation
  -> runtime capture when relevant
  -> visual QA when relevant
  -> fix, replan, or finish
```

## Resume rule

When persistent state exists:

1. Read the repository instructions and current project version.
2. Read `PLAN.md` if present.
3. Read `STRUCTURE.md` if present.
4. Read `ASSETS.md` and `MEMORY.md` only when relevant.
5. Verify that the documented state still matches the current worktree.
6. Resume from the first incomplete, still-valid task.

## Fresh-run workflow

1. Confirm scope, target platforms, engine version policy, inputs, and acceptance criteria.
2. Establish a visual target only when appearance is in scope.
3. Read and execute `godot-decomposer.md` when the work needs a durable plan.
4. Read and execute `godot-scaffold.md` only for a fresh project or architectural rebuild.
5. Read and execute `godot-asset-planner.md` when assets require inventory, sourcing, generation, or licensing decisions.
6. Summarize the plan before a large implementation.
7. Read and execute `godot-executor.md` for implementation and verification.
8. Use `godot-capture.md` and `godot-visual-qa.md` for visible changes.

## Verification policy

- Require import and runtime validation for implemented gameplay.
- Require screenshots for material visual changes.
- Require frame sequences or video for motion, animation, transition, and physics claims.
- Keep capture duration and fidelity proportional to the acceptance criteria.
- Do not turn a presentation video into a universal completion requirement.

## Failure policy

When fixes do not converge:

1. Stop repeating the same class of change.
2. Isolate a minimal reproduction.
3. Determine whether the root cause is code, project settings, engine version, assets, architecture, or capture setup.
4. Replan the affected stage.
5. Escalate only when missing context or a requester decision blocks progress.

## Completion criteria

Completion requires:

- requested behavior works in the target project version;
- affected automated checks pass;
- import and bounded runtime checks pass;
- visible or dynamic claims have representative evidence when applicable;
- relevant export behavior is validated when platform differences matter;
- persistent planning files, when used, match the final implementation;
- unresolved risks and manual checks are reported.

## Boundaries

- Use `godot-api.md` for exact API and CLI questions.
- Use `godot-visual-qa.md` for the independent visual verdict.
- Treat decomposer, scaffold, executor, capture, and asset planner as stage references, not hidden agents.
