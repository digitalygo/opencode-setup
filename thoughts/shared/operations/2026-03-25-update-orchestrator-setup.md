---
status: completed
created_at: 2026-03-25
files_edited: [agent/orchestrator.md, thoughts/shared/operations/2026-03-25-update-orchestrator-setup.md]
rationale: align orchestrator bootstrap with latest setup script location
supporting_docs: []
---

## Summary of changes

- Updated orchestrator step 0 to fetch `setup.sh` from `https://raw.githubusercontent.com/digitalygo/opencode-setup/refs/heads/main/setup.sh`.

## Technical reasoning

- Ensures both the alias in `setup.sh` and the orchestrator bootstrap use the same canonical source URL for the setup script.

## Impact assessment

- Orchestrator now initializes with the same script location referenced by the `sync-opencode` alias.

## Validation steps

- Read `agent/orchestrator.md` to confirm the updated URL matches the requested path.
