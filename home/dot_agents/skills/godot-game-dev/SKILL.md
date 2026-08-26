---
name: godot-game-dev
description: Use this when you need to plan, build, debug, test, capture, profile, and refine Godot games with GDScript-first implementation, proportional workflow, in-engine validation, visual QA, and provider-neutral asset planning.
---

# Godot game development skill

## Purpose

Use this skill to plan, implement, debug, validate, and refine Godot games without forcing a full-game generation workflow onto narrow or existing-project tasks.

Treat this file as the operating contract and reference index. Load detailed references only when the current stage needs them.

## Version policy

- Inspect `project.godot`, repository instructions, and `godot --version` before choosing APIs or project settings.
- Preserve an existing project's pinned Godot version unless the requester explicitly asks for a migration.
- For a new project without a pinned version, verify and use the latest stable Godot release from the official release archive. At the time of this review, the latest stable release is Godot 4.7.1.
- Use official documentation matching the project's Godot minor version. Do not copy APIs from development documentation into a stable project without confirming availability.
- Verify migration guides before changing an existing project's engine minor version.

## Language and engine contract

- Prefer native GDScript for new gameplay code.
- Preserve the established language in an existing project when it already uses another supported Godot language.
- Do not introduce .NET, GDExtension, or another runtime solely from preference.
- Use static typing consistently where it improves correctness and editor support.
- Verify version-sensitive classes, methods, properties, signals, settings, and command-line flags against official documentation.

## Workflow scale

### Narrow or incremental work

- Follow the repository's existing architecture, documentation, testing, and asset conventions.
- Do not create `PLAN.md`, `STRUCTURE.md`, `MEMORY.md`, `ASSETS.md`, a reference image, scene builders, screenshots, or video unless they materially help the requested task.
- Validate only the affected behavior and relevant variants, while still running the minimum import and runtime checks needed to catch integration failures.

### Full game or major rebuild

- Read `references/godot-orchestrator.md`.
- Use persistent planning and architecture files when the scope is large enough to benefit from resumable state.
- Use a visual target only when appearance is part of the request.
- Require representative in-engine evidence before completion.

## Reference routing

- Full game or major rebuild: `references/godot-orchestrator.md`
- Risk analysis and task breakdown: `references/godot-decomposer.md`
- Fresh project or architectural scaffold: `references/godot-scaffold.md`
- Implementation and debugging loop: `references/godot-executor.md`
- Screenshot and video capture: `references/godot-capture.md`
- Engine-specific sharp edges: `references/godot-quirks.md`
- Class, method, property, signal, and CLI lookup: `references/godot-api.md`
- Screenshot or frame-sequence review: `references/godot-visual-qa.md`
- Asset inventory, provenance, sizing, and assignment: `references/godot-asset-planner.md`

## Default flow

1. Classify the task as narrow, incremental, full-game, or major-rebuild work.
2. Inspect the project version, repository contract, architecture, tests, renderer, target platforms, and existing assets.
3. Load only the reference files required for the current stage.
4. Implement the smallest coherent, runnable slice.
5. Run version-appropriate import, parse, test, runtime, and visual checks.
6. Profile before optimizing and validate relevant exports when platform behavior can differ.
7. Read the final changes and report real evidence, unresolved risks, and manual checks.

## Hard rules

- Do not trust code or parsing alone when runtime behavior is in scope.
- Do not claim visual or motion correctness without representative in-engine evidence.
- Do not invent engine APIs, enum names, serialized settings, or command-line flags.
- Do not overwrite project conventions with generic scaffolding defaults.
- Do not suppress engine errors, resource leaks, parser failures, or nonzero exits as harmless without current, specific evidence.
- Do not invoke paid or external asset services unless the requester explicitly chooses the service and accepts its terms and cost.
- If repeated fixes do not converge, isolate a minimal reproduction and re-evaluate the design.

## Suggested minimal read sets

### Planning only

- `references/godot-orchestrator.md`
- `references/godot-decomposer.md`

### Fresh project creation

- `references/godot-scaffold.md`
- `references/godot-quirks.md`

### Implementation and debugging

- `references/godot-executor.md`
- `references/godot-quirks.md`
- `references/godot-api.md`

### Visible gameplay changes

- `references/godot-capture.md`
- `references/godot-visual-qa.md`

### Asset-heavy work

- `references/godot-asset-planner.md`

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

## Provenance

Derived from this repository's Godogen source material and revised into a GDScript-first, provider-neutral workflow that scales from focused fixes to full game builds.
