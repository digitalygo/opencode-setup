# Godot decomposer skill

## Purpose

Translate game description and visual target into a risk-aware `PLAN.md` with verifiable tasks.

Target engine baseline: Godot 4.6 stable, compatible with Godot 4.x.

## Inputs

- User game description
- `reference.png`
- Target language and runtime: native GDScript gameplay and headless GDScript scene builders

## Output

- `PLAN.md`

## Workflow

1. Read `reference.png` for camera angle, composition, entity count, and scene complexity.
2. Read the game description verbatim.
3. Classify features into:
    - risk tasks
    - main build
4. Write explicit verification criteria for every task.
5. Require final presentation video in main build verification.

## Risk taxonomy

Isolate these before main build:

- procedural generation
- procedural animation, IK, ragdoll blending
- sprite or character animation systems with transitions
- `AnimationTree` state machines and animation blending graphs
- complex vehicle physics
- custom shaders
- runtime geometry
- dynamic navigation
- complex camera systems

Everything else belongs in main build unless there is a concrete reason to isolate it.

## Verify-writing rules

- Every task must have concrete `Verify` text.
- If requirement implies motion, transition, blend, handoff, animation, or physics behavior, verification must be dynamic.
- “matches reference” is not enough for animation or state transitions.

## PLAN.md schema

```markdown
# Game plan: {name}

## Game description

{original description}

## Risk tasks

### 1. {risk feature}
- **Why isolated:** {why it is algorithmically risky}
- **Approach:** {high-level strategy}
- **Verify:** {specific observable criteria}

## Main build

- **Assets needed:** {asset summary if relevant}
- **Verify:**
  - {movement/input/animation alignment}
  - {physics checks}
  - {UI checks}
  - {game-specific checks}
  - gameplay flow matches description
  - no placeholder remnants or visual glitches
  - reference consistency: camera, scale, density, palette
  - **Presentation video:** ~30-second gameplay video
```

## Hard rules

- Do not split routine features into tiny microtasks.
- Do not produce untestable requirements.
- Do not omit presentation-video requirement.
- Do not isolate easy systems just to feel structured.
- Do not write C#-specific implementation assumptions into the plan.

## Boundaries

- You do not use this file to write architecture.
- You do not use this file to write code.
- You do not use this file to choose implementation details for routine features.
