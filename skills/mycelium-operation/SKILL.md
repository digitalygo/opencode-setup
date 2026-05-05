---
name: mycelium-operation
description: Authoring guidance for Mycelium operation records, the primary audit trail for agent decisions and changes
---

# Mycelium operation record authoring

Use this guidance when you write operation records under `substrate/traces/operations/`. Operations are the primary audit trail for agent decisions, implementation work, and process changes.

## What operation records are

Operation records document completed agent work. They capture what changed, why it changed, and how the change was validated. They are the first place future agents look to understand past decisions.

## When to write an operation record

- A task was completed successfully
- A meaningful decision was made about a process, architecture, or workflow
- A previous operation's decision was revised, extended, or replaced

Do not write an operation record for trivial changes, failed attempts without outcome, or work that has no decision or process value.

## File naming

Use this format:

```text
substrate/traces/operations/YYYY-MM-DD-description.md
```

- `YYYY-MM-DD` is today's date
- `description` is a brief kebab-case summary of the work

## Record reuse over new files

Before creating a new file, research existing operation records with the traces subagents. If an existing operation already covers the same decision, process, or feature, and the new work meaningfully extends or changes it, update that record instead of creating a new one. Related completed tasks may live in the same operation record when they belong to the same decision, process, or feature — batch them at creation time when they are clearly connected. Only create a new record when the work is unrelated or merging would confuse history.

## Frontmatter

Use YAML frontmatter with these required fields:

```yaml
---
status: completed
created_at: YYYY-MM-DD
files_edited: [array of modified file paths]
rationale: [brief justification for changes]
supporting_docs: [array of reference links]
---
```

Optional fields:

- `updated_at` — when updating an existing record, add the new date here; keep the original `created_at`

## Body structure

Include these sections:

1. **Summary of changes** — what was changed, in one or two sentences
2. **Technical reasoning** — why the change was made, what problem it solves, what alternatives were considered
3. **Impact assessment** — what downstream effects the change has on other processes, agents, or repository structures
4. **Validation steps** — how the change was verified: files read, diffs reviewed, commands run

## Updating an existing record

When new work revises or extends a decision already captured in an operation record:

1. Keep the original `created_at`
2. Add or update `updated_at` to the current date
3. Extend `files_edited`, `rationale`, and `supporting_docs` arrays as needed
4. Append a clearly labeled update section at the bottom of the body with:
   - Date of the update
   - Summary of new work
   - Technical reasoning specific to the update
   - Impact assessment
   - Validation steps

## Discordant follow-up work

When new work disagrees with what a prior operation says but the correlation is strong enough to keep in one file, update that existing record. State what changed and why. Do not split related decision history across files when one narrative container preserves chronology better.

## Cross-references

Always include supporting documentation links, related research traces, and related tickets when available. List them in the `supporting_docs` frontmatter array and link from the body where relevant. Operation records serve as navigational hubs for future agents researching past decisions.

## Available references

None currently. The source of truth for operation format lives in this skill and in the existing operation files under `substrate/traces/operations/`.
