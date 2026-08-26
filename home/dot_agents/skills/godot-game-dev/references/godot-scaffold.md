# Godot scaffold workflow

## Purpose

Create or revise a Godot project skeleton that matches the project's engine version, target platforms, renderer, language, and repository conventions.

Use this workflow for a fresh project or architectural rebuild. Do not apply it wholesale to a narrow change.

Follow the version policy in `../SKILL.md`.

## Inputs

- Request and acceptance criteria.
- Existing project and repository instructions when present.
- Installed or pinned Godot version.
- Target platforms, renderer, input devices, accessibility needs, performance budget, and persistence requirements.
- Visual reference only when one exists.

## Outputs by scope

Choose only the outputs required by the project:

- `project.godot` for a fresh project or requested settings change;
- initial main scene and reusable feature scenes;
- GDScript files that implement the first runnable slice;
- input actions and collision layers required by that slice;
- `.gitignore` and `.gitattributes` when the repository does not already provide them;
- `STRUCTURE.md` only for a substantial architecture that benefits from durable documentation;
- build-time scene scripts only when repeatable generated scenes are an explicit project need.

## Workflow

1. Read repository instructions and inspect existing files before writing defaults.
2. Run `godot --version` and identify the matching official documentation minor version.
3. Preserve existing `project.godot` values unless migration or behavior requirements justify a change.
4. Define the smallest runnable scene and script slice.
5. Choose scene ownership, signal relationships, input actions, collision layers, assets, and persistence boundaries.
6. Add project settings only when required by the target behavior.
7. Author scenes using the project's established method.
8. Import the project, validate scripts, and run a bounded startup check.
9. Inspect generated changes and remove temporary artifacts.

## Project settings policy

- Do not copy a generic `project.godot` block blindly.
- Do not invent `config_version`, feature tags, serialized `InputEvent` values, renderer settings, or engine-specific property names.
- For a new project, let the installed Godot editor establish version-sensitive defaults whenever possible.
- For an existing project, preserve renderer and physics-engine choices unless a requested migration is verified.
- Keep the default physics tick rate unless gameplay measurements justify another value.
- Enable physics interpolation only with the corresponding `_physics_process()` movement discipline and teleport resets.
- Choose viewport size, stretch mode, anti-aliasing, texture filtering, and renderer from the art style, platform matrix, and performance budget.
- Treat Jolt, Forward+, Mobile, and Compatibility as project decisions, not universal defaults.

## Architecture contract

For substantial projects, maintain an architecture document that records:

- 2D, 3D, or mixed presentation boundaries;
- main entry scene and scene-transition ownership;
- reusable scenes with root types and responsibilities;
- scripts, base types, and stable public interfaces;
- signals and which ancestor or coordinator connects them;
- input actions and supported devices;
- collision layers and masks;
- resources and persistence boundaries;
- autoloads with explicit project-wide justification;
- asset locations and import constraints;
- build and verification order.

Do not create this document when the existing code and repository documentation already provide the same maintained information.

## Scene-authoring policy

- Follow the project's existing editor-authored, text-authored, or generated-scene workflow.
- Prefer reusable, self-contained scenes with minimal external dependencies.
- Use parent coordination, injected typed references, resources, groups, or signals instead of fragile cross-scene paths.
- Preserve resource UIDs and verify references after moves or renames.
- Do not mix build-time scene generation with runtime gameplay logic.
- Do not introduce a scene-builder framework for a small project unless repeatable generation provides a concrete benefit.

## Optional scene-builder rules

When build-time scene generation is justified:

- Use a `SceneTree` script with an explicit `_initialize()` entry point.
- Create the complete hierarchy before packing.
- Assign `owner` to nodes that must be serialized.
- Do not recurse ownership into children of instantiated scenes.
- Check `PackedScene.pack()` and `ResourceSaver.save()` return values.
- Instantiate the packed result in a validation step and fail with a nonzero exit when serialization is incomplete.
- Keep the builder outside runtime scene logic and run it only in the documented build phase.

## Input and collision policy

- Define gameplay input through `InputMap` actions.
- Support the requested keyboard, gamepad, touch, or accessibility inputs.
- Use physical keys only when physical layout behavior is intentional.
- Verify dead zones and analog behavior on representative devices.
- Name collision layers and document both layer and mask intent.
- Treat layer numbers and bitmasks distinctly.

## Version-control baseline

For Godot 4.1 and later, add these only when not already covered:

```text
.godot/
*.translation
```

- Preserve repository-specific ignore and LFS rules.
- Do not add legacy `*.import` ignores to a modern Godot project without evidence they are needed.
- Add an empty `.gdignore` only to repository folders that Godot must neither import nor export.
- Do not place `.gdignore` in a runtime asset directory.

## Validation loop

Adapt the binary name and paths to the environment:

```bash
godot --version
godot --headless --path . --check-only --script path/to/script.gd
godot --headless --path . --import
godot --headless --path . --editor --quit
godot --headless --path . --quit-after 2
```

- Pass an explicit script path to `--check-only --script`.
- Run the targeted parse command for each affected script when useful.
- Treat import, editor startup, runtime startup, and automated tests as different checks.
- Inspect stderr and the exit status. Do not hide parser, import, resource, or leak errors.
- Run the affected scene or project with a bounded exit after integration.
- Validate an export preset when platform behavior is part of the change.

## Boundaries

- No speculative project-wide settings.
- No mandatory scene-builder framework.
- No asset sourcing or visual verdict.
- No claim of runtime correctness from parsing alone.
