# opencode-setup

welcome to the [OpenCode](https://opencode.ai/) setup repository for [digitalygo](https://digitalygo.it)!

this repository contains our full OpenCode setup, including configurations, agents, skills, and commands. you can expect automated releases via semantic-release.

for full contribution guidelines, see [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## quick start

prerequisites:

- git
- bash shell
- Docker
- rsync

### option 1: use the setup script

```bash
curl -fsSL https://raw.githubusercontent.com/digitalygo/opencode-setup/main/setup.sh | bash
```

with this script we also install the alias `sync-opencode` in your `.bashrc` or `.zshrc` to easily run future syncs without the need to remember the full command.

to preview changes without applying, run: `setup.sh --dry-run`

### option 2: manual setup

1. clone the repository

   ```bash
   git clone https://github.com/digitalygo/opencode-setup.git
   ```

2. copy files to your OpenCode config folder

   ```bash
   rsync -av --delete --exclude=.git/ --exclude=.secrets/ --exclude=.github/ --exclude=substrate/traces/ --exclude=.gitignore --exclude=.markdownlint.json --exclude=.markdownlintignore --exclude=.releaserc.json "opencode-setup/" "~/.config/opencode/"
   ```

## what gets synced

the setup script and manual rsync copy runtime configuration to `~/.config/opencode/` while preserving repository-internal files:

**synced to `~/.config/opencode/`:**

- `agent/` - ai agents and subagents
- `command/` - custom command definitions
- `opencode.jsonc` - main OpenCode configuration
- `plugins/` - plugin definitions
- `setup.sh` - installation script
- `skills/` - skill definitions
- `substrate/directives/` - Mycelium human-authored behavioral directives

**stays repository-internal (excluded from sync):**

- `.github/` - GitHub automation
- `.gitignore` - git ignore rules
- `.markdownlint.json` and `.markdownlintignore` - linting configuration
- `.releaserc.json` - semantic-release configuration
- `.secrets/` - local secrets (preserved if exists)
- `substrate/traces/` - Mycelium agent-written documentation

repositories using the legacy layout have `thoughts/` and `intents/` at root level. see migration section below to move to the Mycelium standard.

## Mycelium framework migration

this repository uses the Mycelium framework with substrate-based organization:

- `substrate/traces/` - agent-written documentation (operations, plans, research, reviews, status)
- `substrate/directives/` - human-authored behavioral directives (previously `intents/`)

### legacy layout

repositories using the old layout have:

- `thoughts/` instead of `substrate/traces/`
- `intents/` instead of `substrate/directives/`

### migration

to migrate a repository from the legacy layout to Mycelium:

```bash
# run the official migration command
opencode migrate-to-mycelium
```

this command:

1. detects the current layout (legacy, new, or mixed)
2. moves files from `thoughts/` to `substrate/traces/` (removing the `shared/` layer)
3. moves files from `intents/` to `substrate/directives/`
4. preserves all content and nested structure
5. refuses to proceed on ambiguous or mixed layouts

see the `mycelium-migration` skill for detailed detection logic and fallback guidance.

## folder structure

understanding the repository structure is crucial for effective contributions. please keep files and edits as tidy as possible

- `.github/` - GitHub automation and configuration
- `agent/` - ai agents and subagents
- `command/` - custom command definitions
- `plugins/` - plugin definitions
- `skills/` - skill definitions
- `substrate/` - Mycelium framework storage
  - `traces/` - agent-written documentation (operations, plans, research, reviews, status)
  - `directives/` - human-authored behavioral directives
- `.markdownlint.json` and `.markdownlintignore` - markdownlint configuration
- `.releaserc.json` - semantic-release configuration
- `opencode.jsonc` - main OpenCode configuration
- `setup.sh` - automatic installation script

legacy repositories may also contain:

- `thoughts/` - legacy agent-written docs (migrate to `substrate/traces/`)
- `intents/` - legacy directives (migrate to `substrate/directives/`)

---

the [digitalygo](https://digitalygo.it) team
