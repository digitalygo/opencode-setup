---
status: completed
created_at: 2026-06-15
files_edited:
  - .chezmoiroot
  - README.md
  - .github/CONTRIBUTING.md
  - .github/renovate.json
  - home/dot_config/exact_opencode/AGENTS.md
  - home/dot_config/exact_opencode/agent/
  - home/dot_config/exact_opencode/command/
  - home/dot_config/exact_opencode/skills/
  - home/dot_config/exact_opencode/sounds/
  - home/dot_config/exact_opencode/opencode.jsonc
  - home/dot_config/exact_opencode/tui.jsonc
  - agent/
  - command/
  - skills/
  - sounds/
  - opencode.jsonc
  - tui.jsonc
  - setup.sh
rationale:
  - replace the remote curl or rsync installer model with a chezmoi source layout for the public OpenCode setup
  - align the shipped runtime files with the current dotfiles-derived OpenCode configuration while excluding private-only material
  - harden prompt bootstrap, permission defaults, and OCR error handling before treating the migration as ready
supporting_docs:
  - .github/CONTRIBUTING.md
  - README.md
  - substrate/traces/reviews/2026-04-19-orchestrator-remote-script-exec-risk.md
  - substrate/traces/reviews/2026-06-14-mistral-ocr-base64-artifact-leak.md
  - substrate/traces/reviews/2026-06-15-chezmoi-secret-permission-regression.md
---

# Public OpenCode chezmoi migration

## Summary of changes

Reorganized the repository from a flat runtime tree plus `setup.sh` into a chezmoi source repository rooted at `home/`, with the shipped OpenCode runtime now living under `home/dot_config/exact_opencode/`. The migration removed the old top-level runtime copies, rewrote install and contributor documentation around chezmoi, aligned runtime content with the current dotfiles-derived OpenCode setup, and applied security follow-up fixes before completion.

Key changes:

- added `.chezmoiroot` with `home` and moved the public runtime into `home/dot_config/exact_opencode/`
- removed the legacy top-level `agent/`, `command/`, `skills/`, `sounds/`, `opencode.jsonc`, `tui.jsonc`, and `setup.sh` layout
- updated runtime prompts and config to use the public repo as chezmoi source rather than a remote shell bootstrap
- updated README and CONTRIBUTING to separate fresh installs from legacy migration, explain exact-sync behavior, and document the chezmoi workflow
- updated Renovate and runtime skill reference URLs to the new repository paths
- hardened runtime permissions and the OCR skill after security review feedback

## Technical reasoning

The previous public distribution model depended on cloning the repository into a temporary directory and copying files into `~/.config/opencode/` with an installer script. That model had three problems in the current repository state:

1. it diverged from the maintained local dotfiles structure that already uses chezmoi for the OpenCode subtree
2. it kept security-sensitive update behavior in prompts and docs centered around automatic apply flows
3. it duplicated runtime material at the repository root even though the desired public layout is a chezmoi source tree

The migration therefore treated the private dotfiles-driven OpenCode subtree as the runtime baseline, but adapted it for a public-only repository:

- the repository now ships only OpenCode-related files under the chezmoi source tree
- private-only runtime material was excluded from the public migration
- the orchestrator prompt no longer auto-updates the configuration on session start; update flows now require an explicit user request plus visible `chezmoi diff`
- default permissions were hardened so bash asks by default, `.secrets` paths are denied for read and external access, and broad silent secret reads are no longer part of the reviewed defaults
- the Mistral OCR skill was re-hardened so sanitizing error handling, component-level symlink rejection, and resolved-path output writes survive the move into the chezmoi tree

An alternative would have been to keep `setup.sh` and add chezmoi beside it for a transition period. That was rejected because it would preserve two competing sync models, keep the old attack surface alive, and confuse the public source-of-truth story.

## Impact assessment

- public installs now use chezmoi directly and no longer depend on `setup.sh`
- the runtime shipped to `~/.config/opencode/` is now sourced from `home/dot_config/exact_opencode/`, which matches the intended chezmoi structure for this repository
- contributor tooling that points at runtime paths had to move with the tree, most notably README path examples, CONTRIBUTING path examples, and Renovate dependency-catalog tracking
- security posture improved materially: no automatic self-update on session start, no silent broad bash execution by default, restored OCR error redaction, and explicit `.secrets` denial patterns
- one residual non-blocking medium risk remains documented by security review: `exact_opencode` can still delete unmanaged `~/.config/opencode/` files if an existing user ignores the migration and backup steps. This is documented in README and CONTRIBUTING, but no technical stop gate was added in this pass

## Validation steps

1. read the source dotfiles OpenCode subtree, target repository rules, and setup-related traces before delegating implementation
2. compared the new runtime tree against the dotfiles source with `diff -qr`, excluding the intentional orchestrator divergence and excluded private-only material
3. reviewed the modified runtime files directly, including `home/dot_config/exact_opencode/agent/orchestrator.md`, `home/dot_config/exact_opencode/opencode.jsonc`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md`, `README.md`, `.github/CONTRIBUTING.md`, and `.github/renovate.json`
4. ran `git diff --check` and fixed the only reported whitespace defect in a review trace
5. synced markdownlint configuration and ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix` with zero errors afterward
6. parsed the embedded Python code block in the OCR skill with `ast.parse` to confirm the final sanitizer changes are syntactically valid
7. ran `chezmoi apply --dry-run --source "/home/luca/Documents/github-digitalygo/opencode-setup" --destination "/tmp/opencode/opencode-setup-verify" --no-tty` to confirm the chezmoi source tree still produces the expected `~/.config/opencode/` target layout
8. ran `security-review-specialist` repeatedly until the high findings were resolved; final review reported no blocker and only a residual non-blocking medium migration/data-loss risk in `substrate/traces/reviews/2026-06-15-chezmoi-secret-permission-regression.md`
