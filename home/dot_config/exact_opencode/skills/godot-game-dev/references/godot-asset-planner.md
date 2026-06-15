# Godot asset planner skill

## Purpose

Determine what assets the game needs, decide generation order, track sizes and assignments, and write `ASSETS.md`.

Target engine baseline: Godot 4.6 stable, compatible with Godot 4.x.

## Use these inputs

- `reference.png`
- `PLAN.md`
- `STRUCTURE.md`
- available asset-generation backends in the host stack
- optional budget or generation constraints
- target runtime assumptions from `STRUCTURE.md` such as 2D vs 3D and GDScript-driven scene usage

## Use these outputs

- `ASSETS.md`
- updated `PLAN.md` asset assignments

## Workflow

1. Read `reference.png` to understand visible composition.
2. Read `STRUCTURE.md` `Asset Hints`.
3. Read `PLAN.md` `Assets needed`.
4. Merge them into one full asset list.
5. Classify assets into:
    - 3D models
    - textures
    - backgrounds
    - sprites
    - animated sprites
6. Prioritize by visual impact.
7. Reserve retry budget if budget exists.
8. Generate anchors first, derivatives second.
9. Review generated assets before conversion or downstream reuse.
10. Write `ASSETS.md` with dimensions and final file paths.
11. Update `PLAN.md` so every generated asset is assigned to a task.

## Require these `ASSETS.md` fields

Every asset row must include `Size`.

- 3D models -> meters
- Textures -> tile size in meters
- Backgrounds -> display dimensions or viewport role
- Sprites -> in-game display size in pixels

## Anchor/derivative rule

Use anchors to maintain visual consistency:

- generate hero/reference asset first
- review it
- use it to create variants, views, or families

If anchor is wrong, fix anchor before producing more derivatives.

## Asset-generation policy

- Procedural primitives are allowed only for truly abstract shapes or when explicitly justified.
- Do not fake rich assets with boxes and spheres if real assets are part of scope.
- Do not use a tileable texture as a unique scenic background.
- Do not stretch a low-resolution texture across a large surface.
- Size assets for actual in-game GDScript scene usage, not only for source-image aesthetics.

## Animated-sprite planning rules

- Define reference image per character.
- Define transition graph.
- Roots first, chained actions after.
- Dynamic verification required later in executor and QA.

## Boundaries

- Do not use this file to implement gameplay.
- Do not use this file to write scene graph.
- Do not use this file to own visual QA.
