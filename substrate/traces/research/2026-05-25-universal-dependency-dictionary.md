# Universal dependency dictionary research

## Scope

This research evaluates how to add one shared dependency dictionary for all synced OpenCode installs distributed from this repository. The goal is to let agents read one authoritative version catalog before installing or bumping dependencies, and to define how project or requested versions should interact with the catalog.

## Executive summary

The repository can support a shared dependency dictionary, but not as a plain local file in `~/.config/opencode/`. The current sync model is one-way fan-out from this repository to each machine, and `setup.sh` uses `rsync --delete`, so local edits are overwritten on the next sync (`setup.sh:255-257`). A second constraint is that runtime tool access to external paths is denied except for `~/.config/opencode/skills/**` (`opencode.jsonc:55-58`). Because of those two rules, the best design is a three-part system: a committed authoritative catalog stored under `skills/`, a shared skill that teaches every install-capable agent how to read and compare entries, and a separate maintainer-driven promotion workflow for publishing newer versions back to this repository instead of mutating local synced copies.

## What I reviewed

- `README.md:47-75`
- `opencode.jsonc:1-128`
- `setup.sh:157-299`
- `agent/orchestrator.md:24-56`
- `agent/php-laravel-dev.md:17-33`
- `agent/ruby-dev.md:15-38`
- `agent/python-dev.md:21-39`
- `agent/security-specialist.md:23-46`
- `.github/workflows/release.yml:1-34`
- `.github/dependabot.yml:1-12`
- `substrate/traces/operations/2026-04-15-language-version-alignment.md:1-41`
- `https://docs.gradle.org/current/userguide/version_catalogs.html`
- `https://docs.gradle.org/current/userguide/dependency_verification.html`
- `https://pnpm.io/catalogs`
- `https://docs.renovatebot.com/configuration-options/`
- `https://docs.renovatebot.com/modules/manager/jsonata/`

## Findings

### 1. Version guidance already exists, but it is fragmented

The repository already stores version decisions in multiple places:

- language and framework baselines in agent prompts, for example `PHP 8.5+` and `Laravel 13+` in `agent/php-laravel-dev.md:19-20`, `Ruby 4.0+` and `Rails 8.1+` in `agent/ruby-dev.md:17-18,37`, and `Python 3.12+` in `agent/python-dev.md:30`
- floating package references in runtime config, for example `shadcn@latest` and `chrome-devtools-mcp@latest` in `opencode.jsonc:41-50`
- floating Docker image tags such as `ghcr.io/digitalygo/pentest-toolbox:latest` in `agent/security-specialist.md:25,45`
- CI dependency references such as `actions/checkout@v6` and `cycjimmy/semantic-release-action@v6` in `.github/workflows/release.yml:27,32`

The repository already needed one manual alignment pass to restore consistency across prompt versions (`substrate/traces/operations/2026-04-15-language-version-alignment.md:18-41`). This confirms that version data is currently duplicated and can drift.

### 2. A synced local file is not a shared writable source of truth

The installer clones the repository into a temporary directory and copies files into `~/.config/opencode/` with `rsync -av --delete` (`setup.sh:228-257`). The synced copy is not a git checkout. That means:

- local edits in `~/.config/opencode/` do not flow back to this repository
- any untracked local file inside the sync target is deleted on the next sync unless it is explicitly excluded
- the only preserved local directory today is `.secrets/` because rsync excludes it and `setup.sh` preserves it (`setup.sh:247-263`)

As a result, a collaborator machine cannot safely treat the synced copy as the authoritative writable dictionary. A real shared dictionary must live in version control here, or in another remote authority with an explicit write-back flow.

### 3. Runtime file permissions make `skills/` the safest shared location

The runtime permission model denies external directory access by default and allows only one subtree:

```jsonc
"external_directory": {
  "*": "deny",
  "~/.config/opencode/skills/**": "allow"
}
```

This is defined in `opencode.jsonc:55-58`. A catalog synced as `~/.config/opencode/dependency-catalog.toml` would therefore be blocked for `read`, `glob`, and `grep` tools during normal agent work. A catalog inside `~/.config/opencode/skills/**` would be allowed.

This makes a new skill directory the most reliable place for the authoritative synced catalog, for example:

```text
skills/dependency-catalog/SKILL.md
skills/dependency-catalog/references/dependency-catalog.toml
```

### 4. The repository has no directives or expectations yet

There are no `DRC-*.md` files under `substrate/directives/` and no `EXP-*.md` files under `substrate/expectations/`. The current design space is therefore unconstrained by repository-specific directive or expectation documents. Any future dependency dictionary behavior should be captured explicitly once the feature is implemented.

### 5. The right model is a catalog, not a free-form note

The external references converge on a consistent pattern:

- Gradle version catalogs centralize dependency versions in a machine-readable catalog and separate version definitions from consumption.
- pnpm catalogs centralize reusable dependency ranges and support named catalogs for phased migrations.
- Gradle dependency verification shows the value of attaching provenance and verification metadata instead of storing only a raw version string.

For this repository, that means the dictionary should be machine-readable and carry metadata, not just a Markdown table.

### 6. Version comparison must be ecosystem-aware

A single global version string is not enough because the repository mixes different kinds of version semantics:

- semver-like languages and frameworks in agent prompts
- npm package versions and tags
- Docker tags or digests
- GitHub Actions major tags
- floating `latest` references in several places

If agents compare versions with raw string logic, they will make incorrect decisions. Every catalog entry needs an explicit comparison mode or ecosystem so the agent knows how to interpret the value.

### 7. Renovate can manage a custom TOML catalog inside this repository

Renovate's official documentation confirms that custom managers can be configured through `customManagers`, and that the `jsonata` custom manager supports `json`, `toml`, and `yaml` file formats. The same docs state that a custom manager must extract at least:

- `datasource`
- `depName` or `packageName`
- `currentValue`

The docs also recommend explicitly setting `versioning`.

That means a catalog like `skills/dependency-catalog/references/dependency-catalog.toml` can be updated by Renovate as long as each auto-managed entry exposes enough metadata for Renovate to resolve releases from a known datasource.

### 8. Renovate solves the credential problem better than cross-repo agent write-back

If Renovate runs on the `opencode-setup` repository, only Renovate needs repository write capability to open PRs. Collaborator machines do not need GitHub credentials, `GITHUB_TOKEN`, or cross-repository scope. This matches the repository's distribution model much better than asking arbitrary project sessions to push back into `digitalygo/opencode-setup`.

### 9. Renovate is best for resolvable entries, not for every policy decision

Renovate can propose updates only for entries that map cleanly to a supported datasource and versioning scheme. It is therefore a strong fit for:

- npm packages
- PyPI packages
- Docker images
- GitHub release or tag tracked projects
- GitHub Actions references, if modeled appropriately

It is weaker for entries that are intentionally curated and not meant to track the latest upstream automatically, such as:

- approved baselines that lag upstream by policy
- entries sourced from sites that do not map cleanly to a Renovate datasource
- entries where the desired catalog value is a human decision rather than the newest release

For those cases, the catalog still benefits from the same schema, but updates should remain manual or maintainer-reviewed.

## Analysis

### Why a single synced file is necessary

The user goal is consistency across all OpenCode installs. That requires one authoritative source that every synced machine receives automatically. The repository already has that distribution channel through `setup.sh`, so the lowest-friction approach is to version the catalog in this repository and sync it with the rest of the runtime configuration.

### Why the synced file cannot also be the write target on collaborator machines

The sync path is read-distribution, not collaboration. A collaborator's `~/.config/opencode/` copy is disposable runtime state, not the source repository. If agents edit the synced copy directly, the change is local-only and will be lost on the next sync. That means the design must separate:

- **authoritative catalog**: committed to this repository and synced everywhere
- **promotion path**: how a newer version becomes part of the authoritative catalog

Without that split, the feature looks universal but behaves locally.

### Why a skill should own the policy

The repository already uses skills to avoid duplicating shared operational rules. A dependency dictionary feature would otherwise require repeating the same instructions across many install-capable agents. A dedicated skill keeps the logic centralized:

- where the catalog lives
- how to normalize package names
- how to compare versions per ecosystem
- when to prefer the catalog version
- when to propose or publish a newer version

This follows the same anti-duplication pattern already used elsewhere in the repository.

### Recommended schema shape

The authoritative file should be machine-readable and store at least these fields per entry:

- `id`: normalized identifier such as `php`, `laravel`, `npm:react`, `docker:ghcr.io/digitalygo/pentest-toolbox`
- `ecosystem`: `language`, `framework`, `npm`, `pypi`, `composer`, `docker`, `github-action`, and so on
- `comparison`: how the agent compares values, for example `semver`, `docker-tag`, `github-action-major`, or `opaque`
- `recommended_version`: the exact version or tag to target
- `constraint`: optional install range such as `^18.3.1` or `>=8.5 <9.0`
- `policy`: for example `exact`, `minor-track`, `major-track`, `digest-pin`, or `floating`
- `stability`: for example `stable`, `lts`, `latest-approved`, or `legacy-supported`
- `source_url`: authoritative upstream source used for verification
- `verified_at`: when the entry was last checked
- `verified_by`: human or agent identifier

Optional fields can capture prompt rendering needs such as `prompt_baseline = "8.5+"` when the exact catalog value and the human-facing prompt phrasing are intentionally different.

### Recommended lifecycle

The cleanest lifecycle is:

1. agent reads the catalog before dependency installation or bump work
2. agent normalizes the dependency key and compares the request using the entry's comparison mode
3. if the catalog is newer than the requested or current project version, the agent upgrades toward the catalog version
4. if the requested or current project version is newer than the catalog, the agent uses that newer version and does not try to force it back down to the catalog value
5. catalog updates happen independently through Renovate or a maintainer workflow, not from arbitrary project sessions

### The catalog should act as a minimum approved baseline, not a ceiling

The user's clarified rule produces a simpler and safer operational model:

- **catalog > request/project** → try to use the catalog version
- **request/project > catalog** → use the higher project/requested version as-is

This means the catalog is a shared minimum approved baseline for new work, not a hard maximum. Agents should use it to avoid starting projects on stale dependencies, but they should not downgrade or block work just because an active repository is already ahead.

This also removes most of the need for agent-driven promotion logic. The central catalog can catch up later through Renovate PRs or explicit maintainer curation.

### Why automatic repo write-back is a bad default

Even if an agent is running with this OpenCode setup synced locally, it may be working inside a completely different repository. In that session, the dependency catalog is only a shared runtime reference, not the active workspace. That creates two practical problems:

- the agent may be outside the `opencode-setup` repository scope when it discovers a newer version
- collaborators may not have reusable GitHub credentials or tokens available for creating remote updates automatically

Because of that, the promotion path should not assume that every project session can push to or open PRs against `digitalygo/opencode-setup`. Automatic cross-repository publication should be treated as optional maintainer automation, not the baseline behavior.

### Why TOML is still the best default here

Renovate officially supports both JSON and TOML through the `jsonata` custom manager, so either format is technically viable. TOML remains the better fit for this use case because:

- it stays human-readable during maintainer review
- it maps naturally to a catalog structure with named entries or arrays of tables
- it avoids the noise of plain JSON while still remaining machine-readable
- Renovate supports TOML directly, so there is no automation penalty

JSON would be preferable only if the catalog were primarily produced and consumed by external tooling that expects strict JSON-first workflows. Given this repository's mix of human maintenance, PR review, and skill reference files, TOML is the better default.

## Recommendations

1. **Create a dedicated shared skill**
   - Add `skills/dependency-catalog/SKILL.md`
   - Add `skills/dependency-catalog/references/dependency-catalog.toml`
   - Instruct install-capable agents to load that skill before dependency changes

2. **Treat the synced catalog as read-only on collaborator machines**
   - Do not rely on direct edits inside `~/.config/opencode/` as the universal update mechanism
   - Promote changes back to this repository only from an explicit maintainer workflow

3. **Use a two-stage model by default**
   - Stage 1: every agent can consume the catalog with no credentials
   - Stage 2: only a maintainer workflow can promote newer versions back into the repository catalog

4. **Prefer Renovate as the first promotion workflow**
   - Configure Renovate on `opencode-setup` to watch `skills/dependency-catalog/references/dependency-catalog.toml`
   - Use a `customManagers` entry with `customType = jsonata` and `fileFormat = toml`
   - Limit auto-management to entries that expose a resolvable `datasource`, `depName`, and `currentValue`
   - Keep PR creation centralized in the repository, so collaborators do not need tokens
   - Treat catalog values as the shared baseline for stale dependencies, not as a ceiling that must override newer project versions

5. **Add a local observation queue only if you want distributed discovery**
   - If collaborator machines should record newer versions locally, introduce a preserved local path such as `~/.config/opencode/.state/`
   - That requires both `setup.sh` preservation logic and an `external_directory` allow rule in `opencode.jsonc`
   - This queue should store proposals for later promotion, not try to update the central repository directly

6. **Prefer exact approved versions over floating `latest` for shared catalog entries**
   - Floating tags can remain as an explicit policy when truly desired, but the catalog should default to approved exact versions or clearly bounded tracks

7. **Add validation early**
   - Validate unique IDs, required fields, comparison-mode compatibility, and timestamp/source presence before the catalog is considered authoritative

## Verified source references

- Repository sync and overwrite behavior: `setup.sh:228-257`
- Synced versus repo-internal paths: `README.md:47-75`
- External directory permission boundary: `opencode.jsonc:55-58`
- Current duplicated version guidance examples: `agent/php-laravel-dev.md:19-20`, `agent/ruby-dev.md:17-18,37`, `agent/python-dev.md:30`, `agent/security-specialist.md:25`
- Existing version alignment maintenance trace: `substrate/traces/operations/2026-04-15-language-version-alignment.md:18-41`
- External catalog patterns: `https://docs.gradle.org/current/userguide/version_catalogs.html`, `https://pnpm.io/catalogs`
- External verification pattern: `https://docs.gradle.org/current/userguide/dependency_verification.html`
- Renovate custom manager and TOML support: `https://docs.renovatebot.com/configuration-options/`, `https://docs.renovatebot.com/modules/manager/jsonata/`
