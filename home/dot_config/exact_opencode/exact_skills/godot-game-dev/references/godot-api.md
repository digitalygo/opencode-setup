# Godot API lookup skill

## Purpose

Answer targeted Godot engine or GDScript questions without polluting main context with the entire documentation corpus.

Target engine baseline: Godot 4.6 stable, compatible with Godot 4.x.

## Use this when

- You need a class API.
- You need property, method, or signal names.
- You need correct GDScript syntax, constants, or engine naming.
- You must compare a small set of engine classes.

## Do not use this when

- The task is broad architecture planning.
- The task is full gameplay implementation.
- The answer can be given from already-loaded local context.

## Workflow

1. If class is known, search index first.
2. Read only specific class docs needed.
3. If local docs are unavailable, fall back to official Godot docs for exact class or topic.
4. If question is about GDScript patterns, read GDScript syntax reference.
5. Return concise, targeted answer.

## Answering rules

- Specific question -> only relevant methods, properties, and signals.
- Full API question -> summarized full class doc.
- Compare classes only when necessary.
- Never dump large doc trees into main context.

## Recommended doc sources

- preferred local mirror when available:
  - `_common.md`
  - `_other.md`
  - one file per Godot class
  - `gdscript.md`
- fallback when local mirror is missing:
  - <https://docs.godotengine.org/en/stable/classes/>
  - <https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/>

## Hard rules

- Do not enumerate giant directories.
- Do not read many classes “just in case”.
- Do not improvise enum names from memory.
- If local docs are missing, say so explicitly and use official docs instead of pretending a local mirror exists.

## Boundaries

- Do not use this file as project orchestrator.
- Do not use this file as screenshot reviewer.
- Do not use this file as runtime debugger by itself.
