---
status: completed
created_at: 2026-06-08
files_edited:
  - README.md
  - agent/media-analyzer.md
  - agent/orchestrator.md
  - agent/planner.md
  - agent/quick.md
  - agent/security.md
  - agent/directives-writer.md
  - agent/expectations-writer.md
  - agent/wiki.md
  - substrate/traces/reviews/2026-06-08-media-analyzer-prompt-security.md
rationale:
  - add a dedicated read-only multimodal subagent that can analyze documents, images, audio, video, and other files with a media-capable model
  - make the new subagent callable from the repository's primary agents and document when to use it
  - harden media-derived delegation against prompt injection and secret disclosure after security review
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - opencode.jsonc
  - substrate/traces/operations/2026-04-15-go-dev-subagent.md
  - substrate/traces/operations/2026-04-16-security-workflow-expansion.md
  - substrate/traces/operations/2026-05-18-wiki-agent.md
  - substrate/traces/reviews/2026-06-08-media-analyzer-prompt-security.md
---

# Summary of changes

- Added `agent/media-analyzer.md` as a new read-only multimodal subagent using `opencode/gemini-3.5-flash` for detailed analysis of documents, PDFs, images, screenshots, diagrams, audio, video, and other readable files.
- Updated the primary-agent prompts and repository roster so `media-analyzer` is explicitly discoverable and callable where research-style delegation happens.
- Applied security-review remediation so media-derived content is treated as untrusted data by parent agents and the media subagent never emits exact secret values.

# Technical reasoning

The repository already had a mature family of read-only locator and analyzer subagents for code, directives, expectations, and traces, but no equivalent agent for non-code artifacts. That gap mattered because several workflows need content extracted from files that are not source code: screenshots, diagrams, recorded briefings, PDFs, scan reports, UI mockups, and other multimodal inputs.

The new `media-analyzer` follows the established read-only analyzer pattern: `mode: subagent`, restricted tool access, denied mutation and execution permissions, `caveman` session-start loading, and a prompt focused on describing what exists rather than acting on it. The model was set to `opencode/gemini-3.5-flash` because the user explicitly wanted a file-, image-, audio-, and video-capable model.

No `opencode.jsonc` change was needed. The repository already treats `agent/` as the runtime-discovered agent directory, and prior agent-addition traces confirmed that adding a new file under `agent/` is sufficient for sync and discovery.

The first security review found two prompt-level weaknesses: the initial media prompt still allowed exact secret transcription on caller request, and most parent agents did not carry a wiki-style untrusted-source boundary when delegating to `media-analyzer`. Both were remediated. The subagent now hard-redacts secrets regardless of caller request, and every parent agent that can invoke it now treats media files and media-derived output as untrusted data for fact extraction only. The directives and expectations writers were tightened further: they now require explicit user confirmation before converting media-derived instructions into DRC or EXP requirements.

# Impact assessment

- The repository now has a dedicated read-only path for multimodal file understanding without overloading code-analysis or web-research agents.
- Orchestrator, planner, quick, security, directives-writer, expectations-writer, and wiki can all delegate to `media-analyzer` within their existing role boundaries.
- The README subagent roster now exposes the new capability to future users and agents.
- Prompt-injection and secret-leak risk from analyzed media is reduced because the subagent and its parents now share explicit untrusted-content rules.
- No config registration, installer change, or setup-script change was required because the `agent/` directory is already synced and auto-discovered.

# Validation steps

- Read the relevant shared standards and repository rules from `.github/CONTRIBUTING.md` and `AGENTS.md` before delegation.
- Confirmed repository context with read-only research: no current `DRC-*` or `EXP-*` files exist, and prior agent-addition traces documented agent auto-discovery from `agent/`.
- Delegated the markdown implementation to `documentation-writer`, then read the resulting file contents directly for `agent/media-analyzer.md`, `agent/orchestrator.md`, `agent/planner.md`, `agent/quick.md`, `agent/security.md`, `agent/directives-writer.md`, `agent/expectations-writer.md`, `agent/wiki.md`, and `README.md`.
- Reviewed `git status --short`, scoped diffs, and `git diff --check` to confirm only the intended files changed and the diff stayed formatting-clean.
- Ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot` after the markdownlint config sync workflow; it passed with zero errors.
- Ran a read-only `codebase-analyzer` verification over the new subagent and its integration points; it confirmed the required model, read-only constraints, agent wiring, and no config-registration requirement.
- Ran `security-review-specialist` on the modified prompt files. It created `substrate/traces/reviews/2026-06-08-media-analyzer-prompt-security.md`, initially reported two medium findings, then updated the same review thread after remediation to mark both findings resolved with no new issues.
