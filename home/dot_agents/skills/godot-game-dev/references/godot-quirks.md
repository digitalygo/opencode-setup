# Godot quirks workflow

## Purpose

Record verified Godot-specific sharp edges and the narrow workarounds needed for GDScript projects.

Follow the version policy in `../SKILL.md`. Recheck every version-sensitive quirk against the project's exact minor version.

## When to use this

- Before changing generated scenes, physics interpolation, procedural geometry, imported scenes, or capture harnesses.
- When editor, import, build-time, and runtime behavior differ.
- When a failure looks like an engine lifecycle or serialization issue.

## Scene serialization

- Nodes without the correct `owner` are not serialized into a packed scene.
- For an instantiated scene, set ownership on the instance root as needed and do not recursively claim ownership of its internal children.
- Check `PackedScene.pack()` and `ResourceSaver.save()` return values.
- Instantiate the packed result and verify required nodes and resources before accepting a generated scene.
- Do not introduce generated-scene machinery when the project already uses a simpler maintained authoring workflow.

## GDScript typing

- Use explicit types when `load()`, `instantiate()`, collection access, or a generic function leaves the intended type ambiguous.
- Prefer typed numeric functions such as `absf()`, `absi()`, `clampf()`, `clampi()`, and `lerpf()` when their type matches the operation.
- Check casts that can yield `null` before dereferencing.
- Follow the project's consistent typed or dynamic style, with typed GDScript preferred for new code.

## Runtime and capture lifecycle

- `_ready()` does not run merely because a node was instantiated. The node must enter a scene tree.
- Add a camera to the tree before making it current.
- Movie writing can capture a frame before `_process()` establishes presentation state, so place critical cameras and visible state during deterministic setup.
- Use immediate `free()` only when a short-lived harness must remove an object before the next deferred frame. Use the project's normal lifecycle elsewhere.
- Release simulated input actions during harness cleanup.
- Separate game cameras from harness cameras so they cannot continuously override one another.

## Physics and interpolation

- Collision layers and masks are bitmasks even though the editor presents numbered layers.
- Run movement and transform updates for interpolated physics objects in `_physics_process()`.
- Call `reset_physics_interpolation()` after teleports, respawns, and abrupt camera handoffs when interpolation is enabled.
- Make damping and drag frame-rate independent.
- Defer collision-state changes when the physics callback cannot safely apply them immediately.
- Prefer simple collision proxies for dynamic bodies and measure behavior before increasing physics tick rate.
- Verify terrain collision orientation and back-face behavior rather than assuming a generated concave shape is correct.

## Procedural geometry

- For geometry built with `SurfaceTool`, call `generate_normals()` after adding geometry and before `commit()` when normals were not provided.
- Call `generate_tangents()` only after normals and UVs exist and the material needs tangents.
- `SurfaceTool.generate_normals()` requires triangle primitives.
- Set a `MultiMeshInstance3D.custom_aabb` that covers all visible instances when default culling bounds are insufficient.
- Duplicate mutable mesh or material resources before making per-instance changes that must not affect shared users.

## Assets and imports

- A `.gdignore` inside a runtime asset directory prevents Godot from importing and exporting that directory.
- Preserve imported scene boundaries and resource UIDs.
- Verify material overrides, animation names, scale, orientation, and collision after import.
- Keep visual references, captures, and debug inputs outside runtime asset directories.

## API discipline

- Verify exact GDScript names through `godot-api.md`.
- Do not copy PascalCase C# methods into GDScript.
- Check migration guides before changing project settings or APIs across Godot minor versions.
- Treat undocumented behavior as a hypothesis until a minimal reproduction proves it.

## Workflow

1. Match the symptom to a documented, version-applicable quirk.
2. Verify the exact API or lifecycle behavior.
3. Apply the narrow workaround.
4. Build a minimal reproduction if the symptom remains unclear.
5. Record a project-local discovery only when it will remain useful and has no better home in code or tests.

## Hard rules

- Keep only verified, actionable quirks.
- Do not convert broad anecdotes into universal engine rules.
- Do not suppress engine errors to make a workaround appear successful.
- Do not use this file as a substitute for current official API documentation.

## Boundaries

- Use `godot-api.md` for exact API lookup.
- Use `godot-executor.md` for the implementation and verification loop.
