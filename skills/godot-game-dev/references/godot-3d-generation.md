# Godot 3D generation with Tripo3D

## What you do with this skill

- Generate static 3D GLB assets from PNG images with Tripo3D.
- Integrate them into Godot with correct scale, orientation, and collision strategy.
- Handle image-to-model submission, sidecar persistence, timeout recovery, and import rules for static 3D assets.

## When to use

- Game needs a 3D prop, vehicle, building, environment object, or static creature.
- You need a base GLB before deciding whether rigging is possible.
- Subject is non-biped or rigging is not required.

## Do not use

- Asset can remain a primitive shape.
- Goal is a rigged humanoid animation pipeline.
- Asset is 2D only.

## Required environment

- `TRIPO3D_API_KEY` in environment.
- Input PNG image.
- Wrapper or CLI that can upload, submit task, poll, download output, and write sidecar metadata.

## Core workflow

```text
PNG reference
  -> image_to_model
  -> GLB download
  -> sidecar write
  -> Godot import
  -> scale / orient / collide
```

## Command contract

```bash
python3 asset_gen.py glb \
  --image assets/img/car.png \
  --quality default \
  -o assets/glb/car.glb
```

### Flags

- `--image` -> input PNG
- `--quality default` -> standard geometry and texture, 30k face cap, PBR
- `--quality hd` -> detailed geometry plus HD texture, no face cap
- `--no-pbr` -> disable PBR only if output is visibly wrong
- `--face-limit N` -> only meaningful for `default`
- `-o` -> output GLB path

## Input image guidance

For best 3D conversion:

- one centered subject
- clean background, usually white or light neutral
- no busy scene composition
- matte-looking materials are safer than reflective ones
- avoid transparent glass and reflective windows in source image
- prefer 3/4 front elevated view when possible

Prompt pattern from source:

```text
3D model reference of {name}. {description}. 3/4 front elevated camera angle, solid white background, soft diffused studio lighting, matte material finish, single centered subject, no shadows on background. Any windows or glass should be solid tinted (opaque).
```

## Sidecar contract

Each output writes a sidecar next to GLB.

Path rule:

- `car.glb` -> `car.glb.tripo.json`

Example:

```json
{
  "kind": "mesh",
  "preset": "default",
  "pbr": true,
  "status": "complete",
  "image_to_model_task_id": "task_xxx"
}
```

## Resume behavior

Tripo jobs may stay at 99% for minutes. Timeout does not mean the server job failed.

Never resubmit blindly. Resume from sidecar:

```bash
python3 asset_gen.py resume -o assets/glb/car.glb
```

Do this:

- Resume continues polling the original `image_to_model` task.
- If sidecar says `complete`, resume should no-op.
- Timeout after resume still does not justify blind resubmission.

## Failure handling

### Timeout

Do this:

- Use `resume`.
- Do not submit a second generation job for same asset unless you intentionally want a new paid attempt.

### Missing sidecar

Do this:

- Recover sidecar if possible.
- Rerun only if you accept re-spend and loss of resume safety.

### Bad output quality

Do this in order:

1. Improve source image.
2. Retry anchor once.
3. Increase quality only if justified.
4. Disable PBR only if visibly broken.

## Godot integration

Target integration baseline: Godot 4.6 stable, compatible with Godot 4.x.

### Load GLB as PackedScene

```gdscript
var model_scene: PackedScene = load("res://assets/glb/car.glb")
var model: Node3D = model_scene.instantiate() as Node3D
model.name = "CarModel"
```

### Measure and scale by AABB

```gdscript
var mesh_inst: MeshInstance3D = find_mesh_instance(model)
var aabb: AABB = mesh_inst.get_aabb() if mesh_inst != null else AABB(Vector3.ZERO, Vector3.ONE)

var target_length: float = 2.0
var scale_factor: float = target_length / aabb.size.x
model.scale = Vector3.ONE * scale_factor
model.position = Vector3(0.0, -aabb.position.y * scale_factor, 0.0)
```

### Use primitive collision, not mesh-derived collision

```gdscript
var box := BoxShape3D.new()
box.size = aabb.size * model.scale
collision_shape.shape = box
```

Never use `CreateConvexShape()` or `CreateTrimeshShape()` on imported high-poly GLBs for gameplay collision.

### Orientation check

Imported models may face wrong axis.

Check:

- Longest AABB dimension.
- Expected forward axis in game.
- Screenshots against actual movement direction.

If a vehicle or creature moves sideways, orientation is wrong even if import succeeded.

## Recommended tool snippets

### Submit image-to-model task

```python
def create_image_to_model_task(
    image_path: Path,
    *,
    face_limit: int | None = 30000,
    pbr: bool = True,
    geometry_quality: str = "standard",
    texture_quality: str = "standard",
) -> str:
    image_token = upload_image(image_path)
    payload = {
        "type": "image_to_model",
        "model_version": MODEL_V31,
        "file": {"type": "png", "file_token": image_token},
        "texture": True,
        "pbr": pbr,
        "auto_size": True,
        "orientation": "default",
        "enable_image_autofix": True,
        "geometry_quality": geometry_quality,
        "texture_quality": texture_quality,
    }
    if face_limit is not None:
        payload["face_limit"] = face_limit
    return _submit_task(payload)
```

### Poll task until success or terminal state

```python
def poll_task(task_id: str, timeout: int = 600, interval: int = 5) -> dict:
    start = time.time()
    url = f"{API_BASE}/task/{task_id}"
    while time.time() - start < timeout:
        resp = requests.get(url, headers=_headers())
        resp.raise_for_status()
        data = resp.json()["data"]
        status = data["status"]
        if status == "success":
            return data
        if status in ("failed", "cancelled", "unknown"):
            raise RuntimeError(f"Task {task_id} {status}: {data}")
        time.sleep(interval)
    raise TimeoutError(f"Task {task_id} timed out after {timeout}s")
```

### Sidecar helpers

```python
def _sidecar_path(output: Path) -> Path:
    return output.with_suffix(output.suffix + ".tripo.json")

def _write_sidecar(output: Path, data: dict) -> None:
    _sidecar_path(output).write_text(json.dumps(data, indent=2) + "\n")

def _read_sidecar(path: Path) -> dict:
    sc = _sidecar_path(path)
    if not sc.exists():
        raise FileNotFoundError(f"Sidecar not found: {sc}")
    return json.loads(sc.read_text())
```

## Suggested host-skill contract

- `glb(image, output, quality, pbr, face_limit)`
- `resume(output)`

Structured result:

```json
{"ok": true, "path": "assets/glb/car.glb", "cost_cents": 30}
```

or

```json
{"ok": false, "error": "Task timed out after 600s. Resume with: ...", "cost_cents": 0}
```

## Hard rules

- Always persist sidecar metadata before long polling.
- Never resubmit timed-out jobs blindly.
- Review anchor GLB before generating many derivatives.
- In Godot, use simple collision proxies.
- Verify final scale and orientation visually.

## Boundaries

- You do not use this file to rig characters.
- You do not use this file to retarget animations.
- You do not use this file to replace scene architecture or screenshot QA.
