---
status: completed
created_at: 2026-05-25
updated_at: 2026-05-25
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
  - Expand the catalog with direct workspace dependencies and migrate convertible curated baselines to managed entries.
supporting_docs:
  - substrate/traces/research/2026-05-25-universal-dependency-dictionary.md
  - substrate/traces/plans/2026-05-25-universal-dependency-dictionary.md
  - substrate/traces/operations/2026-04-15-language-version-alignment.md
  - substrate/traces/operations/2026-05-05-mycelium-authoring-skills.md
  - https://docs.renovatebot.com/modules/datasource/node-version/
  - https://docs.renovatebot.com/modules/datasource/python-version/
  - https://docs.renovatebot.com/modules/datasource/ruby-version/
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

## Update 2026-05-25 — workspace dependency intake and managed runtime migration

### Summary of changes

Expanded `skills/dependency-catalog/references/dependency-catalog.toml` with the missing direct npm dependencies from the supplied workspace dependency set, converted `bun`, `opentofu`, and `ansible-core` from curated to managed where automation is supportable, and updated Renovate plus the dependency-catalog skill schema to pass optional `extract_version` metadata for GitHub release tags.

### Technical reasoning

The current catalog already treated managed entries as the only automation boundary through the Renovate JSONata manager. `bun` and `opentofu` both map cleanly to GitHub releases when tag normalization is made explicit, while `ansible-core` maps directly to PyPI with `pep440` versioning. In contrast, `php`, `ruby`, `python`, and `node-lts` remain policy baselines, so they stayed curated.

The supplied workspace data represented direct application dependencies rather than reusable transitive lockfile internals, so the catalog update imported only missing direct dependencies and preserved the existing minimum-baseline semantics. Renovate needed one schema extension: forwarding `extract_version` as `extractVersion` so GitHub release tags like `bun-v1.3.14` and `v1.12.0` resolve correctly without weakening the shared catalog structure.

### Impact assessment

- The shared dependency catalog now covers the supplied direct workspace dependencies without bloating the catalog with transitive-only packages.
- `runtime:bun`, `iac:opentofu`, and `automation:ansible-core` can now receive automated baseline PRs instead of manual curated updates.
- The dependency-catalog skill documentation now reflects the new managed ID prefixes and optional `extract_version` field.
- Codeowner-reviewed Renovate PRs remain the control point for these managed baseline updates.

### Validation steps

- Reviewed the modified `.github/renovate.json`, `skills/dependency-catalog/SKILL.md`, and `skills/dependency-catalog/references/dependency-catalog.toml` directly after subagent work.
- Ran local Python validation for JSON and TOML parsing, duplicate IDs, managed-field presence, and requested entry presence.
- Ran `npx --yes --package renovate -- renovate-config-validator .github/renovate.json` and confirmed a clean result.
- Ran `security-review-specialist` on the modified files. The review reported one low-severity pre-existing drift issue involving the separate `mistralai` runtime pin in `skills/mistral-ocr-pdf-to-md/SKILL.md`; no review file was written and the issue was left out of scope for this catalog update.

## Update 2026-05-25 — managed Node, Python, and Ruby runtimes

### Summary of changes

Converted `node-lts`, `python`, and `ruby` runtime baselines from curated to managed entries using Renovate's built-in runtime datasources, and aligned the dependency-catalog skill documentation with the new managed IDs and runtime versioning schemes.

### Technical reasoning

Follow-up verification against current Renovate datasource documentation showed that the repository no longer needed to keep these three entries curated purely for lack of datasource coverage. `node-version`, `python-version`, and `ruby-version` are all supported directly, so the catalog can now express these baselines as managed entries without custom scraping or regex extraction. The one semantic adjustment was Python: the runtime now uses `comparison = "python"` instead of `pep440`, because the entry tracks the language runtime rather than a PyPI package.

### Impact assessment

- `runtime:node-lts`, `language:python`, and `language:ruby` can now receive catalog update PRs through the same managed flow already used by Bun, OpenTofu, and ansible-core.
- `php` remains the only curated language/runtime baseline in the catalog.
- The dependency-catalog skill now documents the runtime-specific datasources and the `python` comparison mode, reducing ambiguity for future maintenance.

### Validation steps

- Read the modified runtime entries directly in `skills/dependency-catalog/references/dependency-catalog.toml` and confirmed the final mappings: `node-version/node/node`, `python-version/python/python`, and `ruby-version/ruby/ruby`.
- Re-ran local JSON and TOML validation plus duplicate-ID checks.
- Re-ran `npx --yes --package renovate -- renovate-config-validator .github/renovate.json` and confirmed a clean validation result.
- Re-ran `security-review-specialist` on `.github/renovate.json`, `skills/dependency-catalog/SKILL.md`, and `skills/dependency-catalog/references/dependency-catalog.toml`. No findings were reported and no review file was created for this scope.

## Update 2026-05-25 — targeted catalog lookup guidance

### Summary of changes

Refined `skills/dependency-catalog/SKILL.md` so agents no longer default to reading the entire `references/dependency-catalog.toml` file. The skill now directs them to search for the dependency first, read only the matching `[[entries]]` block, and explicitly report missing catalog entries to the user.

### Technical reasoning

The catalog has grown enough that full-file reads are wasteful and unnecessary for routine dependency work. The skill already uses stable identifiers and upstream names, so targeted lookup by `id` or package name is sufficient to find the relevant entry. Narrow reads reduce context load while preserving the baseline rule that the catalog is a minimum floor rather than a ceiling.

### Impact assessment

- Agents using the dependency-catalog skill should consume less context when checking versions.
- Missing catalog coverage is now surfaced explicitly to the user instead of being noted implicitly.
- No catalog semantics changed; only the lookup workflow and reporting behavior were tightened.

### Validation steps

- Read the updated `skills/dependency-catalog/SKILL.md` directly and confirmed the new lookup flow: search first, read only the nearby block, report missing entries to the user.
- Confirmed the minimum-baseline language remains intact in the same skill.
- Security gate skipped for this incremental step because the new work is prompt-only plus trace/status documentation, which is non-executable under the repository security workflow.
