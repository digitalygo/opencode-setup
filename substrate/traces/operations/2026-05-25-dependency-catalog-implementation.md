---
status: completed
created_at: 2026-05-25
files_edited:
  - .github/renovate.json
  - agent/ansible-specialist.md
  - agent/docker-specialist.md
  - agent/github-actions-workflow-specialist.md
  - agent/go-dev.md
  - agent/javascript-typescript-dev.md
  - agent/opentofu-terraform-specialist.md
  - agent/php-laravel-dev.md
  - agent/python-dev.md
  - agent/ruby-dev.md
  - agent/static-site-dev.md
  - agent/web-app-dev.md
  - skills/dependency-catalog/SKILL.md
  - skills/dependency-catalog/references/dependency-catalog.toml
rationale:
  - Centralize dependency baselines in one synced catalog instead of duplicating version guidance across prompts and config.
  - Let Renovate maintain resolvable catalog entries without requiring collaborator tokens or cross-repository agent write-back.
  - Make install-capable agents consult the shared baseline while preserving the rule that newer project versions are not downgraded.
supporting_docs:
  - substrate/traces/research/2026-05-25-universal-dependency-dictionary.md
  - substrate/traces/plans/2026-05-25-universal-dependency-dictionary.md
  - substrate/traces/operations/2026-04-15-language-version-alignment.md
  - substrate/traces/operations/2026-05-05-mycelium-authoring-skills.md
---

# Dependency catalog implementation

## Summary of changes

Added a new `dependency-catalog` skill with a synced TOML reference catalog, wired the main dependency-managing agents to consult it, and added Renovate configuration so managed catalog entries can receive automated PRs in this repository.

## Technical reasoning

The repository previously stored dependency guidance in duplicated prompt text, MCP configuration, workflow references, and tool snippets. That drift risk was already visible in the earlier language-version alignment operation. The new implementation moves the baseline into `skills/dependency-catalog/references/dependency-catalog.toml` and makes the skill the shared policy surface.

The catalog uses two entry modes:

- `managed` for resolvable upstream dependencies that Renovate can update through `.github/renovate.json`
- `curated` for runtime or policy baselines where maintainers still decide the approved version manually

The operational rule is intentionally asymmetric: if the catalog is ahead of the project, agents should try to use the catalog baseline; if the project is already ahead, agents keep the higher project version. This makes the catalog a minimum approved baseline instead of a ceiling and avoids downgrading active repositories.

Renovate was chosen over agent write-back because it keeps publication authority inside `opencode-setup`, avoids token requirements on collaborator machines, and fits the existing sync model where `~/.config/opencode/` is only a runtime mirror.

## Impact assessment

- Install-capable agents now load `dependency-catalog` together with `caveman` and have an explicit instruction to read `~/.config/opencode/skills/dependency-catalog/references/dependency-catalog.toml` before dependency changes.
- The repository now has one shared dependency baseline file with 45 managed entries and 7 curated entries covering npm, PyPI, Composer, RubyGems, Docker, GitHub Actions, and language/runtime baselines.
- Dependency baseline maintenance can now happen through Renovate PRs instead of manual scattered prompt edits for every managed entry.
- Future prompt refreshes or setup syncs can preserve version guidance more reliably because the baseline now lives in one dedicated skill reference file.

## Validation steps

- Read and verified all affected implementation files directly after subagent work.
- Ran Python validation for `.github/renovate.json` and `skills/dependency-catalog/references/dependency-catalog.toml`, including unique-id and managed-field checks.
- Ran `npx --yes --package renovate -- renovate-config-validator .github/renovate.json` and confirmed a clean validation result.
- Ran the shared Markdown lint workflow:
  - synced `.markdownlint.json` and `.markdownlintignore` from the upstream dotfiles source
  - ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - reran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
- Ran `security-review-specialist` on the modified config, prompt, and skill files. No security findings were reported and no review file was created.
