# Digitalygo OpenCode setup

Public, OpenCode-only configuration for [Digitalygo](https://digitalygo.it), distributed with [chezmoi](https://www.chezmoi.io/). It provides shared agents, commands, skills, plugins, models, permissions, MCP integrations, and TUI settings under `~/.config/opencode/`.

This repository does not manage shell files, environment variables, OpenCode provider authentication, or unrelated dotfiles. Internal users who need the complete development and operations environment should use the private `digitalygo/dotfiles` repository.

## Requirements

- [OpenCode](https://opencode.ai/)
- [chezmoi](https://www.chezmoi.io/install/)
- Git
- Node.js 24.18.0 or newer for plugin development and tests

Provider authentication and optional API credentials remain machine-local and must be configured separately.

## Installation

### New OpenCode configuration

On a machine without an existing `~/.config/opencode/` tree:

```bash
chezmoi init --apply digitalygo/opencode-setup
```

### Existing OpenCode configuration

The source directory is named `exact_opencode`, so chezmoi manages the target directory exactly. Nested `exact_agent`, `exact_command`, `exact_plugins`, and `exact_skills` directories also propagate deletions. Unmanaged files in those target paths can be removed during an apply.

Back up and preview before the first apply:

```bash
cp -a ~/.config/opencode ~/.config/opencode.backup
chezmoi init digitalygo/opencode-setup
chezmoi diff
chezmoi apply
```

Keep secrets, provider authentication, and local-only configuration outside `~/.config/opencode/`. Do not restore local-only files into the exact-managed paths after applying.

## Updates

Pull the current source and apply it with:

```bash
chezmoi update
```

Preview repository changes before applying when needed:

```bash
chezmoi git pull -- --ff-only
chezmoi diff
chezmoi apply
```

## Source-to-runtime mapping

The root `.chezmoiroot` file selects `home/` as the source directory. Repository files outside `home/` are not deployed.

| Source | Runtime target | Purpose |
| --- | --- | --- |
| `home/dot_config/exact_opencode/` | `~/.config/opencode/` | Exact-managed OpenCode root |
| `exact_agent/` | `agent/` | Primary agents and subagents |
| `exact_command/` | `command/` | Reusable commands |
| `exact_plugins/` | `plugins/` | TypeScript plugins and plugin modules |
| `exact_skills/` | `skills/` | On-demand instruction packs and references |
| `AGENTS.md` | `AGENTS.md` | Shared agent rules |
| `opencode.jsonc` | `opencode.jsonc` | Models, MCP servers, permissions, and runtime behavior |
| `tui.jsonc` | `tui.jsonc` | TUI theme and attention sounds |
| `sounds/` | `sounds/` | Completion, permission, and error sounds |

The repository-level `.github/`, `substrate/`, release files, and documentation remain repository-internal.

## Current configuration

`opencode.jsonc` defines the active defaults:

| Setting | Value |
| --- | --- |
| Default agent | `orchestrator` |
| Primary model | `openrouter/moonshotai/kimi-k3` |
| Small model | `openrouter/qwen/qwen3.7-flash` |
| Automatic updates | Enabled |
| Automatic compaction | Enabled, with pruning and 50,000 recent tokens preserved |
| Tool output limit | 4,000 lines |
| MCP servers | Figma, shadcn/ui, and Chrome DevTools |
| Provider and secret state | Local only, not managed by chezmoi |

The watcher ignores common dependency, build, Git, vendor, and virtual-environment directories. The TUI enables mouse input and attention sounds for completion, permission requests, and errors.

### Permissions

The default Bash policy allows ordinary commands while explicitly denying destructive disk, privilege-escalation, persistence, credential-reading, selected network-transfer and reconnaissance, container-escape, and shutdown patterns.

Additional boundaries include:

- `.env` and `.env.*` reads are denied, while example environment files remain readable.
- External access asks by default, with the OpenCode skills tree and `~/Documents/**` allowed.
- Doom-loop continuation is denied.
- `git commit` and `git push` require approval.

Agent definitions can narrow these defaults further.

## Agents

### Primary entrypoints

| Agent | Purpose |
| --- | --- |
| `orchestrator` | Coordinates planning, specialist implementation, verification, and the final quality gate |
| `planner` | Researches a codebase and writes plans without implementing changes |
| `quick` | Handles quick questions, lookups, and lightweight research |
| `commit` | Stages existing changes and creates conventional commits without editing files |
| `security` | Coordinates authorized vulnerability discovery, validation, and documentation |
| `directives-writer` | Authors and maintains Mycelium developer directives |
| `expectations-writer` | Authors and maintains Mycelium client expectations |
| `wiki` | Compiles source material into a durable Markdown knowledge base |

The repository also overrides OpenCode's built-in `build` and `plan` definitions.

### Specialist groups

- **Codebase and repository research:** codebase, directive, expectation, and trace locators and analyzers; pattern finding; media analysis; web research
- **Development:** JavaScript and TypeScript, Python, PHP and Laravel, Ruby and Rails, Go, web applications, static sites, frontend HTML and CSS, and Godot
- **Infrastructure:** Docker, Ansible, OpenTofu and Terraform, and GitHub Actions
- **Design and documentation:** API design, documentation, OpenSCAD, and a general fallback
- **Security and quality:** security review, authorized penetration testing, and an independent read-only quality gate

Read `home/dot_config/exact_opencode/exact_agent/` for the current agent frontmatter, model selection, permissions, and full prompts.

## Commands

The current command catalog contains one command:

| Command | Agent | Purpose |
| --- | --- | --- |
| `commit` | `commit` | Review the current changes, stage the intended files, and create conventional commits |

## Skills

| Skill | Purpose |
| --- | --- |
| `caveman` | Ultra-compressed technical communication |
| `dependency-catalog` | Shared dependency versions and upgrade guidance |
| `godot-game-dev` | End-to-end Godot planning, implementation, testing, capture, profiling, and visual QA |
| `mistral-ocr-pdf-to-md` | OCR for documents and images into Markdown |
| `modern-css-snippets` | Current CSS capabilities and replacements for legacy patterns |
| `mycelium-directive` | Developer directive authoring |
| `mycelium-expectation` | Client expectation authoring |
| `mycelium-operation` | Operation record authoring |
| `mycelium-plan` | Implementation plan authoring |
| `mycelium-research` | Research record authoring |
| `mycelium-review` | Security and repository review authoring |
| `mycelium-status` | Workspace state record authoring |
| `replicate-image-generation` | Raster image generation and editing through Replicate |
| `replicate-svg-generation` | SVG generation through Replicate |
| `team-leader` | User-facing language, precision, and verification rules for leader agents |
| `web-design-references` | Curated design-system snapshots for web work |

## Plugins

The `usage-logger` plugin is implemented in TypeScript. It detects supported projects, validates owner-only local configuration, and records usage through a durable pending and outbox flow. If project or secure configuration requirements are not met, it returns a no-op event handler instead of sending data.

Its optional local files are:

- `~/Documents/.secrets/usage-log-api-base`
- `~/Documents/.secrets/usage-log-api-key`

The secrets directory must not be group- or world-writable. Secret files must be regular, non-symlink files owned by the current user with owner-only permissions such as `0400` or `0600`.

## Optional skill credentials

Credentials are never committed or deployed by chezmoi. The current skills and MCP configuration can use these local files:

- `~/Documents/.secrets/figma-token`
- `~/Documents/.secrets/mistral-key`
- `~/Documents/.secrets/replicate-key`

Only create the files for integrations you intend to use.

## Mycelium repository records

`substrate/` is repository-internal and is not deployed. The current repository stores plans, research, reviews, and operation traces under `substrate/traces/`. Mycelium skills support directives and expectations when those collections are added to a project.

## Development and validation

Install the pinned plugin dependencies and run the complete TypeScript checks from the package directory:

```bash
cd home/dot_config/exact_opencode
npm ci
npm run typecheck
npm test
npm run build
```

Synchronize the shared Markdown lint configuration, then lint all Markdown from the repository root:

```bash
curl -fsSL \
  https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlint.json \
  -o ./.markdownlint.json
curl -fsSL \
  https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlintignore \
  -o ./.markdownlintignore
npx markdownlint-cli "**/*.md" \
  --config .markdownlint.json \
  --ignore-path .markdownlintignore \
  --dot --fix
```

Preview the target changes before applying a working clone:

```bash
chezmoi init --source /path/to/opencode-setup
chezmoi diff
```

## Release model

Semantic Release runs on pushes to configured release branches. `main` is the stable default branch. The release configuration also recognizes `beta` and `alpha` as prerelease channels when those branches are used.

- `feat` produces a minor release.
- `fix` and `chore` produce a patch release.
- A `BREAKING CHANGE:` footer produces a major release.

Other conventional commit types do not produce a release by default.

## Contributing

Read [the contribution guide](.github/CONTRIBUTING.md) and root `AGENTS.md` before changing the repository. Keep pull requests focused, use conventional commits, preserve the exact-managed layout, and include real validation evidence.

## License

MIT. See [the license](LICENSE). Copyright DigItalyGo S.R.L. SB.
