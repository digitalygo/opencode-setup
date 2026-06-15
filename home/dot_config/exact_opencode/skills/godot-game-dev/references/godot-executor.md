# Godot executor skill

## Purpose

Implement tasks from `PLAN.md`, verify them in-engine, capture evidence, run QA, and iterate until done.

## Inputs

- `PLAN.md`
- `STRUCTURE.md`
- `MEMORY.md`
- `ASSETS.md` if present
- `reference.png`

## Outputs

- updated scenes and scripts
- test harness scripts
- screenshots and video
- updated `PLAN.md`
- updated `MEMORY.md`

## Phase order

1. Risk tasks first.
2. Main build second.

## Per-task workflow

1. Read task and verification criteria.
2. Write a concrete local implementation approach.
3. If task is risky, create minimal repro environment first.
4. Implement.
5. Syntax-check changed scripts and validate project.
6. Validate headless.
7. Capture screenshots or frame sequence.
8. Check assertions.
9. Run visual QA if applicable.
10. Fix and repeat if needed.
11. Update `PLAN.md` and `MEMORY.md`.

## Main implementation loop

1. Import assets.
2. Generate scenes.
3. Generate scripts.
4. Run `godot --headless --check-only -s` on changed `.gd` files.
5. Run `godot --headless --quit`.
6. Capture screenshots or video using `godot-capture.md`.
7. Verify assertions and visual output.
8. Run visual QA.
9. If failed, return to step 2.

## Test-harness rules

- Harness extends `SceneTree`.
- Use `_initialize()` for setup.
- `_process(delta: float)` returns `bool`.
- Do not call `quit()` when using movie writing.
- Print `ASSERT PASS:` and `ASSERT FAIL:` for non-visual checks.

Example GDScript harness pattern:

```gdscript
extends SceneTree

var _scene: Node

func _initialize() -> void:
    var scene_res: PackedScene = load("res://scenes/main.tscn")
    _scene = scene_res.instantiate()
    root.add_child(_scene)
    print("ASSERT PASS: scene loaded")

func _process(delta: float) -> bool:
    return false
```

## Simulated input rules

- Use `Input.action_press()` and `Input.action_release()` through deterministic timers or state machines.
- For sustained movement, default to closed-loop steering based on actual position instead of open-loop button timing.
- Print assertion lines for exact non-visual facts.

Example timed input:

```gdscript
var timer := Timer.new()
timer.wait_time = 1.0
timer.one_shot = true
timer.timeout.connect(func() -> void:
    Input.action_press("move_forward")
)
root.add_child(timer)
timer.start()
```

Closed-loop movement principle:

- read actual position every frame
- steer toward a waypoint
- switch waypoint only after proximity threshold is reached
- avoid long blind press/release chains that accumulate drift

## GDScript validation rules

- Prefer explicit types when writing generated gameplay code.
- Use `godot --headless --check-only -s path/to/script.gd` for targeted syntax or type validation.
- Use whole-project `godot --headless --quit` after integrating new scripts and scenes.
- Do not treat successful parsing as proof that runtime wiring is correct.

## Dynamic-debugging rules

Use dynamic capture whenever requirement mentions:

- smooth movement
- transitions
- handoff between states
- animation blending
- physics interactions

For these tasks:

- Capture 3-5 seconds at fixed FPS.
- Review multiple frames, not one screenshot.
- Ask visual QA about motion, not only layout.
- Pre-position important cameras before frame 0 when using movie writing.

## Hard rules

- Never declare success from compile or build alone.
- A missing or wrong animation clip is a verification failure.
- Do not replace one model with another to fake success.
- If fix attempts stop converging, stop and re-evaluate architecture.

## When to replan

Replan when:

- same class of fix repeats without convergence
- root cause is upstream architecture
- assets make correct implementation impossible

## Boundaries

- You do not use this file to own project scope.
- You do not use this file to own high-level architecture unless replanning is required.
- You do not use this file to ignore QA reports.
