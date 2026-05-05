---
status: completed
created_at: 2026-04-09
updated_at: 2026-05-05
files_edited:
  - README.md
  - setup.sh
  - thoughts/shared/status/2026-04-09-readme-dry-run-preexisting-changes.md
  - thoughts/shared/operations/2026-04-09-readme-and-dry-run-update.md
  - substrate/traces/operations/2026-04-09-readme-and-dry-run-update.md
rationale:
  - align public documentation with the actual repository contents and setup flow
  - add a safe preview mode to the installer without changing normal setup behavior
  - allow setup previews and installs from non-release branches used for agent work
  - keep dry-run output aligned with later export handling for `OPENCODE_ENABLE_EXA=true`
  - record that no DRC or EXP files exist in this repository per locator results
  - refresh README as comprehensive entrypoint covering purpose, setup flow, agent/command/skill architecture, MCP integrations, release model, and contribution flow
  - remove stale "plugins/" references and align manual rsync docs with real setup.sh exclusions
  - document DRC/EXP as supported concepts rather than present content since no such files exist on disk
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - thoughts/shared/research/2026-04-09-repository-improvement-opportunities.md
  - README.md
  - setup.sh
---

# README and dry-run update

## Summary of changes

- Updated `README.md` to match the real repository state, simplify quick start, remove inaccurate references, and document the new `--dry-run` capability.
- Extended `setup.sh` with `--dry-run` and `--help`, while preserving the existing user change that maps channels to clone branches.
- Recorded the pre-existing uncommitted workspace changes before starting this task.

## Technical reasoning

- The README is a product surface for this repository, so it must describe only files and behaviors that actually exist.
- A dry-run mode is a low-risk way to improve installer trust because it exposes target paths, clone branch selection, rsync behavior, and alias handling without modifying the system.
- Preserving the prior uncommitted branch-selection logic in `setup.sh` avoids overwriting user work while layering the new preview mode on top.

## Impact assessment

- Users can now preview setup actions safely before applying them.
- The README now better separates runtime-synced files from repository-internal files and avoids stale structural references.
- No release or sync behavior changed outside the requested dry-run and help additions.

## Validation steps

- Verified the modified file contents directly in `README.md` and `setup.sh`.
- Checked shell syntax with `bash -n setup.sh`.
- Exercised preview mode with `bash ./setup.sh --dry-run --channel alpha`.
- Synced markdownlint configuration and verified Markdown with `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix` followed by a zero-error lint run.

## Update on 2026-04-24

### Summary of changes

- Relaxed `setup.sh` channel parsing so `--channel` can receive arbitrary branch names such as `async`.
- Kept the existing `stable` to `main` mapping and the direct `beta` and `alpha` branch mappings.
- Updated `--help` text to describe channel or branch-name usage.

### Technical reasoning

- Agent development now needs temporary installation branches outside release channels.
- The existing clone flow already resolves `branch="$CHANNEL"`, so removing the whitelist is the smallest compatible change.
- Keeping alias behavior unchanged avoids widening scope beyond branch acceptance.

### Impact assessment

- Contributors can test branches such as `async` through `bash setup.sh --channel async --dry-run` or normal setup execution.
- Release-channel behavior remains compatible for `stable`, `beta`, and `alpha`.
- Invalid or missing remote branches fail at `git clone`, matching Git behavior.

### Validation steps

- Read and inspected `setup.sh`, `AGENTS.md`, `.github/CONTRIBUTING.md`, and `.gitignore`.
- Verified no pre-existing tracked workspace changes before implementation.
- Checked syntax with `bash -n setup.sh`.
- Exercised dry-run behavior for `async`, `main`, `stable`, `beta`, and `alpha`.
- Verified help output with `bash setup.sh --help`.
- Ran ShellCheck with `docker run --rm -v "$PWD/setup.sh:/mnt/setup.sh:ro" koalaman/shellcheck:stable /mnt/setup.sh`.

## Update on 2026-04-26

### Summary of changes

- Documented that `setup.sh` now idempotently manages `export OPENCODE_ENABLE_EXA=true` in same shell RC file as `sync-opencode` alias.
- Recorded that dry-run output now reports export handling.
- Reconfirmed repo locator results show no DRC or EXP files under `substrate/directives/` or `substrate/expectations/`.

### Technical reasoning

- Keeping alias and export edits in same RC file preserves single-source shell startup state.
- Idempotent export replacement prevents duplicate config lines on repeated runs.
- Dry-run must expose export behavior so preview matches live setup semantics.

### Impact assessment

- Shell startup files now converge to one alias line and one export line after reruns.
- Preview mode gives clearer visibility into all shell RC mutations.
- No docs under DRC or EXP paths exist, so no linked policy file needs updates.

### Validation steps

- Used provided validation results: `bash -n setup.sh`, `bash ./setup.sh --dry-run --channel alpha`, ShellCheck via `koalaman/shellcheck:stable`.
- Verified live temp-home setup ran twice with `export_count=1` and `alias_count=1`.
- Verified temp-home replacement from `export OPENCODE_ENABLE_EXA=false` to true with old count 0.
- Synced markdownlint configuration and ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix` to zero errors.

## Update on 2026-05-05

### Summary of changes

- Comprehensive README refresh to document repository purpose, setup flow, agent/command/skill architecture, MCP integrations, release model, and contribution flow.
- Removed stale `plugins/` references since no such directory exists in the repository.
- Aligned manual rsync documentation with actual `setup.sh` exclusion behavior (whole `substrate/` tree excluded from sync; `substrate/` is repo-internal).
- Added installer options (`--channel`, `--help`) and prerequisite descriptions (`curl`, `git`, `rsync`, `mktemp`, shell rc file, Docker for contributing).
- Described primary entrypoints (mode: primary agents — `orchestrator`, `planner`, `quick`, `commit`, `security`, `directives-writer`, `expectations-writer`), subagent categories under `agent/`, and `skills/`/`command/` directory purposes.
- Documented MCP integrations (`figma`, `shadcn`, `chrome-devtools`) and semantic-release model (`alpha` → `beta` → `main`).
- Clarified that no DRC or EXP files exist on disk; README now presents these as supported Mycelium concepts rather than present content.
- Only file edited for implementation was `README.md`; this operation file update is the documentation trail.

### Technical reasoning

- The README is the repository's public-facing entrypoint and must accurately reflect what exists, not what is planned.
- Stale structural references (e.g., `plugins/`) mislead users and agents; removing them from documentation reduces confusion.
- Documenting the `substrate/` directory as repo-internal and excluded from sync aligns user expectations with installer behavior.
- Explicitly listing what does not exist (DRC, EXP files) prevents future agents from searching for missing content while keeping the architectural blueprint visible.

### Impact assessment

- Users and agents now have a single accurate overview of repository structure, setup mechanics, and architecture.
- No runtime behavior, release pipeline, or sync logic changed; this is a documentation-only refresh.
- Future contributors arriving via README will understand the correct directory layout and contribution flow without discovering stale references.

### Validation steps

- Confirmed workspace was clean before starting (`git status` reported no tracked changes).
- Read `README.md`, `setup.sh`, `opencode.jsonc`, `AGENTS.md`, `.github/CONTRIBUTING.md`, and all agent/command/skill directories.
- Verified no `plugins/` directory exists on disk and no DRC/EXP files exist under `substrate/directives/` or `substrate/expectations/`.
- Verified README content matches actual directory structure and setup.sh behavior by cross-referencing each claim against the filesystem.
- Only file modified for implementation was `README.md`.
