# Godot visual QA skill

## Purpose

Inspect screenshots or frame sequences from a running Godot game and report visual defects, implementation shortcuts, and motion anomalies.

Target engine baseline: Godot 4.6 stable, compatible with Godot 4.x.

## Use these inputs

- `reference.png` for static or dynamic mode
- One screenshot or frame sequence
- Optional freeform context: goal, requirements, verify
- Optional context about intended GDScript behavior or scene-builder output

## Modes

### Static mode

Use static mode for:

- terrain
- decoration
- HUD
- menu/title screens

Inputs: `reference.png` + one representative screenshot.

### Dynamic mode

Use dynamic mode for:

- movement
- animation
- physics
- transitions
- interaction timing

Inputs: `reference.png` + frame sequence sampled at roughly 2 FPS cadence.

### Question mode

Use question mode for:

- targeted debugging without a reference image
- specific questions about materials, paths, overlap, clipping, motion

## Review rubric

Check for:

- poor placement, scaling, and composition
- z-fighting
- stretching, seams, missing textures
- clipping and floating objects
- impossible scale/orientation
- placeholder remnants
- jitter, teleporting, frozen poses, sliding, broken physics

## Use this output format

```markdown
### Verdict: {pass | fail | warning}

### Reference match
{1-3 sentences}

### Goal assessment
{1-3 sentences}

### Issues

#### Issue 1: {title}
- **Type:** style mismatch | visual bug | logical inconsistency | motion anomaly | placeholder
- **Severity:** major | minor | note
- **Frames:** {if dynamic}
- **Location:** {where}
- **Description:** {1-2 sentences}

### Summary
{one sentence}
```

## Hard rules

- Do not rationalize defects.
- Do not read code while doing image QA.
- Static mode is not enough for motion bugs.
- `major` and `minor` are fix-required.
- If you review dynamic behavior, reference exact frames.
- When scene-builder output looks incomplete, call out likely serialization or ownership symptoms explicitly.

## Failure policy

- `fail` must trigger a fix cycle.
- Repeated non-converging failures must trigger replan or escalation.

## Boundaries

- You do not use this file to implement fixes.
- You do not use this file to choose architecture.
