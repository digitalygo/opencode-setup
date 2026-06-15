# opencode-setup

OpenCode configuration for [digitalygo](https://digitalygo.it): agents, commands, skills, MCP servers, managed via [chezmoi](https://chezmoi.io). automated releases via semantic-release.

## Quick start (new install)

On a machine with no prior OpenCode configuration, install [chezmoi](https://chezmoi.io/install/) then apply this repo:

```bash
chezmoi init --apply digitalygo/opencode-setup
```

This deploys the configuration to `~/.config/opencode/`. for later updates:

```bash
chezmoi update
```

### Branch / channel equivalents

chezmoi uses `--branch` instead of channel flags. use these to track pre-release branches:

```bash
chezmoi init --apply --branch beta digitalygo/opencode-setup   # beta channel
chezmoi init --apply --branch alpha digitalygo/opencode-setup  # alpha channel
```

Branch mapping:

| chezmoi flag | Channel | Branch |
|---|---|---|
| (default) | stable | `main` |
| `--branch beta` | beta | `beta` |
| `--branch alpha` | alpha | `alpha` |

### What this repo manages

This repository manages **only** the OpenCode configuration under `~/.config/opencode/`. it does **not** manage shell rc files, environment variables, or any other dotfiles.

The source tree uses the `exact_opencode` directory name, which tells chezmoi to keep the target directory in exact sync. unmanaged files in `~/.config/opencode/` are removed on apply.

## Migration from the legacy installer

If you previously used `setup.sh` to install OpenCode, or already have files in `~/.config/opencode/` from an earlier setup, complete this section **before** running any apply command. skipping these steps can delete local-only files.

### Why this matters

The `exact_opencode` source directory means chezmoi replaces the entire managed `~/.config/opencode/` tree on apply. any file in `~/.config/opencode/` that is not tracked by this repository will be deleted.

### Before you apply

1. **Back up your current configuration**:

   ```bash
   cp -a ~/.config/opencode ~/.config/opencode.backup
   ```

2. **Move local secrets and tokens out of the managed tree**:

   Move any secret files, API tokens, or local-only configuration from `~/.config/opencode/` to a directory outside the managed tree, such as `~/Documents/.secrets/`. these files are never synced by chezmoi and must stay outside `~/.config/opencode/` to survive applies.

3. **Preview the changes with chezmoi diff**:

   ```bash
   chezmoi init --dry-run digitalygo/opencode-setup
   chezmoi diff
   ```

   review the diff carefully. files listed as removed are unmanaged and will be deleted on apply. if anything unexpected appears, investigate before proceeding.

### Apply

Only after you have backed up your configuration, moved secrets out of `~/.config/opencode/`, and reviewed the diff:

```bash
chezmoi init --apply digitalygo/opencode-setup
```

After the apply succeeds, restore any local-only files you preserved outside the managed tree.

## Repo structure

This repo uses a [`.chezmoiroot`](.chezmoiroot) file to tell chezmoi that the source directory is `home/`. the runtime config lives under `home/dot_config/exact_opencode/`, which chezmoi maps to `~/.config/opencode/`.

### Source layout

```text
.
├── .chezmoiroot                    # chezmoi source root marker
├── .github/                        # GitHub Actions, CONTRIBUTING.md (repo-internal)
├── .gitignore                      # Git ignore rules (repo-internal)
├── .markdownlint.json              # Markdown lint config (repo-internal)
├── .markdownlintignore             # Markdown lint ignore (repo-internal)
├── .releaserc.json                 # semantic-release config (repo-internal)
├── LICENSE                         # MIT license (repo-internal)
├── README.md                       # this file (repo-internal)
├── substrate/                      # Mycelium framework traces (repo-internal)
└── home/
    └── dot_config/
        └── exact_opencode/         # maps to ~/.config/opencode/
            ├── agent/              # AI agent definitions
            ├── command/            # custom command definitions
            ├── skills/             # skill instruction packs
            ├── AGENTS.md           # agent-wide shared rules
            ├── opencode.jsonc      # main OpenCode configuration
            └── ...
```

### What gets synced

Everything under `home/dot_config/exact_opencode/` is deployed to `~/.config/opencode/`. the `exact_` prefix means chezmoi keeps the target directory in exact sync — files in `~/.config/opencode/` that are not in the repo get removed on apply. everything else in the repo is repo-internal and never reaches the target directory.

## Configuration overview

`opencode.jsonc` drives the entire setup:

- **default agent**: `orchestrator` — plans tasks, delegates to subagents, verifies results
- **models**: `openai/gpt-5.5` (primary), `opencode-go/deepseek-v4-flash` (small)
- **instructions**: loads `.github/CONTRIBUTING.md` and `AGENTS.md` as system-level rules
- **autoupdate**: enabled
- **compaction**: manual trigger, pruning enabled, preserves last 10k tokens
- **permissions**: bash asks by default except explicit read-only allows (git status, diff, log, show, rev-parse) and destructive-command denies
- **MCP servers**: figma, shadcn, chrome-devtools — all enabled by default

## Agents

### Primary entrypoints

Agents configured with `mode: primary` can be invoked directly, not only as subagents:

| Agent | Role |
|---|---|
| `orchestrator` | Default entrypoint — plans, delegates, verifies, enforces security gates |
| `planner` | Researches codebase and writes implementation plans without executing |
| `quick` | Answers quick questions and research/documentation without implementation changes |
| `commit` | Stages existing changes and crafts conventional commits |
| `security` | Discovers, validates, and documents vulnerabilities with subagents |
| `directives-writer` | Generates and refines developer directives (DRC-*.md) |
| `expectations-writer` | Generates and refines client expectations (EXP-*.md) |

### Subagent roster

The orchestrator delegates to these categories of specialized subagents:

**Research**: directives-locator, directives-analyzer, expectations-locator, expectations-analyzer, traces-locator, traces-analyzer, codebase-locator, codebase-analyzer, codebase-pattern-finder, media-analyzer, web-researcher, complex-problem-researcher

**Development**: javascript-typescript-dev, go-dev, python-dev, php-laravel-dev, ruby-dev, static-site-dev, web-app-dev, frontend-html-css-specialist

**Infrastructure**: docker-specialist, ansible-specialist, opentofu-terraform-specialist, github-actions-workflow-specialist

**Security**: security-review-specialist (code review), security-specialist (toolbox-based pentesting)

**Other**: api-designer, documentation-writer, openscad-specialist

**Fallback**: general (use only when no other subagent fits)

## Commands

Commands invoke specific agents for common workflows:

| Command | Agent | Purpose |
|---|---|---|
| `commit` | commit | Commit changes following conventional commit format |
| `review` | planner | Review repository changes for CONTRIBUTING compliance, output review trace |
| `migrate-to-mycelium` | orchestrator | Migrate from legacy `thoughts/`/`intents/` to Mycelium substrate layout |

## Skills

Skills provide specialized instruction packs for agents. loaded on demand via the skill tool:

| Skill | Purpose |
|---|---|
| `caveman` | Compressed communication format, mandatory for all agent-user interactions |
| `godot-game-dev` | End-to-end Godot game development workflow |
| `modern-css-snippets` | Modern CSS capabilities and legacy replacements |
| `mycelium-operation` | Operations record authoring rules |
| `mycelium-directive` | Developer directive (DRC-*.md) authoring rules |
| `mycelium-expectation` | Client expectation (EXP-*.md) authoring rules |
| `mycelium-plan` | Plan record authoring rules |
| `mycelium-research` | Research record authoring rules |
| `mycelium-review` | Review record authoring rules |
| `mycelium-status` | Workspace state record authoring rules |
| `replicate-png-generation` | PNG image generation via Replicate |
| `replicate-svg-generation` | SVG image generation via Replicate |
| `web-design-references` | Curated web design system snapshots |

## MCP integrations

Three MCP servers run locally, all enabled by default:

- **figma**: `figma-developer-mcp` — reads Figma designs via a local token file
- **shadcn**: `shadcn@latest mcp` — generates and manages shadcn/ui components
- **chrome-devtools**: `chrome-devtools-mcp@latest` — headless browser automation for testing and scraping (remove `--headless=true` for GUI)

## Secret files

API tokens and secret files are never managed by chezmoi. store them in a directory outside the managed `~/.config/opencode/` tree (e.g. `~/Documents/.secrets/`). create each file locally with the correct value.

The Figma MCP server and the Replicate and Mistral skills read credentials from local files. configure these paths in your environment as needed.

## Mycelium framework

This repository follows the Mycelium substrate standard for agent-written documentation.

### Current state

The entire `substrate/` tree is repo-internal — it is not deployed by chezmoi and lives only in this repository.

- **`substrate/traces/`** — actively populated with operations, plans, research, reviews, and status records.
- **`substrate/directives/`** — not yet authored in this repository. supported by the `mycelium-directive` skill and the `migrate-to-mycelium` command.
- **`substrate/expectations/`** — not yet authored. supported by the `mycelium-expectation` skill and the migration command.

### Substrate traces layout

```text
substrate/traces/
├── operations/    # completed agent work records (YYYY-MM-DD-description.md)
├── plans/         # implementation plans before execution
├── research/      # research findings and analysis
├── reviews/       # compliance and security review reports
└── status/        # workspace state snapshots (gitignored)
```

### Migration support

Repositories using the legacy `thoughts/` and `intents/` layout can migrate via:

```bash
opencode migrate-to-mycelium
```

The command detects layout state, moves files to the substrate standard, updates `.gitignore` and `.markdownlintignore`, and refuses on ambiguous states.

## Release model

Fully automated via semantic-release on pushes to release branches:

```text
main (production) ← beta ← alpha ← feature / fix branches
```

| Branch | Release type | Version bump |
|---|---|---|
| `main` | Production | Based on commit type |
| `beta` | Pre-release (beta channel) | Based on commit type |
| `alpha` | Pre-release (alpha channel) | Based on commit type |

Commit types that trigger releases:

- `feat` → minor bump
- `fix`, `chore` → patch bump
- `BREAKING CHANGE:` footer → major bump

Other commit types (`docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`) do not trigger releases.

## Contributing

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for full guidelines. key points:

- **Branching**: always target `alpha`. work in `feature/*` or `fix/*` branches
- **Commits**: conventional commit format required. `feat`, `fix`, `chore` drive releases
- **Style**: no comments policy, kebab-case filenames, `set -euo pipefail` in bash scripts
- **Agent naming**: follow patterns (`*-dev.md`, `*-specialist.md`, `*-locator.md`, etc.)
- **Prompt writing**: second person, active voice ("you must" not "agents must")
- **PRs**: small, focused, tested, no lint errors

### Local dev setup

```bash
git clone https://github.com/YOUR_USERNAME/opencode-setup.git
cd opencode-setup
git remote add upstream https://github.com/digitalygo/opencode-setup.git
git checkout -b feature/your-feature-name
```

To test your changes locally with chezmoi:

```bash
chezmoi init --source ~/path/to/your/clone
chezmoi diff          # preview changes
chezmoi apply         # apply to ~/.config/opencode/
```

## License

MIT — see [LICENSE](LICENSE). copyright DigItalyGo S.R.L. SB.

---

the [digitalygo](https://digitalygo.it) team
