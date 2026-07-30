---
name: dependency-catalog
description: Shared dependency version catalog for dependency-installing and dependency-bumping agents. Load before adding, updating, or recommending dependencies.
---

# Dependency catalog

Use this skill to consult the shared dependency version catalog before adding, updating, or recommending any dependency. The catalog defines approved baseline versions that apply across all synced OpenCode installs.

## Where the catalog lives

The authoritative catalog is `references/dependency-catalog.toml` inside this skill directory. It is synced to every machine as part of the OpenCode setup (`~/.config/opencode/skills/dependency-catalog/references/dependency-catalog.toml`) and is readable at runtime because `~/.config/opencode/skills/**` is allowed.

## When to use

- before installing a new dependency
- before bumping an existing dependency
- before recommending a dependency version to a user
- when updating package manifests, Dockerfiles, CI workflows, or IaC module references

## How to read the catalog

1. the catalog is long — do not read the entire file by default. instead, search for the dependency you need first: grep by `id` (e.g., `npm:react`, `pypi:pytest`, `docker:caddy`) or by upstream name (e.g., `oven-sh/bun`). the catalog lives at `references/dependency-catalog.toml` relative to this skill. when working outside this repo, use the synced path `~/.config/opencode/skills/dependency-catalog/references/dependency-catalog.toml`
2. once you find the matching line, read only the nearby section (the surrounding `[[entries]]` block) to get the full entry. managed entries use an `ecosystem:name` prefix: `npm:react`, `pypi:pytest`, `github-action:actions/checkout`, `docker:caddy`, `composer:laravel/framework`, `rubygems:rails`, `runtime:node-lts`, `language:python`, `language:ruby`, `runtime:bun`, `iac:opentofu`, `automation:ansible-core`. curated entries use plain strings: `php`
3. check the `comparison` field for the versioning scheme: `semver`, `python`, `composer`, `ruby`, `docker`, `github-actions`, or `node`. combined with `policy = minimum-baseline`, the catalog version is a floor — use at least this version, higher is allowed

## Operational rules

### Version comparison

When a catalog entry exists for a dependency:

- **catalog version > requested or current project version**: try to use or upgrade toward the catalog version
- **requested or current project version > catalog version**: use the higher project or requested version as-is; do not downgrade toward the catalog

The catalog is a **minimum approved baseline**, not a ceiling. use it to avoid starting work on stale dependencies, but never force downgrades on repositories that are already ahead.

### Missing entries

If no matching catalog entry exists, use your best judgment for the version. Report the absence to the user so the entry can be created or curated.

### Catalog maintenance

The catalog is maintained through two paths:

- **managed entries**: auto-updated by Renovate running on `digitalygo/opencode-setup`. These entries track a resolvable upstream datasource and receive automated PRs.
- **curated entries**: manually updated by maintainers when the desired version is a policy decision rather than the latest upstream release.

You do not have write access to the catalog. If you discover a newer version or a missing entry, report it to the user rather than editing the catalog directly.

## Catalog schema

The catalog has top-level metadata (`schema_version`, `updated_at`) and an array of tables (`[[entries]]`). Each entry has these fields:

```toml
schema_version = "1.0.0"
updated_at = "2026-05-25"

[[entries]]
id = "runtime:bun"
mode = "managed"
ecosystem = "runtime"
comparison = "semver"
recommended_version = "1.3.14"
policy = "minimum-baseline"
source_url = "https://github.com/oven-sh/bun"
notes = "Bun runtime"
datasource = "github-releases"
dep_name = "oven-sh/bun"
versioning = "semver"
extract_version = "^bun-v(?<version>.+)$"
```

| field | meaning |
|---|---|
| `schema_version` | catalog format version (top-level) |
| `updated_at` | last modification date (top-level) |
| `id` | entry identifier; `ecosystem:name` prefix for managed entries, plain string for curated entries |
| `mode` | `managed` (auto-updated by Renovate) or `curated` (maintainer-set) |
| `ecosystem` | domain classifier: `npm`, `pypi`, `php`, `ruby`, `docker`, `github-actions`, `language`, `runtime`, `iac`, `automation` |
| `comparison` | versioning scheme: `semver`, `pep440`, `python`, `composer`, `ruby`, `docker`, `github-actions`, or `node` |
| `recommended_version` | the approved baseline version to target |
| `policy` | always `minimum-baseline` — the catalog is a floor, not a ceiling |
| `source_url` | authoritative upstream source for verification |
| `notes` | human-readable context about the entry |
| `datasource` | Renovate datasource (`npm`, `pypi`, `packagist`, `rubygems`, `docker`, `github-tags`, `github-releases`, `node-version`, `python-version`, `ruby-version`); only on managed entries |
| `dep_name` | upstream package name used by Renovate; only on managed entries |
| `versioning` | version comparison scheme for Renovate (`npm`, `pep440`, `python`, `composer`, `ruby`, `node`, `regex:...`); only on managed entries |
| `extract_version` | optional tag normalization regex forwarded to Renovate as `extractVersion`; only on managed entries |

## Ecosystem-specific notes

### npm packages

Match by `id` prefix `npm:` (e.g., `npm:react`, `npm:next`, `npm:typescript`, `npm:tailwindcss`). `comparison = semver`, `policy = minimum-baseline`. Start from `recommended_version`; accept newer within the same major when appropriate.

### pypi packages

Match by `id` prefix `pypi:` (e.g., `pypi:pytest`, `pypi:ruff`, `pypi:mypy`, `pypi:pydantic`). `comparison = pep440`, `policy = minimum-baseline`. Start from `recommended_version`; accept newer compatible releases.

### composer packages

Match by `id` prefix `composer:` (e.g., `composer:laravel/framework`, `composer:pestphp/pest`, `composer:laravel/pint`, `composer:filament/filament`). `comparison = composer`, `policy = minimum-baseline`. Start from `recommended_version`; accept newer within the same major when appropriate.

### rubygems

Match by `id` prefix `rubygems:` (e.g., `rubygems:rails`, `rubygems:rspec`, `rubygems:rubocop`, `rubygems:brakeman`). `comparison = ruby`, `policy = minimum-baseline`. Start from `recommended_version`; accept newer within the same major when appropriate.

### Docker images

Match by `id` prefix `docker:` (e.g., `docker:oven/bun`, `docker:caddy`). `comparison = docker`, `policy = minimum-baseline`. Prefer the `recommended_version` tag. Check `notes` for variant info (e.g., alpine variant).

### GitHub Actions

Match by `id` prefix `github-action:` (e.g., `github-action:actions/checkout`, `github-action:cycjimmy/semantic-release-action`, `github-action:opentofu/setup-opentofu`). `comparison = github-actions`, `policy = minimum-baseline`. Use `recommended_version` as the baseline and pin to the full commit SHA for immutability in the workflow file.

### Language and runtime baselines

Managed entries with prefixed `id` strings (e.g., `runtime:node-lts`, `language:python`, `language:ruby`, `runtime:bun`). Comparison varies by entry: `semver`, `ruby`, `python`, or `node`. `policy = minimum-baseline`. Use `recommended_version` as the minimum; do not downgrade projects already running newer versions.

### IaC and automation

Managed entries with prefixed `id` strings (e.g., `runtime:bun`, `iac:opentofu`, `automation:ansible-core`). Comparison is `semver` or `pep440`. `policy = minimum-baseline`. Use `recommended_version` as the minimum baseline.
