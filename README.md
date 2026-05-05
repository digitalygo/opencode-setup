# opencode-setup

OpenCode configuration for [digitalygo](https://digitalygo.it): agents, commands, skills, MCP servers, and a one-command installer. automated releases via semantic-release.

## Quick start

### Option 1: one-liner

```bash
curl -fsSL https://raw.githubusercontent.com/digitalygo/opencode-setup/main/setup.sh | bash
```

Installs config to `~/.config/opencode`, adds `sync-opencode` alias to your shell rc file, and exports `OPENCODE_ENABLE_EXA=true`.

### Option 2: manual clone + rsync

```bash
git clone https://github.com/digitalygo/opencode-setup.git
rsync -av --delete \
  --exclude=.git/ --exclude=.secrets/ --exclude=.github/ --exclude=substrate/ \
  --exclude=.gitignore --exclude=.markdownlint.json --exclude=.markdownlintignore \
  --exclude=.releaserc.json \
  opencode-setup/ ~/.config/opencode/
```

### Installer options

```bash
./setup.sh --channel beta    # install from beta (default: stable → main)
./setup.sh --dry-run          # preview without writing
./setup.sh --help             # show usage
```

Channel values: `stable` (synonym for `main`), `beta`, `alpha`, or any branch name.

### Prerequisites

**Install** — needed by `setup.sh`:

- `curl`, `git`, `rsync`, `mktemp` (standard on Linux/macOS)
- a shell rc file (`.bashrc` or `.zshrc`) for the alias and export

**Contributing** — additional tools for development and security workflows (see [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)):

- Docker

## What gets synced

`setup.sh` copies the repository to `~/.config/opencode/` while excluding repo-internal paths. everything else — directories and top-level files — is synced.

Core runtime paths synced to `~/.config/opencode/`:

| Directory/file | Purpose |
|---|---|
| `agent/` | AI agent definitions |
| `command/` | Custom command definitions |
| `skills/` | Skill instruction packs |
| `AGENTS.md` | Agent-wide shared rules |
| `README.md` | This documentation |
| `LICENSE` | MIT license |
| `opencode.jsonc` | Main OpenCode configuration |
| `setup.sh` | Installer script |

Paths kept repo-internal (never synced to `~/.config/opencode/`):

| Directory/file | Purpose |
|---|---|
| `.github/` | GitHub Actions, CONTRIBUTING.md |
| `substrate/` | Mycelium framework traces |
| `.gitignore` | Git ignore rules |
| `.markdownlint.json`, `.markdownlintignore` | Lint configuration |
| `.releaserc.json` | Semantic-release configuration |
| `.secrets/` | Local secrets (preserved if exists) |

The installer preserves any existing `~/.config/opencode/.secrets/` directory across syncs.

## Configuration overview

`opencode.jsonc` drives the entire setup:

- **default agent**: `orchestrator` — plans tasks, delegates to subagents, verifies results
- **models**: `openai/gpt-5.5` (primary), `opencode-go/deepseek-v4-flash` (small)
- **instructions**: loads `.github/CONTRIBUTING.md` and `AGENTS.md` as system-level rules
- **autoupdate**: enabled
- **compaction**: manual trigger, pruning enabled, preserves last 10k tokens
- **permissions**: bash broadly allowed except destructive system commands; git asks except read-only commands (status, diff, log, show, rev-parse)
- **MCP servers**: figma, shadcn, chrome-devtools — all enabled by default (see below)

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

**Research**: directives-locator, directives-analyzer, expectations-locator, expectations-analyzer, traces-locator, traces-analyzer, codebase-locator, codebase-analyzer, codebase-pattern-finder, web-researcher, complex-problem-researcher

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
| `caveman-review` | Compressed code review comments |
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

- **figma**: `figma-developer-mcp` — reads Figma designs via a local token file (`~/.config/opencode/.secrets/figma-token`)
- **shadcn**: `shadcn@latest mcp` — generates and manages shadcn/ui components
- **chrome-devtools**: `chrome-devtools-mcp@latest` — headless browser automation for testing and scraping (remove `--headless=true` for GUI)

## Mycelium framework

This repository follows the Mycelium substrate standard for agent-written documentation:

### Current state

The entire `substrate/` tree is repo-internal — it is excluded from `setup.sh` syncs and lives only in this repository.

- **`substrate/traces/`** — exists and is actively populated with operations, plans, research, reviews, and status records.
- **`substrate/directives/`** — not yet authored in this repository. supported by the `mycelium-directive` skill and the `migrate-to-mycelium` command. agents reference this path as required (see `AGENTS.md`, `orchestrator.md`).
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

## License

MIT — see [LICENSE](LICENSE). copyright DigItalyGo S.R.L. SB.

---

the [digitalygo](https://digitalygo.it) team
