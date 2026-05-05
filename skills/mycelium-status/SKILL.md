---
name: mycelium-status
description: Authoring guidance for Mycelium status records — workspace-state snapshots that separate pre-existing changes from new agent work
---

# Mycelium status record authoring

Use this guidance when you write status records under `substrate/traces/status/`. Status records capture the repository state before agent work begins. They separate pre-existing changes from what the agent introduces during a session.

## What status records are

Status records are point-in-time snapshots of uncommitted repository changes. They serve as a baseline so that later verification can distinguish between:

- Changes the user made before the task started
- Changes the agent made during the task

Status records do not dump raw diffs. They summarize the nature, scope, and origin of pre-existing changes.

## When to write a status record

Write a status record when `git status` or `git diff` shows uncommitted changes before you start work. This happens when:

- The user manually edited files before invoking an agent
- A previous agent session left uncommitted changes
- The repository has staged but uncommitted work

Skip when the working tree is clean and no pre-existing changes exist.

## File naming

Use this format with hyphenated suffixes to indicate the record type:

```text
substrate/traces/status/YYYY-MM-DD-<task-slug>-workspace-state.md
substrate/traces/status/YYYY-MM-DD-<task-slug>-preexisting-changes.md
```

Convention:

- `-workspace-state.md` — the default ending for general pre-work snapshots
- `-preexisting-changes.md` — use this ending when the emphasis is on specific uncommitted changes rather than general state
- Choose the ending that best fits the character of the record

Examples from this repository:

```text
2026-05-04-orchestrator-researcher-threshold-workspace-state.md
2026-04-19-orchestrator-operation-reuse-workspace-state.md
2026-04-20-godot-skill-preexisting-changes.md
2026-03-27-preexisting-changes.md
```

## Frontmatter

Use YAML frontmatter with these fields:

```yaml
---
status: recorded
created_at: YYYY-MM-DD
---
```

## Body structure

Include these sections:

1. **Summary** — one paragraph describing the nature of pre-existing changes and their context
2. **Observed files** — list of files with uncommitted changes and what state they are in
3. **Use during this task** — how this status record informs the current session: what to preserve, what to treat as baseline, what conflicts to expect

## Usage workflow

When `git status` or `git diff` shows uncommitted changes before work begins, follow these steps in order:

1. Run `git status` and `git diff` to detect and understand the changes.
2. Ensure the `substrate/traces/status/` directory exists (create it if missing).
3. Ensure `.gitignore` includes `substrate/traces/status/` so status records are never tracked by git.
4. Create the status record under `substrate/traces/status/` using the naming convention described above. Summarize the nature, scope, and origin of pre-existing changes — do not dump raw diffs.
5. Use the record throughout the session to distinguish original changes from agent work.

## Available references

See existing status records under `substrate/traces/status/` for working examples.
