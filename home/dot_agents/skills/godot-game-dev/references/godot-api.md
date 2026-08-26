# Godot API lookup workflow

## Purpose

Resolve exact Godot engine, GDScript, project-setting, and command-line questions from authoritative documentation without loading unrelated material.

Follow the version policy in `../SKILL.md`.

## Use this when

- A class, property, method, signal, constant, annotation, or enum must be verified.
- GDScript syntax or typing behavior is uncertain.
- A project setting or command-line flag is version-sensitive.
- Two engine types or approaches must be compared.

## Do not use this when

- The task is broad architecture planning.
- The answer is already proven by current project code and matching documentation.
- Runtime debugging is required to distinguish multiple valid API uses.

## Documentation selection

1. Determine the installed or pinned Godot version.
2. Use the official documentation for the matching minor version, such as `https://docs.godotengine.org/en/4.7/` for Godot 4.7.x.
3. Use `/en/stable/` only when it resolves to the same minor version as the project.
4. Use `/en/latest/` only to research future behavior, never as proof that an API exists in the stable target.
5. Prefer a repository-vendored documentation mirror only when its path, source version, and freshness are explicitly known.

## Workflow

1. Open the exact class or topic page.
2. Verify spelling, casing, signature, return type, lifecycle restrictions, and version notes.
3. Check a migration guide when behavior changed across the project's source and target versions.
4. Compare only the minimum set of classes needed for the decision.
5. Return the exact answer with a source link and version scope.

## Authoritative sources

- Class reference: `https://docs.godotengine.org/en/{minor}/classes/`
- GDScript reference: `https://docs.godotengine.org/en/{minor}/tutorials/scripting/gdscript/`
- Command-line reference: `https://docs.godotengine.org/en/{minor}/tutorials/editor/command_line_tutorial.html`
- Migration guides: `https://docs.godotengine.org/en/{minor}/tutorials/migrating/`
- Release archive: `https://godotengine.org/download/archive/`

Replace `{minor}` with the matching documentation version, for example `4.7`.

## Answering rules

- Include only relevant methods, properties, signals, settings, or flags.
- Use GDScript naming in GDScript examples.
- Do not translate C# PascalCase methods into guessed GDScript names.
- State when documentation does not prove a claim.
- Distinguish parsing, import, editor startup, runtime, and export guarantees.

## Hard rules

- Do not improvise enum names or serialized project-setting values.
- Do not cite an unspecified local mirror.
- Do not use development docs as stable-project evidence.
- Do not dump large documentation trees into context.

## Boundaries

- This workflow does not replace runtime validation.
- This workflow does not choose project architecture or perform visual QA.
