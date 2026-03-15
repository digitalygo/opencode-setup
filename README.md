# opencode-setup

welcome to the [OpenCode](https://opencode.ai/) setup repository for [digitalygo](https://digitalygo.it)!

this repository contains our full OpenCode setup, including configurations, agents, skills, commands, and our custom made Docker image for pentesting. you can expect automated releases via semantic-release.

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

with this script we also install the alias `sync-opencode` in your `.bashrc` or `.zshrc` to easily run future syncs without the need to remember the full command

### option 2: manual setup

1. clone the repository

   ```bash
   git clone https://github.com/digitalygo/opencode-setup.git
   ```

2. copy files to your OpenCode config folder

   ```bash
   rsync -av --delete --exclude=.git/ --exclude=.secrets/ --exclude=.github/ --exclude=thoughts/ --exclude=.gitignore --exclude=.markdownlint.json --exclude=.markdownlintignore --exclude=.releaserc.json "opencode-setup/" "~/.config/opencode/"
   ```

3. **create a feature / fix branch**

   please adhere to conventional commits and git flow standards

   ```bash
   git checkout -b feature/your-feature-name
   ```

## project overview

this repository contains our full OpenCode setup, including configurations, agents, skills, commands, and our custom made Docker image for pentesting

you can expect automated releases via semantic-release

## folder structure

understanding the repository structure is crucial for effective contributions. please kep files and edits as tidy as possible

- `.github/` - GitHub automation and configuration
- `agent/` - our collection of ai agents and subagents
- `command/` - custom command definitions
- `skills/` - our skills collection
- `.markdownlint*` - markdownlint configuration
- `.releaserc.jsonc` - semantic-release configuration
- `opencode.jsonc` - main OpenCode configuration
- `setup.sh` - our automatic installation script
- `AGENTS.md` - agent documentation

---

the [digitalygo](https://digitalygo.it) team
