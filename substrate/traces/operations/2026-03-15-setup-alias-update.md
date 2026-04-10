---
status: completed
created_at: 2026-03-15
files_edited: ["setup.sh"]
rationale: ensure sync-opencode alias is updated to new URL if an old alias exists
supporting_docs: ["setup.sh"]
---

# setup.sh alias update operation

## summary of changes

modified the alias management logic in `setup.sh` to handle three distinct scenarios when configuring the `sync-opencode` alias in the user's shell configuration file:

1. **exact alias retained**: if the current alias definition matches the new raw GitHub URL exactly, the script reports the alias already exists and makes no changes
2. **outdated alias replaced**: if an existing `sync-opencode` alias uses a different URL (old repository path or different format), the script removes the outdated definition and inserts the corrected raw GitHub URL
3. **new alias added**: when no `sync-opencode` alias exists in the shell configuration, the script appends the new alias definition

## technical reasoning

the alias update mechanism uses `sed` with a temporary file pattern to ensure atomic replacement of outdated aliases. this approach:

- prevents duplicate alias definitions that could cause shell parsing issues
- preserves all other shell configuration content unrelated to the `sync-opencode` alias
- maintains idempotency by detecting exact matches before applying changes
- uses `mktemp` for safe temporary file creation during the replacement process

the alias definition points to the raw GitHub content URL for the main branch of the `digitalygo/opencode-setup` repository, enabling users to execute the sync command via `curl` piped to `bash`.

## impact assessment

**scope**: affects new installations and existing users running the setup script

**behavior changes**:

- existing users with outdated aliases will have their shell configuration automatically updated
- no disruption to users with current alias definitions
- new users receive the correct alias on first run

**risk level**: low

- the replacement logic specifically targets only lines matching `^alias sync-opencode=`
- other shell configuration entries remain untouched
- temporary file operations use standard error handling patterns

## validation steps

1. run `setup.sh` on a system without the alias and verify the alias is appended to `.bashrc` (Linux) or `.zshrc` (macOS)
2. run `setup.sh` again on the same system and confirm the "already exists" message appears
3. manually insert an outdated alias definition and rerun `setup.sh` to verify replacement occurs
4. check that other shell configuration content remains intact after alias operations
5. verify the alias command executes correctly: `alias sync-opencode='curl -fsSL https://raw.githubusercontent.com/digitalygo/opencode-setup/main/setup.sh | bash'`
