# Repository improvement opportunities

## Scope

This research reviews the current `opencode-setup` repository and proposes improvements that are justified by the existing codebase, prior repository notes, and selected web sources.

## Executive summary

The repository already has a strong structure for agents, skills, release automation, and internal research. The main weaknesses are not random technical debt, but a few systemic gaps:

- important documented artifacts are referenced but missing, especially `AGENTS.md`
- the setup and release paths contain a few silent mismatches between what the repo says and what it actually does
- automation is present, but its safety and validation layers are still light
- the intents framework is well designed but not yet producing value because the repository has almost no real intent documents

If these points are addressed, the likely results are better onboarding, fewer broken or misleading workflows, safer releases, and clearer behavioral contracts for future work.

## What I reviewed

### Codebase and docs

- `README.md:3-70`
- `opencode.jsonc:1-131`
- `setup.sh:1-180`
- `.github/CONTRIBUTING.md`
- `.github/workflows/release.yml:1-34`
- `.github/dependabot.yml:1-12`
- `.github/CODEOWNERS:1-5`
- `.releaserc.json:1-34`
- `command/commit.md:1-9`
- `command/review.md:1-90`
- `agent/orchestrator.md:1-131`
- `agent/planner.md:1-92`
- `agent/commit.md:1-78`
- `agent/documentation-writer.md:1-101`
- `agent/general.md:1-35`
- `agent/quick.md:1-82`

### Repository memory in `thoughts/`

- `thoughts/shared/research/2026-03-27-opencode-intents.md:1-74`
- `thoughts/shared/research/2026-03-27-intent-based-specs-sistema.md:1-817`
- `thoughts/shared/operations/2026-03-30-intents-expectations-refresh.md:1-55`
- several related operations and status notes located through the thoughts agents

### External sources

- GitHub Actions workflow permissions docs: <https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions>
- GitHub Actions security hardening guide: <https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions>
- semantic-release GitHub Actions recipe: <https://github.com/semantic-release/semantic-release/blob/master/docs/recipes/ci-configurations/github-actions.md>
- Dependabot options reference: <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference>
- markdownlint-cli2 repository: <https://github.com/DavidAnson/markdownlint-cli2>

## Proposed improvements

## 1. Create `AGENTS.md` and make it the single source of truth for agent behavior

### Why change it

`AGENTS.md` is referenced as a required instruction file in `opencode.jsonc:22`, listed in the repository structure in `README.md:66`, and used as a compliance reference in multiple agents such as `agent/orchestrator.md:49`, `agent/planner.md:85`, `agent/general.md:23-24`, and `agent/documentation-writer.md:32,51-52,91`. The file does not exist.

This is the highest-value documentation gap because the repo already assumes it exists.

### What result it could bring

- faster onboarding for humans and agents
- fewer ambiguous responsibilities between agents
- less duplication across agent prompts
- fewer broken references in config and docs

### Why it matters strategically

Right now the repository has the cost of a shared meta-document without the benefit of having one. Creating it would turn scattered rules into a discoverable contract.

## 2. Fix the setup channel model so `--channel` actually affects installation

### Why change it

`setup.sh:72-99` parses `--channel`, but `setup.sh:115` always performs a plain `git clone --depth 1 https://github.com/digitalygo/opencode-setup.git "$TEMP_DIR"` with no branch selection. In practice, the flag is accepted but does not drive the clone behavior.

There is also a second mismatch in `setup.sh:151`, where the installed alias always points to `main`.

### What result it could bring

- alpha and beta users would actually receive alpha and beta content
- the release model in `.releaserc.json:2-14` would become operational end to end
- fewer support issues caused by users believing they are on one channel while actually syncing another

### Why it matters strategically

This is a trust issue more than a scripting issue. When an installation flag exists, users expect it to be real.

## 3. Harden release automation and reduce CI supply-chain risk

### Why change it

The release workflow is intentionally small, but it currently uses mutable action tags in `.github/workflows/release.yml:27,32` and broad workflow permissions in `.github/workflows/release.yml:7-12`.

GitHub recommends minimizing permissions and pinning actions to immutable commit SHAs. semantic-release also documents the required permissions for GitHub-based publishing.

### What result it could bring

- lower supply-chain risk in the release path
- clearer auditability of what code actually runs in CI
- fewer accidental permission grants than necessary

### Why it matters strategically

This repository distributes configuration that can modify user environments. Even though the workflow is simple, the release path is high leverage, so hardening it gives a strong risk reduction for relatively low effort.

## 4. Add a real validation gate before automatic releases

### Why change it

`.github/workflows/release.yml:18-34` goes directly from checkout to semantic-release. There is no lint or validation job before publishing.

At the same time, the repository depends heavily on Markdown-based agent instructions and configuration files. A malformed agent doc, stale reference, or invalid config can therefore ship immediately.

### What result it could bring

- fewer broken releases
- earlier detection of documentation and configuration drift
- more confidence when merging to `alpha`, `beta`, and `main`

### Why it matters strategically

The repository behaves partly like software and partly like policy. That kind of repo benefits a lot from cheap automated checks, because breakage is often structural rather than runtime.

## 5. Fix the current Dependabot configuration and make dependency maintenance predictable

### Why change it

`.github/dependabot.yml:6-7` uses:

```yaml
interval: "cron"
cronjob: "0 14 * * 1,2,3,4"
```

According to GitHub's Dependabot documentation, valid `schedule.interval` values are `daily`, `weekly`, or `monthly`. The current configuration is unlikely to behave as intended.

### What result it could bring

- predictable update cadence for GitHub Actions dependencies
- less silent configuration drift
- better security posture because pinned action SHAs and updater automation work well together

### Why it matters strategically

This is a small fix with asymmetric value: it removes uncertainty from one of the main maintenance loops in the repo.

## 6. Turn the intents framework into a real product asset by adding actual intent documents

### Why change it

The repository has already invested heavily in the intents system:

- dedicated intent agents in `agent/intents-locator.md` and `agent/intents-analyzer.md`
- a full intents skill in `skills/intents-schema/SKILL.md`
- research and operations notes in `thoughts/shared/research/2026-03-27-opencode-intents.md` and `thoughts/shared/operations/2026-03-30-intents-expectations-refresh.md`

However, the actual `intents/` directory currently contains only `intents/ui/` and no real `EXP-*.md` intent documents.

### What result it could bring

- clearer behavioral contracts for the most important repository workflows
- more useful outputs from the intent-related agents
- less ambiguity during planning and implementation

### Why it matters strategically

This is probably the highest-value medium-term improvement. The infrastructure exists; the missing step is using it. The prior research already suggests strong first candidates such as agent discovery, configuration validation, and permission management.

## 7. Clean up README and repository messaging to match reality

### Why change it

There are several documentation mismatches in `README.md`:

- it lists `AGENTS.md` in the structure even though the file is missing at `README.md:66`
- it refers to `.releaserc.jsonc` even though the repository contains `.releaserc.json` at `README.md:63`
- it mixes end-user setup with contributor branching steps at `README.md:40-46`
- it duplicates project-overview content between `README.md:3-5` and `README.md:48-52`

### What result it could bring

- clearer first-run experience for users
- lower contributor confusion
- less friction between docs and actual repository behavior

### Why it matters strategically

This repo is a setup product. Documentation quality is not secondary here; it is part of the product surface.

## 8. Reduce duplicated operational instructions across agent docs

### Why change it

The markdown lint workflow is repeated across several agents, for example in `agent/orchestrator.md:79-84`, `agent/planner.md:62-67`, `agent/quick.md:65-70`, and `agent/documentation-writer.md:67-83`.

This creates a maintenance hotspot. Every process change requires editing multiple agent files, and all of them also depend on an external lint config source.

### What result it could bring

- easier maintenance of shared operational rules
- lower risk of prompt drift between agents
- simpler future updates if the lint workflow changes

### Why it matters strategically

The more the repo grows through agent prompts, the more duplicated instructions become a real maintenance burden. Consolidation would improve long-term consistency.

## 9. Improve installer safety and ergonomics

### Why change it

The current setup script is generally careful, but it still performs a high-impact sync and shell-profile modification. Safer installation patterns commonly add at least `--help`, and often a `--dry-run`, explicit preview, or integrity-verification path.

This matters especially because the README promotes a `curl ... | bash` flow at `README.md:20-22`.

### What result it could bring

- better user trust before first install
- fewer surprises when `.bashrc` or `.zshrc` is modified
- easier debugging when setup fails

### Why it matters strategically

For a repo that installs and updates agent behavior, the installer is part of the brand. A safer, more transparent installer would improve perceived quality immediately.

## Suggested priority order

### Immediate

1. Create `AGENTS.md`
2. Fix setup channel behavior
3. Fix Dependabot configuration
4. Harden release workflow permissions and pin actions
5. Add a validation gate before release
6. Clean up README mismatches

### Next wave

7. Add the first real intent documents
8. Consolidate duplicated lint and process instructions
9. Improve installer ergonomics with `--help` and `--dry-run`

## Expected outcomes by area

| Area | Expected outcome |
| --- | --- |
| Documentation | Better onboarding, fewer broken references, stronger trust |
| Setup | Correct channel installs, clearer first-run behavior |
| Release engineering | Safer CI, fewer silent failures, better auditability |
| Repository governance | More usable intent system, clearer contracts for future changes |
| Maintenance | Less duplication, easier prompt updates, lower drift risk |

## Final assessment

I would not change this repository radically. The direction is already good: specialized agents, explicit permissions, release automation, internal research, and a documented intent framework are all strong foundations.

The sensible improvements are mostly about closing the gap between ambition and execution:

- make the documented artifacts actually exist
- make the advertised workflows actually behave as documented
- add lightweight validation and security hardening where the repo has the most leverage
- turn the intents framework from infrastructure into daily practice

If you want, the next useful step is that I turn this research into a concrete implementation plan ordered by impact and effort. For actual execution, though, you should switch to the orchestrator agent.
