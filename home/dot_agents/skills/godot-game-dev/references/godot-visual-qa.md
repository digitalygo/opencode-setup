# Godot visual QA workflow

## Purpose

Review screenshots or frame sequences from a running Godot project and report visual defects, implementation shortcuts, and motion anomalies independently from the implementation pass.

Follow the version policy in `../SKILL.md` when a finding depends on engine behavior.

## Inputs

- One or more captures from the running project.
- Request and visual acceptance criteria.
- Visual reference when one exists.
- Target resolution, aspect ratio, platform, and art-direction constraints.
- Frame timestamps or indices for dynamic review.

A visual reference is optional. Without one, judge the explicit request, internal consistency, usability, and observable defects.

## Modes

### Static mode

Use static mode for:

- terrain and environment composition;
- decoration and asset placement;
- HUD and menus;
- typography and layout;
- material, lighting, clipping, and scaling defects.

Inspect representative settled frames at required resolutions and aspect ratios.

### Dynamic mode

Use dynamic mode for:

- movement and camera behavior;
- animation and blending;
- physics and collisions;
- transitions and scene handoffs;
- interaction timing;
- responsive UI states.

Inspect enough consecutive source frames to observe pre-state, transition, and post-state. A low-rate contact sheet alone cannot prove smoothness or timing.

### Question mode

Use question mode for a targeted visual diagnosis without a reference image, such as overlap, clipping, material response, orientation, or motion discontinuity.

## Review rubric

Check as applicable:

- composition, hierarchy, readability, scale, and visual balance;
- target-resolution and aspect-ratio behavior;
- z-fighting, clipping, seams, stretching, and missing textures;
- lighting, materials, color space, filtering, and transparency;
- floating, intersecting, or incorrectly oriented objects;
- placeholder remnants and inconsistent asset quality;
- jitter, teleporting, frozen poses, foot sliding, broken blending, and timing discontinuities;
- input focus, hover, disabled, pause, loading, and error states;
- accessibility requirements that are visually observable.

## Output format

```markdown
### Verdict: {pass | fail | warning}

### Scope

{captures, resolution, platform assumptions, and acceptance criteria reviewed}

### Reference assessment

{comparison with the visual reference, or state that no reference was supplied}

### Issues

#### Issue 1: {title}

- **Type:** {style mismatch | visual bug | logical inconsistency | motion anomaly | placeholder | accessibility}
- **Severity:** {major | minor | note}
- **Frames:** {frame or range when dynamic}
- **Location:** {screen region or object}
- **Evidence:** {observable defect}
- **Expected:** {acceptance criterion}

### Summary

{one concise verdict summary}
```

## Independence rule

Complete the visual verdict from the captures before reading implementation details. After recording the verdict, a separate diagnostic pass may inspect code, scenes, settings, and logs to find the cause.

## Severity policy

- `major`: blocks intended use, core presentation, or a required interaction.
- `minor`: visible defect that must be fixed before visual acceptance.
- `note`: nonblocking observation or optional improvement.
- `warning`: evidence is incomplete or environment limitations prevent a full verdict.

Do not return `pass` when required dynamic evidence is missing.

## Failure policy

- A `fail` verdict triggers a focused fix and fresh capture.
- A changed visual surface invalidates the previous verdict for that surface.
- Repeated non-converging failures trigger a minimal reproduction or design review.
- Keep prior captures only as comparison evidence, not as proof of the new state.

## Hard rules

- Do not rationalize observable defects.
- Do not use one screenshot to prove motion or timing.
- Do not infer target-platform appearance from a materially different renderer without stating the limitation.
- Reference exact frames for dynamic findings.
- Distinguish a capture failure from a game defect.

## Boundaries

- This workflow does not implement fixes.
- This workflow does not choose architecture.
- Use `godot-capture.md` for capture mechanics.
