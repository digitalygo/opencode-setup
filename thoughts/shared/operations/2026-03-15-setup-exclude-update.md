---
status: completed
created_at: 2026-03-15
files_edited: ["setup.sh"]
rationale: extend rsync excludes to avoid copying repo-only files into user config
supporting_docs: ["setup.sh"]
---

# rsync exclude update in setup.sh

## summary of changes

extended the rsync exclude list in `setup.sh` to prevent repository-specific files from being copied into user configuration directories during setup. the rsync command on line 160 now excludes additional patterns while preserving existing exclusions.

**added excludes:**

- `.github/` - GitHub automation and workflow configurations
- `thoughts/` - internal documentation and operation records
- `.gitignore` - repository ignore patterns
- `.markdownlint.json` - markdown linting configuration
- `.markdownlintignore` - markdown linting ignore patterns
- `.releaserc.json` - semantic-release configuration

**preserved excludes:**

- `.git` - Git version control directory
- `.secrets` - user secrets directory (intentionally preserved across syncs)

## technical reasoning

the setup script clones the repository to a temporary directory and syncs files to `~/.config/opencode/`. previously, repository-specific files like `.github/` workflows and `thoughts/` documentation were being copied into user configurations unnecessarily.

by extending the exclude list, we ensure:

1. **cleaner user configs** - users receive only operational files (agents, commands, skills, configs)
2. **reduced clutter** - repository metadata and development tooling stay in the repo
3. **privacy preservation** - internal documentation and workflows remain repository-only
4. **maintained functionality** - existing `.git` and `.secrets` exclusions remain intact

## impact assessment

**scope:** affects all new installations and updates via `setup.sh`

**risk level:** low - exclusions only prevent file copying, no destructive changes

**user impact:**

- new setups will have cleaner `~/.config/opencode/` directories
- existing users will see these files removed on next sync (if present)
- no functional changes to OpenCode operation

**backward compatibility:** maintained - all previously excluded patterns remain excluded

## validation steps

1. **verify exclusions in source:**
   - open `setup.sh` line 160
   - confirm all six new patterns present in rsync command
   - confirm `.git` and `.secrets` still excluded

2. **test dry-run (optional):**
   ```bash
   rsync -av --dry-run --exclude=.git --exclude=.secrets \
     --exclude=.github/ --exclude=thoughts/ --exclude=.gitignore \
     --exclude=.markdownlint.json --exclude=.markdownlintignore \
     --exclude=.releaserc.json /tmp/test-source/ /tmp/test-dest/
   ```

3. **verify no regression:**
   - ensure `.secrets` preservation logic still functions
   - confirm agents, commands, skills directories sync correctly
