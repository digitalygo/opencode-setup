---
status: completed
created_at: 2026-04-15
files_edited:
  - agent/web-app-dev.md
  - agent/static-site-dev.md
  - agent/php-laravel-dev.md
  - agent/ruby-dev.md
  - agent/javascript-typescript-dev.md
  - agent/python-dev.md
rationale:
  - clarify house-stack defaults without turning agents into rigid one-stack-only prompts
  - refresh older developer prompts for consistency, wording quality, and current guidance
supporting_docs:
  - .github/CONTRIBUTING.md
  - AGENTS.md
  - substrate/traces/status/2026-04-15-agent-refresh-preexisting-changes.md
---

# Summary of changes

- Reworked `agent/web-app-dev.md` into a fuller house-style prompt centered on Next.js/React with Laravel backend, while explicitly allowing adaptation when project context requires another stack.
- Reworked `agent/static-site-dev.md` to preserve the Docker + Caddy + Bun static-site default while making its flexibility and operating model clearer.
- Refreshed `agent/php-laravel-dev.md` to keep Laravel-centric defaults but reduce unnecessary absolutes and fix wording issues.
- Cleaned up `agent/ruby-dev.md` with small consistency fixes and clearer Ruby-versus-Rails scope.
- Softened overly rigid guidance in `agent/javascript-typescript-dev.md` and `agent/python-dev.md` while keeping strong modern defaults.

# Technical reasoning

The user clarified that several agents are intentionally opinionated because they represent the team's working defaults, not generic ecosystem-wide templates. The refresh therefore focused on a precise balance:

- keep strong default stack guidance where the repository has a preferred way of working;
- make explicit that agents must still adapt when the existing project or user request requires something else;
- reduce outdated or overly universal claims that could make agents less reliable in real repositories.

For `web-app-dev` and `static-site-dev`, the main improvement was turning implicit house assumptions into explicit default-stack sections and flexibility rules. For `php-laravel-dev`, `ruby-dev`, `javascript-typescript-dev`, and `python-dev`, the work primarily improved wording, removed stale framing, and aligned the level of prescription with practical usage.

# Impact assessment

- The orchestrator can keep using these agents as house-style specialists without making them unnecessarily brittle.
- Future tasks should see clearer default stack behavior for Laravel/Bun and Docker/Caddy/Bun workflows.
- Language-specific agents now better distinguish between defaults, recommendations, and context-driven exceptions.
- No non-agent runtime or setup behavior changed.

# Validation steps

- Checked repository status before editing and recorded pre-existing Go-subagent work separately in a status note.
- Read each target file after subagent edits instead of relying only on subagent summaries.
- Ran Markdown lint after the refresh and verified a zero-error result.
- Performed follow-up corrections for duplicate frontmatter keys, sentence case consistency, and prompt text conflicting with repository no-comments policy.
