# Godot scaffold skill

## Purpose

Design and write a compilable Godot project skeleton targeting **Godot 4.6 stable** while staying compatible with **Godot 4.x**: `project.godot`, `STRUCTURE.md`, GDScript stubs, GDScript scene-builder stubs, and shared scene-builder base.

## Inputs

- User brief or change request
- `reference.png`
- Existing project files if incremental

## Outputs

- `project.godot`
- `STRUCTURE.md`
- `scripts/*.gd`
- `scenes/scene_builder_base.gd`
- `scenes/build_*.gd`
- `.gitignore`
- `screenshots/.gdignore`

## Workflow

1. Run `godot --version`.
2. Match version-sensitive values to the local Godot 4.x toolchain, targeting 4.6 semantics unless the installed patch version differs.
3. Read `reference.png`.
4. Read change request or game brief.
5. Determine whether this is fresh, reset, or incremental work.
6. Design scenes, scripts, signal map, input actions, collision layers, asset hints.
7. Write `project.godot`.
8. Write full `STRUCTURE.md`.
9. Write script stubs.
10. Create `scene_builder_base.gd`.
11. Create scene-builder stubs.
12. Build and validate skeleton.

## Version-sensitive rules

Never hardcode these from examples:

- `project.godot` `config_version`
- script/property names that changed between older Godot 4 releases

Preserve existing values unless user explicitly requests migration.

## `project.godot` baseline

Use this as a schematic template. Detect and match `config_version` from the local Godot 4.x install instead of hardcoding it.

```ini
; Engine configuration file
; Do not edit manually

config_version={match local Godot 4.x}

[application]

config/name="{ProjectName}"
run/main_scene="res://scenes/main.tscn"

[display]

window/size/viewport_width=1280
window/size/viewport_height=720
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"

[physics]

common/physics_ticks_per_second=120
common/physics_interpolation=true
; 3D only — omit for 2D projects:
3d/physics_engine="Jolt Physics"

[rendering]

; 3D games:
lights_and_shadows/directional_shadow/soft_shadow_filter_quality=3
anti_aliasing/quality/msaa_3d=2
; 2D pixel art alternative:
; textures/canvas_textures/default_texture_filter=0
; 2d/snap/snap_2d_transforms_to_pixel=true

[layer_names]

2d_physics/layer_1="player"
2d_physics/layer_2="enemies"

[autoload]

; GameManager="res://scripts/game_manager.gd"

[input]

move_forward={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":87,"key_label":0,"unicode":119)]
}

jump={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":32,"key_label":0,"unicode":32)]
}
```

Useful physical keycodes:

- `W=87`
- `A=65`
- `S=83`
- `D=68`
- `Space=32`
- `Enter=4194309`
- `Escape=4194305`

Mouse button example:

```ini
fire={
"deadzone": 0.2,
"events": [Object(InputEventMouseButton,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"button_mask":1,"position":Vector2(0,0),"global_position":Vector2(0,0),"factor":1.0,"button_index":1,"canceled":false,"pressed":true,"double_click":false)]
}
```

## STRUCTURE.md contract

Must contain:

- dimension: 2D or 3D
- input actions
- scenes with root types and children
- scripts with attaches-to, extends, signals emitted/received, instantiations
- signal map
- asset hints
- build order

## Scene-builder rules

- Builders are build-time files, not runtime scripts.
- Inherit from `scene_builder_base.gd`.
- `_initialize()` is entry point.
- Build node hierarchy first.
- Call `set_script()` after full hierarchy exists.
- No temp-parent workaround is needed; C# wrapper disposal does not apply.
- Save via `_pack_and_save()`.
- Use explicit typing around `load()` and `instantiate()` when type inference is ambiguous.
- Skip ownership recursion into instantiated GLB/TSCN children with `scene_file_path`.
- Validate packed scene node count before save.

## Hard rules

- Do not write runtime behavior into scene builders.
- Do not connect signals in builders.
- Do not mix 2D and 3D hierarchies.
- Create `screenshots/.gdignore`; never place `.gdignore` inside `assets/`.
- Keep runtime-only assets in `assets/`; keep references and debug inputs outside it.

## Validation loop

1. `godot --headless --check-only -s` for each new or changed `.gd` script
2. `godot --headless --import`
3. run scene builders in build order
4. `godot --headless --quit`

If any failure is caused by engine-version mismatch or stale syntax, fix that before touching gameplay architecture.

## GDScript stub rules

Prefer explicit typing over aggressive `:=` inference in generated code.

Example runtime stub:

```gdscript
# res://scripts/player_controller.gd
extends CharacterBody3D

signal died
signal scored

@export var speed: float = 7.0
@export var jump_velocity: float = -4.5

func _ready() -> void:
    pass

func _physics_process(delta: float) -> void:
    pass

func _on_hurt_entered(area: Area3D) -> void:
    pass
```

Example scene-builder loading rule:

```gdscript
var player_scene: PackedScene = load("res://scenes/player.tscn")
var player: Node3D = player_scene.instantiate() as Node3D
```

Avoid `:=` on `load()`, `instantiate()`, `abs()`, `clamp()`, `min()`, `max()`, and raw array or dictionary access unless the inferred type is unquestionably correct.

## `scene_builder_base.gd` contract

Create one shared base class for build-time scene generation in every project.

Required responsibilities:

- recursive ownership assignment for newly created nodes
- no recursion into instantiated scene children with `scene_file_path`
- node counting before and after `PackedScene.pack()`
- fail-fast save path via `push_error()` + `quit(1)`
- success path via `quit(0)`

Example baseline:

```gdscript
extends SceneTree

func _set_owner_on_new_nodes(node: Node, scene_owner: Node) -> void:
    for child: Node in node.get_children():
        child.owner = scene_owner
        if child.scene_file_path.is_empty():
            _set_owner_on_new_nodes(child, scene_owner)

func _count_nodes(node: Node) -> int:
    var total: int = 1
    for child: Node in node.get_children():
        total += _count_nodes(child)
    return total

func _validate_packed_scene(packed: PackedScene, expected_count: int, scene_path: String) -> bool:
    var test_instance: Node = packed.instantiate()
    var actual: int = _count_nodes(test_instance)
    test_instance.free()
    if actual < expected_count:
        push_error("Pack validation failed for %s: expected %d nodes, got %d" % [scene_path, expected_count, actual])
        return false
    return true

func _pack_and_save(root_node: Node, output_path: String) -> void:
    _set_owner_on_new_nodes(root_node, root_node)
    var count: int = _count_nodes(root_node)
    var packed := PackedScene.new()
    var pack_error: Error = packed.pack(root_node)
    if pack_error != OK:
        push_error("Pack failed: %s" % [pack_error])
        quit(1)
        return
    if not _validate_packed_scene(packed, count, output_path):
        quit(1)
        return
    var save_error: Error = ResourceSaver.save(packed, output_path)
    if save_error != OK:
        push_error("Save failed: %s" % [save_error])
        quit(1)
        return
    quit(0)
```

## Scene-builder template

```gdscript
extends "res://scenes/scene_builder_base.gd"

func _initialize() -> void:
    var root := Node3D.new()
    root.name = "Main"

    var camera := Camera3D.new()
    camera.name = "Camera3D"
    camera.position = Vector3(0.0, 4.0, 8.0)
    root.add_child(camera)

    var manager_script: Script = load("res://scripts/game_manager.gd")
    root.set_script(manager_script)

    _pack_and_save(root, "res://scenes/main.tscn")
```

## Common build-time compositions

### GLB instancing with safe ownership

```gdscript
var car_scene: PackedScene = load("res://assets/glb/car.glb")
var car: Node3D = car_scene.instantiate() as Node3D
car.name = "PlayerCar"
car.position = Vector3(0.0, 0.0, 5.0)
root.add_child(car)
car.owner = root
```

Set ownership only on the instanced scene root. Do not recurse into imported children.

### HUD overlay

```gdscript
var canvas_layer := CanvasLayer.new()
var ui_root := Control.new()
ui_root.set_anchors_preset(Control.PRESET_FULL_RECT)
canvas_layer.add_child(ui_root)
root.add_child(canvas_layer)
```

### `.gitignore` baseline

```text
.godot/
*.import
screenshots/
```

Add more entries only if your workflow creates them intentionally.

## Boundaries

- No gameplay logic beyond stubs.
- No asset generation.
- No screenshot QA.
