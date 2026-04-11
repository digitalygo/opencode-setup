---
description: Migrate repository from legacy thoughts/intents layout to Mycelium substrate standard
agent: orchestrator
---

# migrate-to-mycelium

migrate a repository from the legacy `thoughts/` and `intents/` layout to the Mycelium substrate standard.

## purpose

this command performs a structure-only migration:

- moves `thoughts/` content to `substrate/traces/` (removing the `shared/` layer)
- moves `intents/` content to `substrate/directives/` (legacy intents were developer instructions)
- creates `substrate/expectations/` for new repositories (no legacy source; expectations capture client expectations)
- preserves all files and nested structure
- refuses to proceed on ambiguous or conflicting states

## execution steps

### 1. detect current layout

use glob and read tools to determine repository state:

- check if `substrate/traces/` or `substrate/directives/` exists
- check if `thoughts/` or `intents/` exists
- classify into one of four states

#### state 1: already migrated

conditions:

- `substrate/traces/` or `substrate/directives/` exists
- `thoughts/` and `intents/` do not exist

action: report success and exit. no changes needed.

#### state 2: legacy layout present

conditions:

- `thoughts/` and/or `intents/` exist
- `substrate/` does not exist

action: proceed with migration (see step 2).

#### state 3: new repository

conditions:

- neither old nor new layout exists

action: create empty `substrate/traces/`, `substrate/directives/`, and `substrate/expectations/` directories. report success.

#### state 4: mixed layout (ambiguous)

conditions:

- both old and new locations exist with content

action: stop. report error. require manual review.

message: "ambiguous layout detected: both legacy and substrate paths exist. manual review required."

### 2. execute migration (state 2 only)

for legacy repositories, perform these moves in order:

1. create `substrate/` directory if missing
2. create `substrate/traces/` subdirectory
3. create `substrate/directives/` subdirectory
4. create `substrate/expectations/` subdirectory (new, no legacy source)
5. move `thoughts/shared/operations/` → `substrate/traces/operations/`
6. move `thoughts/shared/plans/` → `substrate/traces/plans/`
7. move `thoughts/shared/research/` → `substrate/traces/research/`
8. move `thoughts/shared/reviews/` → `substrate/traces/reviews/`
9. move `thoughts/shared/status/` → `substrate/traces/status/`
10. move any remaining `thoughts/` content → `substrate/traces/`
11. move `intents/` → `substrate/directives/` (legacy intents were developer instructions)
12. verify all files exist at new paths
13. remove empty old directories (`thoughts/shared/*`, then `thoughts/`, `intents/`)

### 3. safety checks

before each move:

- verify source path exists
- verify destination path does not exist (refuse to overwrite)
- if destination exists, stop and report conflict

after all moves:

- list files in each new directory
- compare count to expected
- if verification fails, stop and report

### 4. update configuration files

after successful migration:

1. read `.gitignore`
2. if `thoughts/shared/status/` is ignored, replace with `substrate/traces/status/`
3. write updated `.gitignore`
4. read `.markdownlintignore`
5. if `thoughts/` is ignored, replace with `substrate/traces/`
6. write updated `.markdownlintignore`

### 5. report results

output a summary:

```text
migration complete: repository converted to Mycelium layout

moved:
- {count} files from thoughts/ to substrate/traces/
- {count} files from intents/ to substrate/directives/ (developer instructions)

created:
- substrate/expectations/ (client expectations, no legacy source)

new structure:
- substrate/traces/operations/
- substrate/traces/plans/
- substrate/traces/research/
- substrate/traces/reviews/
- substrate/traces/status/
- substrate/directives/ (structured developer instructions, DRC-*.md)
- substrate/expectations/ (client expectations, EXP-*.md)

updated:
- .gitignore
- .markdownlintignore

next steps:
- agents will now use substrate/ paths automatically
- commit these changes to preserve the migration
```

## error handling

if any step fails:

1. stop immediately
2. report which step failed and why
3. do not proceed to subsequent steps
4. do not claim success

common failure modes:

- destination exists (refuse to overwrite)
- source file missing during verification
- permission denied
- mixed layout detected

## constraints

- do not modify file contents (structure-only migration)
- do not overwrite existing files
- do not proceed on mixed layouts
- verify before deleting source directories
