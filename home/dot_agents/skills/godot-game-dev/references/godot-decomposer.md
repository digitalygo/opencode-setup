# Godot decomposer workflow

## Purpose

Translate a substantial game request into a risk-aware plan with observable verification criteria.

Follow the version policy in `../SKILL.md`.

## When to use this

- Full game builds.
- Major rebuilds.
- Multi-system features that benefit from resumable planning.

Do not create a standalone plan for a narrow task when the repository's existing issue, checklist, or test already provides enough structure.

## Inputs

- Request and acceptance criteria.
- Existing repository instructions and project files.
- Target platforms and engine version.
- Visual reference when one exists.
- Existing assets, tests, architecture documents, and constraints.

## Output

Use the repository's existing planning format. Create `PLAN.md` only when no suitable maintained plan exists and the task is large enough to need one.

## Workflow

1. Read the request and preserve its observable requirements.
2. Inspect the existing project before proposing architecture.
3. Identify target platforms, inputs, persistence, accessibility, performance, and export constraints.
4. Separate only genuinely risky work from the main build.
5. Write concrete verification criteria for each task.
6. Choose static, dynamic, automated, visual, performance, and export evidence according to the requirement.
7. Record dependencies and completion order without splitting routine work into microtasks.

## Risk taxonomy

Consider isolating:

- procedural generation;
- procedural animation, inverse kinematics, or ragdoll blending;
- animation state machines and blend graphs;
- complex vehicle or multiplayer physics;
- custom shaders and runtime geometry;
- dynamic navigation;
- save migrations;
- networking and authority boundaries;
- platform-specific exports;
- complex camera systems.

Everything else belongs in the main build unless current project evidence shows a concrete risk.

## Verification-writing rules

- Every task must name an observable success condition.
- Motion, transitions, animation, physics, and timing require dynamic evidence.
- A visual reference can establish composition, scale, density, and palette, but it does not prove runtime behavior.
- Use a presentation video only when requested or when it is the most efficient evidence for the acceptance criteria.
- Include relevant negative paths and lifecycle transitions, not only the first happy path.

## Suggested plan shape

```markdown
# Game plan: {name}

## Scope

{request, constraints, target platforms, and engine version}

## Existing project contract

{architecture, language, renderer, tests, assets, and conventions to preserve}

## Risk work

### {risk feature}

- **Why isolated:** {specific risk}
- **Approach:** {smallest proving slice}
- **Verify:** {observable and executable evidence}

## Main build

### {task}

- **Dependencies:** {dependencies}
- **Verify:** {observable and executable evidence}

## Final verification

- {automated checks}
- {bounded runtime checks}
- {visual or dynamic evidence when relevant}
- {export and target-platform checks when relevant}
```

## Hard rules

- Do not assume a visual reference exists.
- Do not mandate generated assets, scene builders, or video without scope evidence.
- Do not produce untestable requirements.
- Do not choose engine APIs from memory.
- Do not replace established project planning with a redundant top-level file.

## Boundaries

- This workflow defines tasks and evidence, not detailed architecture or implementation.
- Use `godot-scaffold.md` for fresh-project structure.
- Use `godot-executor.md` for implementation.
