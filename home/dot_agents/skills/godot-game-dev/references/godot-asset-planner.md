# Godot asset planning workflow

## Purpose

Inventory, source, size, license, assign, and verify assets required by a Godot project without assuming a particular generation provider.

Follow the version policy in `../SKILL.md`.

## When to use this

- A full game or feature requires multiple new assets.
- Existing assets must be audited for provenance, scale, format, or assignment.
- Asset choices affect runtime performance, import settings, licensing, or visual consistency.

Do not create a separate asset manifest for a small change with one obvious existing asset.

## Inputs

- Request and visual requirements.
- Existing project assets and import settings.
- Target platforms, renderer, memory budget, and performance constraints.
- Visual reference when one exists.
- Available approved sources, licenses, tools, and budget.
- Existing `PLAN.md`, `STRUCTURE.md`, or asset manifest when present.

## Outputs

Use the repository's existing asset manifest when available. Create `ASSETS.md` only for a substantial asset set that benefits from durable tracking.

Record as applicable:

- stable asset identifier and purpose;
- source path or source URL;
- author, license, attribution, and usage restrictions;
- source dimensions or scale;
- intended in-game dimensions or scale;
- import settings and compression choices;
- target path and assigned scene or system;
- status and verification evidence.

## Workflow

1. Inventory existing assets before sourcing new ones.
2. Derive the required asset list from the request, architecture, and visible composition.
3. Classify assets by type, role, reuse, licensing, and runtime cost.
4. Prefer provided or already-approved assets when they satisfy the requirement.
5. Choose procedural, commissioned, purchased, open-licensed, or generated assets only after checking project policy, rights, quality, cost, and reproducibility.
6. Establish one approved visual anchor when consistency across an asset family matters.
7. Validate anchor scale, orientation, palette, topology, and import behavior before creating derivatives.
8. Import representative assets into Godot and verify them in their actual scene context.
9. Update the maintained manifest and task assignments.

## Size and format rules

- 3D models: record source units, target meters, orientation, origin, topology, material count, and collision strategy.
- Textures: record pixel dimensions, color space, compression, filtering, repeat behavior, and intended world or UI size.
- Backgrounds: record viewport role, target aspect ratios, safe crop regions, and scaling behavior.
- Sprites: record source pixels, intended display size, pivot, filtering, animation frames, and atlas strategy.
- Audio: record duration, channels, sample rate, loop behavior, loudness expectations, and import compression.
- Fonts: record license, supported glyph ranges, fallback strategy, and UI scaling requirements.

## Asset policy

- Do not invoke a paid or external service without explicit requester approval of the provider, cost, terms, and data being uploaded.
- Do not fabricate provenance or licensing.
- Do not replace required production assets with primitives merely to claim completion.
- Use primitives and placeholders only when the scope permits them, and label them clearly.
- Do not stretch low-resolution textures or unique backgrounds beyond their intended use.
- Keep source assets, runtime assets, visual references, captures, and generated builds in distinct locations.
- Use Git LFS only when the repository supports it and the relevant binary patterns are configured before adding large files.

## Verification

- Open assets through the project's actual import pipeline.
- Check scale, orientation, materials, animation names, loop behavior, compression, and memory impact.
- Capture representative scenes when appearance is part of acceptance.
- Confirm every new asset has an owner, license, target path, and runtime assignment.
- Verify there are no unassigned derivatives or placeholder remnants.

## Boundaries

- This workflow does not select a proprietary provider.
- This workflow does not implement gameplay or own scene architecture.
- Use `godot-visual-qa.md` for the visual verdict.
