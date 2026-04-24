# Godot 3D rigging and retargeting with Tripo3D

## What you do with this skill

- Rig a humanoid GLB pipeline from an input image and apply preset animations through Tripo3D retargeting.
- Keep rigging separate from static 3D generation because limits, failure modes, and outputs differ.
- Handle prerig validation, rig and animation sidecars, and Godot animation import expectations.

## When to use

- Subject is a humanoid character.
- Game needs walk, idle, attack, jump, or other preset character animations.
- You need repeatable retargeting onto same rigged asset.

## Do not use

- Subject is non-biped.
- You only need a static GLB.
- You do not have or cannot preserve sidecar metadata.

## Pipeline

```text
PNG reference
  -> image_to_model
  -> animate_prerigcheck
  -> animate_rig
  -> rigged GLB
  -> animate_retarget
  -> animated GLB
```

## Rig command contract

```bash
python3 asset_gen.py rig \
  --image assets/img/knight_ref.png \
  --quality default \
  -o assets/glb/knight_rigged.glb
```

Do this:

- Only for humanoids.
- Use image-to-model first, then rig pipeline.
- If prerigcheck says not `biped`, stop immediately.

## Retarget command contract

```bash
python3 asset_gen.py retarget \
  --rigged assets/glb/knight_rigged.glb \
  --animation preset:biped:walk \
  -o assets/glb/knight_walk.glb
```

Do this:

- `--rigged` must come from prior `rig` output.
- Retarget reads `animate_rig_task_id` from sidecar.
- Each retarget is separate work unit.
- Same rig can be reused for many clips without re-rigging.

## Biped-only limitation

Do this:

- Tripo rig pipeline here is biped-only.
- Quadrupeds, serpents, vehicles, monsters without humanoid topology -> stop at static GLB.

Relevant source behavior:

```python
if rig_type != "biped":
    result_json(False, error=(
        f"Rig pipeline is biped-only; prerigcheck reported rig_type={rig_type!r}. "
        f"Use `glb` for non-biped characters."
    ))
```

## Animation presets

Use `preset:biped:<name>`.

Short sample:

```text
idle walk run jump hurt sit slash shoot dance_01 victory_celebration wait
```

## Sidecar contract

### Rig sidecar

```json
{
  "kind": "rig",
  "preset": "default",
  "pbr": true,
  "rig_type": "biped",
  "status": "complete",
  "image_to_model_task_id": "task_xxx",
  "prerigcheck_task_id": "task_yyy",
  "animate_rig_task_id": "task_zzz",
  "stage": "animate_rig"
}
```

### Animation sidecar

```json
{
  "kind": "anim",
  "animate_rig_task_id": "task_zzz",
  "animation": "preset:biped:walk",
  "status": "complete",
  "animate_retarget_task_id": "task_www"
}
```

## Resume behavior

Rig and retarget jobs can timeout while still processing on server.

Resume instead of resubmit:

```bash
python3 asset_gen.py resume -o assets/glb/knight_rigged.glb
python3 asset_gen.py resume -o assets/glb/knight_walk.glb
```

Resume stages:

- Rig -> pending `image_to_model`, `prerigcheck`, or `animate_rig`.
- Anim -> pending `animate_retarget`.
- Completed sidecar -> no-op.

## Failure handling

### Non-biped prerigcheck

Do this:

- Stop.
- Switch back to static GLB workflow.

### Missing rig sidecar

Do this:

- Recover sidecar if possible.
- Without it, retarget cannot safely chain from existing rig.

### Timeout

Do this:

- Use `resume`.
- Do not launch fresh task unless you intentionally accept extra spend.

### Bad animation result

Possible causes:

- bad source pose / topology
- weak base mesh
- wrong expectation about preset behavior

Do this in order:

1. Inspect rigged base asset first.
2. Confirm subject is truly humanoid.
3. Test one anchor animation like `idle` or `walk`.
4. Only then generate more clips.

## Godot integration

Target integration baseline: Godot 4.6 stable, compatible with Godot 4.x.

### Import expectation

Retargeted clip may appear in Godot `AnimationPlayer` as `NlaTrack`, not the preset name requested.

Use GDScript runtime logic as default when loading and playing the clip in-game.

### Validation after import

Check:

- Mesh faces movement direction.
- Limbs deform plausibly.
- Feet and hands do not explode or detach.
- Animation speed and loop behavior match gameplay need.

If character moves sideways, fix orientation before blaming animation.

## Recommended tool snippets

### Create rig task

```python
def create_rig_task(model_task_id: str, rig_type: str = "biped") -> str:
    return _submit_task({
        "type": "animate_rig",
        "original_model_task_id": model_task_id,
        "out_format": "glb",
        "rig_type": rig_type,
        "spec": "tripo",
    })
```

### Create retarget task

```python
def create_retarget_task(rig_task_id: str, animation: str) -> str:
    return _submit_task({
        "type": "animate_retarget",
        "original_model_task_id": rig_task_id,
        "out_format": "glb",
        "animation": animation,
        "bake_animation": True,
    })
```

### Resume rig/anim from sidecar stage

```python
elif kind == "rig":
    stage = sidecar.get("stage")
    gen_id: str = sidecar["image_to_model_task_id"]

    if stage == "image_to_model":
        poll_task(gen_id)
        check_id = create_prerigcheck_task(gen_id)
        sidecar["prerigcheck_task_id"] = check_id
        sidecar["stage"] = "prerigcheck"

    if stage == "prerigcheck":
        check_id = sidecar["prerigcheck_task_id"]
        check_result = poll_task(check_id)
        rt = check_result.get("output", {}).get("rig_type")
        if rt != "biped":
            result_json(False, error=f"prerigcheck: rig_type={rt!r}; rig pipeline is biped-only")
        rig_id = create_rig_task(gen_id, rig_type="biped")
        sidecar["animate_rig_task_id"] = rig_id
        sidecar["stage"] = "animate_rig"
```

## Suggested host-skill contract

- `rig(image, output, quality, pbr, face_limit)`
- `retarget(rigged, animation, output)`
- `resume(output)`

Structured result:

```json
{"ok": true, "path": "assets/glb/knight_walk.glb", "cost_cents": 10}
```

or

```json
{"ok": false, "error": "prerigcheck: rig_type='quadruped'; rig pipeline is biped-only", "cost_cents": 0}
```

## Hard rules

- Never auto-rig non-biped subjects.
- Always preserve sidecars for rig and retarget outputs.
- Test one anchor animation before generating many clips.
- Validate imported animation in Godot visually.
- Treat orientation and deformation issues separately.

## Boundaries

- You do not use this file to generate 2D assets.
- You do not use this file to own static GLB generation policy beyond dependency on base mesh quality.
- You do not use this file to replace screenshot QA or gameplay implementation.
