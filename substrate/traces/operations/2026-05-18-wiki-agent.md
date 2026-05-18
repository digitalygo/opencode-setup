---
status: completed
created_at: 2026-05-18
updated_at: 2026-05-18
files_edited:
  - agent/wiki.md
rationale:
  - add a new primary agent specialized in LLM wiki curation and maintenance
  - fill a gap in the agent roster for non-code knowledge management
  - apply security review remediation: minimize task permissions, narrow write scope, add secret boundary, strengthen constraints
supporting_docs:
  - agent/quick.md
  - agent/planner.md
  - agent/orchestrator.md
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - substrate/traces/reviews/2026-05-18-wiki-agent-permission-overreach.md
---

# Summary of changes

- Added `agent/wiki.md` as a new primary agent for wiki curation and maintenance.
- No changes to `opencode.jsonc`; agents are auto-discovered from the `agent/` directory.
- No changes to any existing agent files.

# Technical reasoning

The repository has primary agents for planning (`planner`), quick research (`quick`), and implementation orchestration (`orchestrator`), but no agent dedicated to maintaining a user's LLM wiki. A wiki agent fills this gap by providing a specialized prompt for knowledge base curation: provenance-first updates, read-before-write discipline, canonical markdown structure, linking and backlink management, deduplication and merge-over-create behavior, stale content detection, and large-restructure proposal workflows.

The wiki agent is a primary (orchestrator-like) agent because wiki maintenance often requires coordinating multiple subagents for research and documentation tasks. It delegates to `web-researcher`, `traces-*`, `codebase-*`, `documentation-*`, and `complex-problem-researcher` subagents while enforcing a strict no-speculation policy.

Design choices:

- **Model**: `openai/gpt-5.4` matches the orchestrator and planner tier, appropriate for a primary coordination role.
- **Temperature**: `0.1` enforces factual, non-speculative output suitable for knowledge curation.
- **Color**: `#4a9f6e` (green) distinguishes it from existing primary agents (orchestrator purple, quick teal, planner pink).
- **Permissions**: write access limited to `docs/**/*.md`, `tmp/**/*.md`, `substrate/traces/**/*.md`, and `.gitignore`. All code files are denied. Task permissions mirror the read-only subagent set from `quick` and `planner`.
- **No implementation capability**: the agent explicitly states it does not implement code and directs users to the orchestrator for implementation work.

# Impact assessment

- Users can now invoke the `wiki` agent for knowledge base curation tasks without switching to a code-oriented agent.
- No existing agents were modified; zero risk of regression.
- The new agent follows all repository conventions: sentence case, second-person prompt style, markdown-friendly structure, and matching frontmatter schema.

# Validation steps

- Verified `agent/wiki.md` uses sentence case throughout headings and body.
- Confirmed second-person prompt style in all instructions.
- Checked frontmatter fields match the pattern from `agent/quick.md` and `agent/planner.md`.
- Verified permissions allow wiki-relevant paths and deny everything else.
- Confirmed `opencode.jsonc` requires no changes; agent auto-discovery handles the new file.
- Synced markdownlint configuration and ran markdown lint with zero errors on the new file.
- Reviewed file content directly to confirm no speculation, no implementation guidance, and strict wiki focus.
- Verified task permissions match only subagents listed in the delegation workflow; confirmed `directives-*` and `expectations-*` are removed.
- Confirmed edit permissions exclude `.gitignore` and restrict trace writes to `substrate/traces/operations/*.md`.
- Verified secret-handling boundary is present as a core principle and reinforced in critical constraints.
- Confirmed critical constraints use `Do **NOT**` pattern matching peer primary agents.
- Ran `grep` for `directives-*` and `expectations-*` in `agent/wiki.md` — zero matches.
- Ran `grep` for `.gitignore` and `substrate/traces/` in the permission block — zero matches for the old broad globs.

---

## Update 2026-05-18: security review remediation

### Summary of new work

Applied all high and medium findings from `substrate/traces/reviews/2026-05-18-wiki-agent-permission-overreach.md` to `agent/wiki.md`. Six changes made: removed `directives-*` and `expectations-*` from task permissions (H1), narrowed `substrate/traces/**/*.md` to `substrate/traces/operations/*.md` (H2), removed `.gitignore` write access (M2), added a secret-handling boundary as a new core principle plus a critical constraint (M1), strengthened the critical constraints section to use `Do **NOT**` all-caps pattern (M3), and updated the file editing permissions summary and operation record instruction to reflect narrowed scope (H2/L1).

### Technical reasoning

The initial agent definition mirrored task permissions from `quick` and `planner` without tailoring to the wiki agent's actual delegation list. This granted write-capable `directives-writer` and `expectations-writer` subagents — which can modify files that govern all agent behavior — to an agent whose prompt never invokes them. The broad `substrate/traces/**/*.md` write glob covered security reviews, research documents, and status files outside the wiki domain. `.gitignore` access had no prompt-level justification. No secret-reading boundary existed despite the provenance-first principle encouraging broad file reads.

Each fix maps directly to a security review finding:

| Fix | Finding | Change |
|-----|---------|--------|
| Remove `directives-*`, `expectations-*` | H1 | Task permissions now match only subagents listed in the delegation workflow |
| Narrow traces write scope | H2 | `substrate/traces/operations/*.md` replaces `substrate/traces/**/*.md` |
| Remove `.gitignore` | M2 | No longer in edit permissions |
| Secret boundary (core principle) | M1 | New principle before "Strict no-speculation" |
| Secret boundary (constraint) | M1 | Added to critical constraints |
| Strengthen constraints | M3 | All constraints use `Do **NOT**` all-caps; new entries for secrets and operation record integrity |

### Impact assessment

- Wiki agent can no longer delegate to directive or expectation subagents, eliminating the privilege escalation path to agent behavior control.
- Wiki agent can only write its own new operation records under `substrate/traces/operations/`, not modify existing records by other agents, review files, or research documents.
- `.gitignore` is no longer writable by the wiki agent.
- Secret files matching `.env*`, `*secret*`, `*token*`, `*credential*`, `*.pem`, `*.key`, and `.secrets/` are explicitly off-limits for both reading and surfacing.
- Critical constraints now match the strong prohibition language of peer primary agents `quick` and `planner`.

### Validation steps

- Read `agent/wiki.md` frontmatter and confirmed task permissions include only `traces-*`, `codebase-*`, `documentation-*`, `web-researcher`, `complex-problem-researcher`.
- Confirmed edit permissions exclude `substrate/traces/**/*.md` (now `substrate/traces/operations/*.md`), `.gitignore`, and all non-markdown paths.
- Verified new "Secret and sensitive file boundary" section exists as a core principle.
- Confirmed critical constraints section includes six entries with `Do **NOT**` all-caps pattern and explicit secrets prohibition.
- Read "File editing permissions" summary — reflects narrowed scope and no longer mentions `.gitignore`.
- Read operation record instruction — now includes constraint against modifying other agents' records.
- Ran `grep -r "directives-\*" agent/wiki.md` — zero matches.
- Ran `grep -r "expectations-\*" agent/wiki.md` — zero matches.
- Ran `grep "\.gitignore" agent/wiki.md` — zero matches outside descriptive context.
- Verified markdown structure remains lint-clean: sentence case, consistent heading hierarchy, no trailing whitespace.