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
   rsync -av --delete --exclude=.git/ --exclude=.secrets/ --exclude=.github/ --exclude=thoughts/ --exclude=.gitignore --exclude=.markdownlint.json --exclude=.markdownlintignore --exclude=.releaserc.json "opencode-setup/" "~/.config/opencode/"
   ```

## what gets synced

the setup script and manual rsync copy runtime configuration to `~/.config/opencode/` while preserving repository-internal files:

**synced to `~/.config/opencode/`:**

- `agent/` - ai agents and subagents
- `command/` - custom command definitions
- `intents/` - intent definitions
- `opencode.jsonc` - main OpenCode configuration
- `plugins/` - plugin definitions
- `setup.sh` - installation script
- `skills/` - skill definitions

**stays repository-internal (excluded from sync):**

- `.github/` - GitHub automation
- `.gitignore` - git ignore rules
- `.markdownlint.json` and `.markdownlintignore` - linting configuration
- `.releaserc.json` - semantic-release configuration
- `.secrets/` - local secrets (preserved if exists)
- `thoughts/` - working notes and thoughts

## folder structure

understanding the repository structure is crucial for effective contributions. please keep files and edits as tidy as possible

- `.github/` - GitHub automation and configuration
- `agent/` - ai agents and subagents
- `command/` - custom command definitions
- `intents/` - intent definitions
- `plugins/` - plugin definitions
- `skills/` - skill definitions
- `thoughts/` - working notes and thoughts
- `.markdownlint.json` and `.markdownlintignore` - markdownlint configuration
- `.releaserc.json` - semantic-release configuration
- `opencode.jsonc` - main OpenCode configuration
- `setup.sh` - automatic installation script

---

the [digitalygo](https://digitalygo.it) team
