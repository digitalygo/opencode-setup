---
name: godot-game-dev
description: Use this when you need to build, debug, capture, validate, and refine Godot games end to end with native GDScript, staged planning, scene builders, visual QA, and optional 3D asset workflows.
---

# Godot game dev skill

Target baseline:

- **Godot 4.6 stable**
- stay compatible across **Godot 4.x** unless a reference explicitly says otherwise

## Purpose

Use this skill when you need to plan, scaffold, build, debug, capture, validate, and refine a Godot game end to end.

Treat this skill as index plus operating contract. Read detailed instructions in `references/` only when current stage needs them.

## Language and engine contract

- Write runtime code in native `GDScript`.
- Write scene builders as headless `GDScript` `SceneTree` scripts.
- Do not add `.csproj` files.
- Do not require `.NET`.
- Keep asset and 3D workflows provider-agnostic except where Tripo3D is explicitly invoked.

## Persistent project contract

Always keep project state in files:

- `reference.png` — visual target
- `PLAN.md` — tasks, verification criteria, status
- `STRUCTURE.md` — architecture, scripts, signals, build order
- `MEMORY.md` — discoveries, workarounds, recurring failures
- `ASSETS.md` — asset manifest, dimensions, paths, animation tables

## How to use this skill

### Default flow

1. Read `references/godot-orchestrator.md`.
2. If you need planning, read `references/godot-decomposer.md`.
3. If you need architecture or project skeleton work, read `references/godot-scaffold.md`.
4. Before coding or debugging, read `references/godot-quirks.md`.
5. During implementation, read `references/godot-executor.md`.
6. Before screenshots or video, read `references/godot-capture.md`.
7. For engine or API questions, read `references/godot-api.md`.
8. For visual review, read `references/godot-visual-qa.md`.
9. For assets, read `references/godot-asset-planner.md`.
10. For static 3D generation, read `references/godot-3d-generation.md`.
11. For humanoid rigging and retargeting, read `references/godot-3d-rigging.md`.

### Load only what current stage needs

Do not preload every reference file. Keep context focused.

## Routing guide

- Full game or major rebuild -> `references/godot-orchestrator.md`
- Risk analysis and task breakdown -> `references/godot-decomposer.md`
- Project skeleton, `project.godot`, stubs, scene builders -> `references/godot-scaffold.md`
- Implementation loop and validation -> `references/godot-executor.md`
- Screenshot and video capture mechanics -> `references/godot-capture.md`
- Engine gotchas and non-obvious behavior -> `references/godot-quirks.md`
- Class, method, property, and signal lookup -> `references/godot-api.md`
- Screenshot or frame-sequence review -> `references/godot-visual-qa.md`
- Asset manifest and generation order -> `references/godot-asset-planner.md`
- PNG to GLB conversion -> `references/godot-3d-generation.md`
- Humanoid rig and retarget -> `references/godot-3d-rigging.md`

## Hard rules

- Do not trust code alone; require in-engine validation.
- Do not skip screenshot or video verification for visible gameplay changes.
- Prefer explicit GDScript typing when inference is ambiguous.
- Keep scene generation as build-time scripts, not runtime gameplay logic.
- Keep runtime assets separate from reference and debug inputs.
- If repeated fixes do not converge, replan instead of patching blindly.

## Suggested minimal read sets

### Planning only

- `references/godot-orchestrator.md`
- `references/godot-decomposer.md`

### Fresh project creation

- `references/godot-orchestrator.md`
- `references/godot-scaffold.md`
- `references/godot-quirks.md`

### Implementation/debugging

- `references/godot-executor.md`
- `references/godot-capture.md`
- `references/godot-quirks.md`
- `references/godot-api.md`

### Asset-heavy project

- `references/godot-asset-planner.md`
- `references/godot-3d-generation.md`
- `references/godot-3d-rigging.md`

### Final visual pass

- `references/godot-visual-qa.md`

## Reference files

- `references/godot-orchestrator.md`
- `references/godot-decomposer.md`
- `references/godot-scaffold.md`
- `references/godot-executor.md`
- `references/godot-capture.md`
- `references/godot-quirks.md`
- `references/godot-api.md`
- `references/godot-visual-qa.md`
- `references/godot-asset-planner.md`
- `references/godot-3d-generation.md`
- `references/godot-3d-rigging.md`

## Provenance

Derived from this repository's Godogen source skills and adapted into a GDScript-first, provider-agnostic package.
