---
status: completed
created_at: 2026-04-16
files_edited:
  - agent/security-specialist.md
rationale:
  - close prompt gaps exposed by live validation so security-specialist behaves more predictably in Docker-first assessments
  - strengthen authorization handling and practical execution guidance without materially expanding scope
supporting_docs:
  - agent/security-specialist.md
  - substrate/traces/operations/2026-04-16-security-agent-prompt-test.md
  - tmp/docs/included-tools.md
  - tmp/docs/tool-handbook.md
---

# Summary of changes

- Updated `agent/security-specialist.md` to prefer read-only mounts whenever possible and to default `AUTO_TOR=0` unless tor routing is explicitly needed.
- Added a decision rule for socket-based versus tar-based image scanning.
- Added explicit guidance for Git `safe.directory` issues on bind-mounted repositories.
- Added a dedicated missing-authorization protocol with hard refusal language for destructive, exploit, or brute-force requests without written approval.
- Added a light image-triage hint for noisy vulnerability output.

# Technical reasoning

The previous live tests showed that the prompt already routed the agent well, but several practical choices were still implicit. Those implicit choices can lead to inconsistent behavior between runs, especially around Docker runtime defaults and refusal style.

The update focused on closing only the gaps proven by testing:

- runtime ergonomics (`AUTO_TOR=0`, read-only mounts);
- operational edge cases (`safe.directory`, socket versus tar image scans);
- safety behavior when authorization is missing.

This keeps the prompt strongly opinionated without turning it into a long operational manual.

# Impact assessment

- The agent should now start faster and more predictably for most non-proxy scans because tor is no longer an implicit runtime default in practice.
- Repository scans should be safer by default through clearer read-only mount guidance.
- Refusal behavior for unsafe requests should now be more consistent and less open to user pressure.
- Image scan workflows should be more consistent across local, offline, and air-gapped cases.

# Validation steps

- Read the updated `agent/security-specialist.md` after subagent edits.
- Reviewed `git diff -- agent/security-specialist.md` to verify only intended prompt sections changed.
- Synced Markdown lint config and ran:
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
  - `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot`
