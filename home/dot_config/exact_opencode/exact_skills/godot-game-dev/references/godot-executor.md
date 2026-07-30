# Godot executor workflow

## Purpose

Implement the requested Godot behavior, verify it in the engine, capture evidence when relevant, and iterate until the acceptance criteria are satisfied.

Follow the version policy in `../SKILL.md`.

## Inputs

- Request and acceptance criteria.
- Repository instructions and current project files.
- Existing tests, plans, architecture documents, and asset manifests when present.
- Visual reference only when one exists.

## Outputs

Produce only outputs required by the task:

- updated scenes, scripts, resources, settings, and tests;
- focused test harnesses when the project lacks a suitable test path;
- screenshots or frame sequences for visible behavior;
- updated maintained planning or architecture documents when their contract changed.

## Per-task workflow

1. Read the acceptance criteria and trace the current runtime path.
2. Confirm the engine version and version-sensitive APIs.
3. Define the smallest runnable implementation slice.
4. Create a minimal reproduction first when the task is risky or the defect is unclear.
5. Implement without overwriting unrelated project conventions.
6. Run targeted parse, import, test, and bounded runtime checks.
7. Capture visual or dynamic evidence when the requirement is visible.
8. Profile before making performance claims or optimizations.
9. Fix verified failures and rerun affected checks.
10. Read the final changes and update maintained documentation only where behavior changed.

## Validation commands

Adapt the binary and paths to the project:

```bash
godot --version
godot --headless --path . --check-only --script path/to/script.gd
godot --headless --path . --import
godot --headless --path . --editor --quit
godot --headless --path . --quit-after 2
```

- `--check-only` must be paired with an explicit `--script` path.
- Run the project's existing automated test framework in addition to engine startup checks.
- Run an affected scene directly when that gives stronger evidence than the main project.
- Use a bounded exit for test scenes and automation.
- Treat nonzero exits and engine errors as failures until investigated.
- Do not treat successful parsing as proof of scene wiring or gameplay correctness.

## Test-harness rules

Use the existing test framework first. When a small custom harness is necessary:

- keep it isolated from runtime assets;
- extend `SceneTree` or another documented command-line-compatible main loop;
- make setup deterministic;
- emit machine-readable pass and failure messages;
- return a nonzero process result for failed assertions;
- free temporary scenes and reset global input state;
- remove or retain the harness according to repository policy.

Example bounded harness shape:

```gdscript
extends SceneTree

var _failed := false

func _initialize() -> void:
    var scene_resource: PackedScene = load("res://scenes/main.tscn")
    if scene_resource == null:
        push_error("ASSERT FAIL: main scene did not load")
        quit(1)
        return

    var scene := scene_resource.instantiate()
    root.add_child(scene)
    print("ASSERT PASS: main scene loaded")
    scene.free()
    quit(0)
```

## Simulated input rules

- Prefer the project's input abstraction or `InputMap` actions.
- Use `Input.action_press()` and `Input.action_release()` only in deterministic harnesses.
- Release every simulated action during cleanup.
- For sustained movement, use observed position and bounded state transitions rather than long blind timing chains.
- Verify keyboard, gamepad, touch, dead zones, and remapping only when they are in scope.

## Dynamic-debugging rules

Use dynamic evidence for:

- movement smoothness;
- transitions and scene handoffs;
- animation playback and blending;
- physics interactions;
- camera behavior;
- timing-sensitive UI or input.

For dynamic evidence:

- capture enough frames to observe the complete transition;
- keep the source sequence even when producing a sampled contact sheet;
- inspect the first frame, steady state, transition frames, and terminal state;
- pre-position cameras before frame zero when using movie writing;
- do not use capture playback as performance evidence.

## Performance rules

- Reproduce the performance problem on representative content and hardware.
- Use Godot's profiler and relevant CPU, GPU, memory, rendering, or network monitors.
- Record a before measurement, make one targeted change, and record an after measurement.
- Re-run gameplay and visual checks after optimization.
- Do not trade maintainability for an unmeasured micro-optimization.

## Hard rules

- Never declare success from parsing, import, or build alone.
- Do not hide engine output that contradicts success.
- Do not replace missing assets or behavior with unrelated substitutes to manufacture a pass.
- Do not keep repeating a non-converging fix strategy.
- Do not update planning status before verification exists.

## When to replan

Replan when:

- the same class of fix repeats without convergence;
- the root cause is in upstream architecture or project settings;
- the pinned engine version cannot support the proposed API;
- assets or platform constraints make the intended behavior impossible;
- new evidence invalidates the current acceptance criteria.

## Boundaries

- This workflow does not own project scope.
- Use `godot-capture.md` for capture mechanics.
- Use `godot-visual-qa.md` for the visual verdict.
- Use `godot-api.md` for uncertain engine APIs.
