# Godot orchestrator skill

## Purpose

Generate or update a complete Godot game from a natural-language description. You own pipeline order, state transitions, resume logic, and escalation.

Target engine baseline: Godot 4.6 stable, compatible with Godot 4.x.

## When to use this

- Use this when user wants a full game built.
- Use this when user wants a major rebuild.
- Use this when user wants a substantial extension that touches architecture, assets, and gameplay together.

## When not to use this

- Do not use this for a narrow engine API question.
- Do not use this for screenshot review only.
- Do not use this for one isolated gameplay bug only.

## Stage-loading rule

Load stage instructions only when you reach that stage. Do not preload all stage files into context.

## Persistent state

Always keep state in files, not only in chat:

- `reference.png`
- `PLAN.md`
- `STRUCTURE.md`
- `MEMORY.md`
- `ASSETS.md`

## Pipeline

```text
user request
  -> resume check
  -> visual target
  -> decomposition
  -> scaffold
  -> asset planning
  -> execution
  -> capture
  -> visual QA
  -> fix / replan / finish
```

## Resume rule

If `PLAN.md` exists:

1. read `PLAN.md`
2. read `STRUCTURE.md`
3. read `MEMORY.md`
4. read `ASSETS.md` if present
5. resume from the first incomplete task or pending stage

## Fresh-run workflow

1. Create visual target and write art direction into `ASSETS.md`.
2. Call `godot-decomposer` to write `PLAN.md`.
3. Call `godot-scaffold` to write `STRUCTURE.md`, `project.godot`, GDScript scene and script stubs, and shared scene-builder base.
4. If real assets are required, call `godot-asset-planner`.
5. Show concise plan summary.
6. Call `godot-executor` for risk tasks first, then main build.
7. Require screenshot or video validation before completion.

## Hard rules

- Do not trust code alone; require screenshot validation.
- Do not silently skip asset generation when real assets are part of scope.
- Do not ignore a visual QA fail.
- After each completed phase, update state files.
- If thread grows noisy, compress state into files and continue from files.

## Failure policy

If a task fails QA repeatedly:

- first 3 cycles: fix normally
- after 3 non-converging cycles: replan if root cause is upstream
- if root cause is unclear: escalate to user

## Completion criteria

Done only when:

- `PLAN.md` tasks marked complete
- build passes
- headless validation passes
- captures exist
- visual QA is pass or acceptable warning
- `MEMORY.md` contains important discoveries

## Boundaries

- You do not use this file to answer deep API questions itself.
- You do not use this file to review screenshots itself beyond quick sanity checks.
- You do not use this file to replace executor, decomposer, or scaffold.
