# Universal dependency dictionary plan

## Problem statement

The repository needs one shared dependency dictionary that every synced OpenCode install can consult before installing or bumping packages, frameworks, images, actions, and similar dependencies. The current state is fragmented: version guidance is duplicated across agent prompts, skills, config, and CI references. At the same time, the repository sync model is one-way and overwrites local runtime files on every sync (`setup.sh:255-257`), so a collaborator machine cannot act as the authoritative writer for a universal dictionary.

## Decision summary

This plan recommends a three-layer design.

1. **Authoritative shared catalog**
   - Store the canonical dictionary in the repository under `skills/dependency-catalog/references/dependency-catalog.toml`.
   - Keep the policy in `skills/dependency-catalog/SKILL.md` so agents load one shared rule set instead of duplicating instructions.

2. **Runtime consumption rule**
    - All dependency-installing or dependency-bumping agents must load the dependency-catalog skill before touching dependencies.
    - They must compare requested versions using ecosystem-aware rules from the catalog entry.
    - The catalog acts as a minimum approved baseline, not as a maximum allowed version.

3. **Maintainer-driven catalog maintenance workflow**
   - The synced copy in `~/.config/opencode/` is a read-only mirror for collaborators.
   - The central catalog is updated through Renovate or maintainer curation inside this repository, not by mutating the synced copy and hoping sync will preserve it.
   - The default design must not assume GitHub credentials or `GITHUB_TOKEN` are available on every collaborator machine.
   - The preferred first implementation is Renovate running on `opencode-setup`, not direct agent write-back from arbitrary repositories.

## Target state

After implementation, the repository should behave like this:

- `skills/dependency-catalog/` exists and is synced to every machine
- the catalog is readable at runtime because `~/.config/opencode/skills/**` is already allowed by `opencode.jsonc:55-58`
- install-capable agents load the skill and consult the catalog before dependency operations
- each catalog entry includes version semantics, source verification metadata, and update policy
- when a catalog version is higher than the requested or current project version, the agent attempts the bump toward the catalog target
- when the requested or current project version is higher than the catalog version, the agent uses that higher version and does not try to downgrade toward the catalog
- optional local observations can be stored in a preserved `.state/` path if distributed discovery is desired

## Proposed catalog shape

Use one machine-readable file. TOML is the recommended format because it is readable by humans, structured enough for automation, supported directly by Renovate's `jsonata` custom manager, and already maps well to version-catalog patterns used by other ecosystems. JSON is technically viable, but it adds noise for maintainers without adding a clear benefit for this repository's workflow.

Example shape:

```toml
schema_version = 1
updated_at = "2026-05-25"

[entries.php]
ecosystem = "language"
comparison = "semver"
recommended_version = "8.5.0"
constraint = ">=8.5 <9.0"
prompt_baseline = "8.5+"
policy = "minor-track"
stability = "stable"
source_url = "https://www.php.net/downloads"
verified_at = "2026-05-25"

[entries.laravel]
ecosystem = "framework"
comparison = "semver"
recommended_version = "13.0.0"
constraint = "^13.0"
prompt_baseline = "13+"
policy = "major-track"
stability = "stable"
source_url = "https://laravel.com/docs/13.x/releases"
verified_at = "2026-05-25"

[entries."docker:ghcr.io/digitalygo/pentest-toolbox"]
ecosystem = "docker"
comparison = "docker-tag"
recommended_version = "2026.05.0"
policy = "digest-pin"
stability = "stable"
source_url = "https://ghcr.io/digitalygo/pentest-toolbox"
verified_at = "2026-05-25"
```

Mandatory fields should be:

- `ecosystem`
- `comparison`
- `recommended_version`
- `policy`
- `source_url`
- `verified_at`

Optional fields should cover install constraints, human prompt rendering, and compatibility notes.

## Step-by-step procedure

### 1. Create the shared dependency-catalog skill

**Expected subagents:** `documentation-writer`

Create:

- `skills/dependency-catalog/SKILL.md`
- `skills/dependency-catalog/references/dependency-catalog.toml`

The skill should define:

- where the catalog lives
- how to normalize dependency identifiers
- how to compare versions per ecosystem
- the exact rule for `catalog version > project version`
- the exact rule for `project or request version > catalog version`
- that the catalog is a shared baseline, not a forced downgrade target

This step is first because it establishes the shared contract before any agent prompt changes start depending on it.

### 2. Decide whether distributed local observations are required

**Expected subagents:** `codebase-analyzer`, `documentation-writer`

Choose between two modes:

- **Simpler mode:** only the repository catalog exists; collaborators cannot publish discoveries automatically
- **Distributed mode:** collaborator machines can store local discovery records until a maintainer promotes them

If distributed mode is chosen, add:

- preserved local path such as `~/.config/opencode/.state/dependency-catalog-observations.jsonl`
- `setup.sh` logic to preserve `.state/` like `.secrets/`
- `opencode.jsonc` external-directory allowance for `~/.config/opencode/.state/**`

This decision should happen before implementation spreads because it changes both sync and permission boundaries.

In both modes, the default rule should stay the same: an agent working inside another repository may read the shared catalog but should not assume it can write back to `digitalygo/opencode-setup` directly.

### 3. Refactor agent prompts to consume the skill

**Expected subagents:** language/framework dev agents plus `documentation-writer`

Update all install-capable or dependency-bumping agents so they load the dependency-catalog skill before dependency work. Prioritize agents that already carry version guidance or dependency-management opinions, for example:

- `agent/php-laravel-dev.md`
- `agent/ruby-dev.md`
- `agent/python-dev.md`
- `agent/javascript-typescript-dev.md`
- `agent/go-dev.md`
- `agent/web-app-dev.md`
- `agent/static-site-dev.md`
- `agent/docker-specialist.md`
- `agent/github-actions-workflow-specialist.md`

During this step, convert duplicated hard-coded version guidance into catalog-backed guidance where appropriate.

### 4. Refactor runtime config and documented floating references

**Expected subagents:** `documentation-writer`, `codebase-pattern-finder`

Audit catalog-controlled references in:

- `opencode.jsonc`
- `README.md`
- security prompts using `:latest`
- CI workflow references under `.github/`

For each case, decide whether the correct policy is:

- exact pin
- bounded track
- floating by explicit exception

This step prevents the new catalog from existing while major runtime references still bypass it.

### 5. Add catalog validation and refresh workflow

**Expected subagents:** `documentation-writer`, optionally `web-researcher`

Add one repository workflow for maintaining catalog quality. This can be a command, script, or agent-assisted routine, but it should validate:

- unique entry IDs
- required field presence
- supported comparison modes
- parsable timestamps
- allowed policy values
- source URL presence

The refresh workflow should also define how a newer verified version becomes a catalog update in this repository.

The recommended baseline is Renovate:

- configure Renovate to watch `skills/dependency-catalog/references/dependency-catalog.toml`
- use `customManagers` with `customType: jsonata` and `fileFormat: toml`
- model each auto-managed entry with `datasource`, `depName`, `currentValue`, and explicit `versioning`
- let Renovate open PRs against `opencode-setup` for maintainer review

This workflow updates the central baseline, while project sessions remain free to use newer dependency versions when the active repository is already ahead.

### 6. Add optional maintainer promotion automation

**Expected subagents:** `documentation-writer`, `github-actions-workflow-specialist` if CI automation is chosen

If you want the repository catalog to be updated from discoveries made on collaborator machines, introduce one explicit promotion path that does not depend on every machine having GitHub credentials:

- Renovate PRs for catalog entries that can be auto-resolved from datasources
- maintainer runs a promotion command inside `opencode-setup`
- collaborator writes a local proposal into a preserved outbox that a maintainer later imports
- maintainer opens a PR or issue containing the proposed new version and source URL

Given the current repository model, the safest baseline is Renovate for resolvable entries plus local proposal and later maintainer promotion for everything else.

### 7. Run security and repository-compliance review before rollout

**Expected subagents:** `security-review-specialist`

This feature touches permissions, synchronized runtime files, potential remote update behavior, and dependency decision policy. A security review is mandatory before treating the rollout as complete.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| local synced copy is mistaken for the universal writer | updates disappear on next sync and never reach collaborators | treat synced catalog as read-only mirror; require explicit maintainer promotion path |
| catalog file placed outside `skills/` | agents cannot reliably read it through normal file tools | keep authoritative synced catalog under `skills/dependency-catalog/` |
| local observation queue is added without sync preservation | collaborator discoveries are deleted by `rsync --delete` | preserve `.state/` in `setup.sh` before enabling distributed mode |
| version comparison is done as plain string comparison | wrong bump decisions across ecosystems | require `comparison` field per entry and validate it |
| agent treats the catalog as a hard ceiling | repositories already ahead get downgraded or blocked unnecessarily | define the catalog as a minimum approved baseline and honor newer project versions |
| floating `latest` entries remain implicit | drift and non-reproducible installs continue | make floating behavior explicit as a catalog policy, not an accidental default |
| agents publish unverified newer versions | catalog becomes noisy or unsafe | require `source_url`, `verified_at`, and maintainer review/promotion flow |
| collaborators lack GitHub credentials | automatic repo update fails or produces inconsistent behavior | make credential-free consumption the default and keep publication maintainer-only |
| Renovate cannot resolve some curated entries | PRs are incomplete or noisy | use Renovate only for entries with clean datasources and keep the rest manual |
| permissions are widened too broadly for local state | unnecessary external read/write surface | allow only the exact preserved local state path if distributed mode is enabled |

## Success criteria

- a committed authoritative catalog exists under `skills/dependency-catalog/`
- a shared skill defines lookup, comparison, and promotion behavior
- at least the main install-capable agents load the skill before dependency operations
- the catalog can represent exact pins, bounded tracks, and explicit floating exceptions
- a collaborator machine cannot silently fork the shared catalog by editing only the synced runtime copy
- the default workflow does not require collaborators to have `GITHUB_TOKEN` or other repository write credentials
- Renovate can open PRs for the subset of catalog entries that have resolvable datasources and versioning metadata
- agents upgrade stale dependency requests toward the catalog baseline but do not downgrade repositories that are already ahead
- if distributed discovery is enabled, the local state path survives sync and is permissioned narrowly
- the final design passes security review and repository-compliance review

## Research references

- `substrate/traces/research/2026-05-25-universal-dependency-dictionary.md`
- `README.md:47-75`
- `opencode.jsonc:55-58`
- `setup.sh:228-257`
- `agent/orchestrator.md:26`
- `agent/php-laravel-dev.md:19-20`
- `agent/ruby-dev.md:17-18,37`
- `agent/python-dev.md:30`
- `agent/security-specialist.md:25`
- `substrate/traces/operations/2026-04-15-language-version-alignment.md:18-41`
- `https://docs.gradle.org/current/userguide/version_catalogs.html`
- `https://docs.gradle.org/current/userguide/dependency_verification.html`
- `https://pnpm.io/catalogs`
- `https://docs.renovatebot.com/configuration-options/`
- `https://docs.renovatebot.com/modules/manager/jsonata/`

## Recommended next execution step

When you want to implement this, switch to the `orchestrator` agent and execute the work in this order:

1. create the dependency-catalog skill and authoritative catalog file
2. decide whether distributed local observations are in scope for v1
3. update permissions and sync behavior only if distributed mode is needed
4. refactor install-capable agents to consume the skill
5. add validation and promotion workflow
6. run security review before rollout
