---
status: completed
created_at: 2026-03-15
files_edited: ["setup.sh"]
rationale: updated sync script to use new repo location and root layout
supporting_docs: ["README.md", ".github/CONTRIBUTING.md"]
---

# setup sync update

## summary of changes

updated `setup.sh` to reflect the new repository structure and location. key modifications include:

- clone URL changed to `digitalygo/opencode-setup.git`
- `SOURCE_DIR` now points to the clone root instead of a subdirectory
- rsync excludes `.git` and `.secrets` directories
- alias command uses raw GitHub URL for `digitalygo/opencode-setup/main/setup.sh`
- all existing behaviors preserved for backward compatibility

## technical reasoning

the repository was reorganized to use a root-level layout rather than nested subdirectories. the sync script needed alignment to ensure:

1. correct source path resolution after layout change
2. proper exclusion of sensitive directories during sync
3. updated remote references for the new organization location

## impact assessment

- **users**: no breaking changes; existing workflows continue functioning
- **sync behavior**: identical end result, improved path handling
- **security**: `.secrets` exclusion prevents accidental credential exposure

## validation steps

1. run `setup.sh` on a fresh environment
2. verify clone succeeds from `digitalygo/opencode-setup.git`
3. confirm rsync excludes `.git` and `.secrets`
4. test alias functionality with raw URL
5. ensure existing configurations remain intact post-sync
