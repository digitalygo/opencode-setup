# Godot quirks skill

## Purpose

Use this to handle engine-level sharp edges and mandatory workarounds for Godot 4.x GDScript projects. Do not treat it as a language tutorial.

## When to use this

- Before you write code.
- When behavior looks impossible or inconsistent.
- When build-time and runtime behavior diverge.

## Core quirks to enforce

### Scene building

- Assign scene ownership correctly or nodes vanish from saved `.tscn`.
- Do not recurse ownership into instantiated GLB/TSCN children or scenes bloat massively.
- Avoid `:=` when right-hand side is type-ambiguous: `load()`, `instantiate()`, `abs()`, `clamp()`, `min()`, `max()`, and array or dictionary access often infer badly or stay Variant-like.
- Prefer `load()` over `preload()` in generated build-time scripts when import order or generated file timing is uncertain.

### Runtime/capture

- `_ready()` on instantiated children is not reliable inside scene-builder `_initialize()` flows.
- Call `Camera2D.make_current()` only after node is inside scene tree.
- `--write-movie` frame 0 renders before `_process()`; pre-position important cameras.
- Use `free()` instead of `queue_free()` when test harness replaces scenes immediately.
- Avoid `await` during movie-writing flows because it can distort frame progression; use deterministic timer or state logic in capture scripts.
- Remember that `@onready` runs after initialization and exported values; do not let it silently override intended setup.
- Snap once before lerping from world origin or first frame will swoop visibly.
- Disable game camera consistently or test harness camera can be overridden every frame.

### Physics and rendering

- Collision layers are bitmasks, not UI layer numbers.
- `ArrayMesh.GenerateNormals()` is required for correct shadow reception.
- `CharacterBody3D.MOTION_MODE_FLOATING` has slope caveats.
- Default collision mask often misses non-default layers.
- Frame-rate-dependent drag formulas create hidden gameplay bugs.
- `BoxShape3D` can snag badly on trimesh edges; use `CapsuleShape3D` for sliding bodies when needed.
- `ConcavePolygonShape3D` winding order matters; bad winding can make bodies fall through.
- Raycasts against concave terrain can be unreliable; shape casts or direct geometry queries may be safer.
- Call `reset_physics_interpolation()` after teleports or abrupt camera handoffs.
- Wrap yaw differences to `[-PI, PI]` before lerping or entities may spin the long way around.

### Asset/import traps

- `.gdignore` inside `assets/` silently blocks imports.
- `MultiMeshInstance3D` and imported GLBs have serialization pitfalls.
- `MaterialOverride` on internal GLB mesh nodes may not serialize.
- Duplicated `MultiMesh` meshes may need `.duplicate()` before freeing the source model.
- `MultiMeshInstance3D.custom_aabb` must cover visible area or frustum culling will hide instances early.
- Do not combine world-space UV logic and extra material UV scaling unless double-scaling is intended.

### API and syntax

- Do not guess engine constants or enum-style names from memory; verify through `godot-api`.
- Use Godot 4.6 naming as baseline and keep output compatible with Godot 4.x.
- Sibling signal timing in `_ready()` can race; after connecting, manually sync current state if needed.
- Changing collision state inside collision callbacks should be deferred, not immediate.

## Workflow

1. Match symptom to known quirk.
2. Apply precise workaround.
3. If unresolved, build a minimal repro.
4. Record project-local discovery in `MEMORY.md`.

## Hard rules

- Keep this file short, opinionated, and proven.
- Keep only bugs and non-obvious behaviors.
- Do not fill it with beginner guidance.

## Boundaries

- You do not use this file to replace API docs.
- You do not use this file to replace executor.
