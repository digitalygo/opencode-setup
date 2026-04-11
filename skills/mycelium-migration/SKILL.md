---
name: mycelium-migration
description: Read this if you detect legacy thoughts/ and intents/ layouts to gain instructions on how to enforce the migration to the Mycelium substrate standard
---

# Mycelium migration skill

you detect repository layouts and ensure hard cutover to the Mycelium standard. do not create new files in legacy paths.

## quick detection guide

when you need to read or write traces or directives, follow this detection order:

### step 1: check for Mycelium layout (current standard)

```text
substrate/traces/     → agent-written docs (operations, plans, research, reviews, status)
substrate/directives/ → human-authored behavioral directives
```

if these exist, use them exclusively.

### step 2: check for legacy layout

```text
thoughts/ → legacy agent-written docs (do not write here)
intents/  → legacy human-authored directives (do not write here)
```

if these exist and `substrate/` does not, the repository uses the legacy layout and must be migrated before any new files are created.

### step 3: handle the result

| detection result | action |
|-----------------|--------|
| Mycelium layout present | proceed normally using `substrate/traces/` and `substrate/directives/` |
| legacy layout only | **stop and migrate** - do not create new files in legacy paths |
| neither layout | treat as new repository; create `substrate/` structure as needed |
| both layouts | stop and request manual review; mixed layout is ambiguous |

## hard cutover rule

**do not create new traces or directives in legacy paths.**

if you detect a legacy-only repository:

1. stop any write operations
2. inform the user the repository must be migrated
3. offer to run the migration command
4. do not proceed with file creation until migration completes

this is a hard cutover, not a compatibility phase.

## migration command

when legacy layout is detected, inform the user:

> this repository uses the legacy `thoughts/` and `intents/` layout. the Mycelium framework requires `substrate/traces/` and `substrate/directives/`.
>
> to migrate, i will run the migration command.
>
> ```text
> migrate-to-mycelium
> ```
>
> this will safely move all files to `substrate/traces/` and `substrate/directives/`.

## migration details

### what moves where

| legacy path | new path |
|-------------|----------|
| `thoughts/shared/operations/` | `substrate/traces/operations/` |
| `thoughts/shared/plans/` | `substrate/traces/plans/` |
| `thoughts/shared/research/` | `substrate/traces/research/` |
| `thoughts/shared/reviews/` | `substrate/traces/reviews/` |
| `thoughts/shared/status/` | `substrate/traces/status/` |
| `thoughts/` (other content) | `substrate/traces/` |
| `intents/` | `substrate/directives/` |
| `intents/_schema.yaml` | `substrate/directives/_schema.yaml` |
| `intents/_templates/` | `substrate/directives/_templates/` |

### key changes

- `shared/` subdirectory is removed; content moves directly under traces
- `thoughts/` becomes `substrate/traces/`
- `intents/` becomes `substrate/directives/`

### safety guarantees

the migration command:

1. detects layout before making changes
2. refuses to proceed if both layouts exist (mixed state)
3. refuses to overwrite existing destination files
4. preserves all nested directory structure
5. provides verification before removing source directories

## your behavior guidelines

### when reading historical content

1. first try to read from `substrate/traces/` or `substrate/directives/`
2. if not found, check for legacy `thoughts/` or `intents/`
3. if legacy found, read the historical content but note it is read-only

### when writing traces or directives

1. always write to `substrate/traces/` and `substrate/directives/`
2. if these directories do not exist, create them or run migration first
3. **never** create new files in `thoughts/` or `intents/`
4. **never** create files in both locations simultaneously

### when running subagents

when running subagents with path-specific permissions on legacy layouts, they will fail. if a subagent reports permission denied:

1. check for legacy layout
2. migrate the repository first
3. then re-run the subagent

## reference

- migration command definition: `command/migrate-to-mycelium.md`
- framework documentation: see directives-schema skill for directive structure
