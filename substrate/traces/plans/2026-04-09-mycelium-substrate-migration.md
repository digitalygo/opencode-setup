# Mycelium substrate migration plan

## Decision summary

The repository will adopt the **Mycelium** framework name and replace the current root-level runtime layout with a new substrate-based structure.

### Final target names

- framework name: `Mycelium`
- agent-written documentation: `substrate/traces/`
- human-written behavioral documents: `substrate/directives/`

### Explicit decisions from this planning session

- migrate **all** existing files from the old layout
- perform a **hard cutover**, not a long compatibility phase
- the repository migration command must do **structure-only migration** for project content
- `shared/` must be removed from the traces layout
- `agent/` in this repository remains the OpenCode agents folder and is unrelated to the new Mycelium namespace

## Problem statement

The current repository still treats `thoughts/` and `intents/` as first-class root directories. That creates three problems:

1. `thoughts/shared/` adds a middle layer that the team no longer wants and does not use semantically.
2. `thoughts/` and `intents/` sit outside a coherent framework namespace.
3. prompts, permissions, docs, and setup logic are now tightly coupled to the old paths.

The goal is to define one new standard that is strong enough to apply both to this setup repository and to existing user repositories without losing any existing files.

## Target layout

### New canonical structure

```text
substrate/
├── traces/
│   ├── operations/
│   ├── plans/
│   ├── research/
│   ├── reviews/
│   └── status/
└── directives/
    ├── [area]/
    ├── _schema.yaml
    └── _templates/
```

### Path mapping

| Old path | New path |
| --- | --- |
| `thoughts/shared/operations/` | `substrate/traces/operations/` |
| `thoughts/shared/plans/` | `substrate/traces/plans/` |
| `thoughts/shared/research/` | `substrate/traces/research/` |
| `thoughts/shared/reviews/` | `substrate/traces/reviews/` |
| `thoughts/shared/status/` | `substrate/traces/status/` |
| `thoughts/` | `substrate/traces/` |
| `intents/` | `substrate/directives/` |
| `intents/_schema.yaml` | `substrate/directives/_schema.yaml` |
| `intents/_templates/` | `substrate/directives/_templates/` |

## Naming rationale

The chosen names separate the two authorship models clearly:

- `traces/` are records left by agents while they research, plan, review, and operate.
- `directives/` are human-authored expectations that guide behavior and remain readable by both humans and agents.

This is stronger than the old `thoughts/` and `intents/` pair because it encodes both purpose and authorship more clearly while staying broad enough for future growth.

## Migration strategy

## 1. Repository-standard migration

This repository must change first, because it defines the prompts, permissions, docs, and tooling that will migrate user repositories later.

### Scope of changes in this repository

#### Agent frontmatter permissions

The following files currently grant read or edit permissions for `thoughts/` or `intents/` and must be updated to the new Mycelium paths:

- `agent/orchestrator.md:11-19`
- `agent/planner.md:11-26`
- `agent/quick.md:9-18`
- `agent/traces-locator.md:18-21`
- `agent/traces-analyzer.md`
- `agent/directives-locator.md:18-21`
- `agent/directives-analyzer.md`
- `agent/intents-writer.md:10-20`
- `agent/complex-problem-researcher.md`

These are the most critical runtime changes because stale path permissions would immediately break read and write access after the folder move.

#### Agent prompt bodies

The following files contain instructional text that references the old layout and must be rewritten:

- `agent/orchestrator.md:37-110`
- `agent/planner.md:33-90`
- `agent/quick.md:32-70`
- `agent/traces-locator.md:24-54`
- `agent/traces-analyzer.md`
- `agent/directives-locator.md:24-55`
- `agent/directives-analyzer.md`
- `agent/intents-writer.md:24-93`

These changes are required even if the project migration command itself only moves files, because the framework repository must stop teaching the old standard.

#### Commands and skills

- `command/review.md:61-84` currently writes review files under `thoughts/shared/reviews/`
- `skills/directives-schema/SKILL.md:86-94` still references `intents/_templates/`

#### Documentation and setup

- `README.md:38-79` still refers to `thoughts/` and `intents/`
- `setup.sh` currently excludes `thoughts/` from sync and must exclude `substrate/traces/` instead
- `.gitignore:3` currently ignores `thoughts/shared/status/`
- `.markdownlintignore:6` currently ignores `thoughts/`

### Historical documents policy

Existing operational and research documents under the old tree should be **moved but not text-rewritten**, unless a specific document is meant to describe the new standard.

That keeps the migration command aligned with the user's requirement of **structure-only migration** for project content and preserves historical accuracy.

This means old documents may still mention `thoughts/` or `intents/` in their body text. That is acceptable because they are historical records, not active routing instructions.

## 2. User-repository migration command

The migration command should be designed for **existing repositories already containing old-layout files**.

### Required behavior

The command must:

1. detect whether the repository is already on the new layout
2. detect whether the repository is still on the old layout
3. move all existing files safely from old locations to new locations
4. preserve all nested files and subdirectories
5. refuse to overwrite an already-populated target path unless explicitly supported later
6. be idempotent enough to exit cleanly if the repository is already migrated

### Recommended command shape

The migration should be implemented as a dedicated script or command, not as an inline one-liner.

Recommended location options:

- a dedicated command definition in `command/`
- a bundled script invoked by that command
- documentation and fallback guidance inside a dedicated skill

### Why not a pure one-line `rsync`

`rsync` can help for copying, but on its own it is not enough because the migration needs:

- layout detection
- conflict detection
- safe refusal on ambiguous states
- cleanup of emptied old directories
- post-move verification

Using `mv` or `rsync` inside a script is fine. Using a raw one-liner as the official migration path is too fragile.

### Recommended algorithm

#### Detection phase

Check for these states in order:

1. **already migrated**
   - `substrate/traces/` exists or `substrate/directives/` exists
   - `thoughts/` and `intents/` do not exist
   - result: exit successfully with a message that the repository already uses Mycelium

2. **old layout present**
   - `thoughts/` and/or `intents/` exist
   - result: continue with migration

3. **new or uninitialized repo**
   - neither old nor new layout exists
   - result: create only the new canonical directories if the command is intended to bootstrap, otherwise exit with guidance

4. **ambiguous mixed layout**
   - old and new locations both exist
   - result: stop and require manual review

#### Move phase

For old repositories:

1. create `substrate/` if missing
2. move `thoughts/shared/operations/` to `substrate/traces/operations/`
3. move `thoughts/shared/plans/` to `substrate/traces/plans/`
4. move `thoughts/shared/research/` to `substrate/traces/research/`
5. move `thoughts/shared/reviews/` to `substrate/traces/reviews/`
6. move `thoughts/shared/status/` to `substrate/traces/status/`
7. migrate any other non-shared content directly under `thoughts/` into `substrate/traces/` after explicit detection
8. move all of `intents/` to `substrate/directives/`
9. remove empty old directories only after verification succeeds

### Why move subdirectories instead of renaming `thoughts/` wholesale

Because `shared/` is intentionally being removed. The migration must therefore re-home each subdirectory, not simply rename `thoughts/` to `substrate/traces/`.

## Safety rules for the migration command

The command should enforce these checks before making changes:

1. fail if the repository has both old and new layouts populated
2. fail if a destination subdirectory already exists and is non-empty
3. print a migration plan before execution
4. support a preview mode
5. verify every moved source path has a matching destination path before deleting empty parents

### Recommended output

The command should report:

- detected repository state
- source paths found
- destination paths to be created
- each move action
- any skipped or unknown directory
- final success summary

## Skill design

The user's idea of backing this with a skill is good and should be part of the rollout.

### Purpose of the skill

The skill should explain what to do when the expected folders are not found and act as a migration-awareness document for agents.

### Suggested responsibilities

The skill should tell agents:

1. first look for `substrate/traces/` and `substrate/directives/`
2. if not found, check for legacy `thoughts/` and `intents/`
3. if legacy layout exists, explain that the repository uses the old standard
4. recommend the official migration command
5. if neither layout exists, treat the repository as new or not yet initialized

### Suggested description direction

A concise description aligned with the user's idea would be:

> If you cannot find `substrate/traces/` or `substrate/directives/`, read this skill. The repository may be new, or it may still use the legacy `thoughts/` and `intents/` layout. Detect the current layout first and use the official migration command to move it to the Mycelium standard.

### Important boundary

The skill should explain detection and fallback behavior. The actual migration should still be performed by a dedicated command or script, not by prose alone.

## Rollout plan

## Phase 1. Finalize the standard

1. ratify the new canonical paths
2. ratify the historical-docs policy
3. ratify the migration command behavior for mixed-layout repositories

## Phase 2. Update the framework repository

1. update prompt bodies and permission globs in all affected agent files
2. update `command/review.md`
3. update `skills/directives-schema/SKILL.md`
4. update `README.md`
5. update `.gitignore` and `.markdownlintignore`
6. update `setup.sh` sync exclusions and any path messaging

This phase must land before the migration command is broadly used, otherwise the official setup will still teach stale paths.

## Phase 3. Add the migration tooling

1. introduce the migration skill
2. introduce the migration command or script
3. add preview mode and validation rules
4. document how to run it safely

## Phase 4. Migrate existing repositories

1. run the command in legacy repositories
2. verify that all old files exist in the new structure
3. verify no destination conflicts were silently overwritten
4. remove empty old directories

## Phase 5. Enforce the cutover

1. stop documenting legacy paths anywhere in current prompts and docs
2. treat mixed old/new repos as invalid until migrated
3. create new traces and directives only in the new locations

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| stale permission globs in agents | agents lose access to traces or directives | update frontmatter permissions in the same change set as prompt updates |
| migration command overwrites files in partially migrated repos | file loss | refuse mixed-layout repos and refuse non-empty destinations |
| old setup script still syncs traces into user config | polluted user installs | update `setup.sh` before rolling out the new standard |
| historical docs contain old path text | confusion in searches | document explicitly that old records preserve historical paths |
| `shared/` removal misses uncommon legacy subfolders | incomplete migration | include an explicit unknown-path detection step and print a warning instead of deleting anything unknown |

## Recommended implementation details

### Git move strategy in this repository

Inside this setup repository, use `git mv` where practical so history remains easier to inspect.

### User-repository move strategy

For external repositories, a script using `mv` or `rsync` plus validation is sufficient, because preserving git rename metadata is less important than safely preserving files.

### Suggested commit strategy

Keep the framework-repo update atomic in one repository-focused commit, then document the migration command separately if it lands as a distinct feature.

## Success criteria

The migration is complete when all of the following are true:

1. this repository no longer teaches or grants runtime access to `thoughts/` or `intents/`
2. all new runtime documentation paths use `substrate/traces/`
3. all new directive paths use `substrate/directives/`
4. the official migration command can move an old-layout repository without losing files
5. agents can detect legacy repositories and route users to the migration command through the supporting skill

## Recommended next execution step

Implementation should be done with the orchestrator agent in this order:

1. update framework repo references and permissions
2. add the migration skill
3. add the migration command or script
4. validate on a repository snapshot that still uses the old layout

That order minimizes the risk of shipping a migration tool before the framework itself understands the new Mycelium standard.
