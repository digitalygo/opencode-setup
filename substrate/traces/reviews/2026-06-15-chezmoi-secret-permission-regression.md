---
status: completed
created_at: 2026-06-15
updated_at: 2026-06-15
reviewer: security-review-specialist
target: chezmoi migration secret storage and OpenCode permissions
scope: current uncommitted chezmoi migration diff for secret location, external-directory permissions, install/update docs, and exact OpenCode target behavior
supporting_docs:
  - README.md
  - .chezmoiroot
  - home/dot_config/exact_opencode/opencode.jsonc
  - home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md
  - home/dot_config/exact_opencode/skills/replicate-png-generation/SKILL.md
  - home/dot_config/exact_opencode/skills/replicate-svg-generation/SKILL.md
---

# Summary

1 high and 1 medium finding. Main risk: the migration moves API tokens into `~/Documents/.secrets/` while the default OpenCode permission config allows `~/Documents/**` and does not deny `.secrets/`, making bearer tokens reachable to read-capable agents. Secondary risk: the exact chezmoi target can delete legacy unmanaged OpenCode state during immediate apply.

# Scope and methodology

Reviewed `git status --short`, `git diff --stat`, the documentation and Renovate diff, moved runtime config under `home/dot_config/exact_opencode/`, prior review threads under `substrate/traces/reviews/`, and targeted old-vs-new runtime file comparisons. Checked secret storage, permission rules, bootstrap/update commands, exact directory behavior, supply-chain paths, prompt trust boundaries, and false positives. No Docker, scanner, network fetch, chezmoi apply, OCR/API execution, or active tests run.

# Findings by severity

## High

### H1: canonical secret path sits inside a globally allowed external directory

- **Location**: `README.md:42-48`, `README.md:160-172`, `home/dot_config/exact_opencode/opencode.jsonc:36`, `home/dot_config/exact_opencode/opencode.jsonc:55-67`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:13`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:125-130`, `home/dot_config/exact_opencode/skills/replicate-png-generation/SKILL.md:13`, `home/dot_config/exact_opencode/skills/replicate-png-generation/SKILL.md:49-58`, `home/dot_config/exact_opencode/skills/replicate-svg-generation/SKILL.md:13`, `home/dot_config/exact_opencode/skills/replicate-svg-generation/SKILL.md:47-54`
- **Evidence**: Migration docs tell users to move old local tokens to `~/Documents/.secrets/` (`README.md:42-48`) and list `figma-token`, `replicate-key`, and `mistral-key` there (`README.md:160-172`). The Figma MCP server reads `~/Documents/.secrets/figma-token` (`home/dot_config/exact_opencode/opencode.jsonc:36`). The global permission config allows external access to all `~/Documents/**` (`home/dot_config/exact_opencode/opencode.jsonc:55-59`) and read denies only `.env` patterns (`home/dot_config/exact_opencode/opencode.jsonc:60-67`). The Mistral and Replicate skills read API tokens from the same directory (`home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:13`, `:125-130`; `home/dot_config/exact_opencode/skills/replicate-png-generation/SKILL.md:13`, `:49-58`; `home/dot_config/exact_opencode/skills/replicate-svg-generation/SKILL.md:13`, `:47-54`).
- **Impact**: Read-capable agents and subagents can be pointed at `~/Documents/.secrets/*` under the default permission boundary. Prompt injection in a workspace document or mistaken user/task instruction can cause bearer tokens for Figma, Replicate, or Mistral to be read and then surfaced in chat, traces, logs, generated docs, or network-capable tool calls. Moving tokens under a broad work-document allowlist removes the stronger separation that a dedicated secret directory should provide.
- **False-positive notes**: No raw secret values were present in the repository. Some prompts add best-effort secret redaction, and MCP/file interpolation may not need read-tool access to the token file. Risk remains because the enforceable permission config does not deny `.secrets/` under `~/Documents`, and several agents can read referenced files or run broad bash commands. No active permission test was run.
- **Remediation**: Move secrets outside broad document/workspace allowlists, for example `~/.local/share/opencode-secrets/`, or add explicit deny rules for `~/Documents/.secrets/**`, `**/.secrets/**`, `*secret*`, `*token*`, `*credential*`, `*.pem`, and `*.key` in both external-directory and read permissions. If rule order is last-match-wins, place deny rules after broad allows. Keep MCP token interpolation working through the narrowest needed mechanism, not general read access.

## Medium

### M1: exact chezmoi apply can delete legacy secrets and unmanaged OpenCode state

- **Location**: `.chezmoiroot:1`, `README.md:10`, `README.md:42-48`, `README.md:52`, `README.md:69-80`
- **Evidence**: `.chezmoiroot:1` makes `home/` the source root. Quick start immediately applies the repo with `chezmoi init --apply digitalygo/opencode-setup` (`README.md:10`). The runtime tree is `home/dot_config/exact_opencode/` and maps to `~/.config/opencode/` (`README.md:52`, `README.md:69-80`). The migration note tells legacy users to move `~/.config/opencode/.secrets/` before first apply (`README.md:42-48`), but it sits after the immediate quick-start apply and covers only `.secrets/`.
- **Impact**: Chezmoi exact-directory semantics remove unmanaged target entries. First apply can delete a legacy `~/.config/opencode/.secrets/` directory, local auth/state files, custom agents, or other unmanaged OpenCode files if the user follows quick start or misses the migration note. This is primarily data loss and broken bootstrap/update behavior; it can also force token recreation and disrupt local auth.
- **False-positive notes**: Users who read and complete the migration step before applying avoid the `.secrets/` loss. This review did not run `chezmoi diff` or `chezmoi apply`; the finding is based on the `exact_opencode` source path and documented apply flow.
- **Remediation**: Do not make the whole `~/.config/opencode/` directory exact. Use a non-exact `dot_opencode` root and exact only for managed subdirectories/files, or add a pre-apply migration/backup step that preserves `.secrets/`, auth/state files, and user-local extensions. Move migration warnings before quick start and require `chezmoi diff` plus backup before first apply for existing users.

# Remediation timeline

1. **Immediate (high)**: Deny agent read access to `~/Documents/.secrets/**` or move tokens out of `~/Documents/**`.
2. **Immediate (medium)**: Remove whole-root `exact_opencode` behavior or add backup/migration gates before first apply.

# Validation notes

After remediation, inspect `opencode.jsonc` and confirm secret paths are outside broad external allows or explicitly denied. Try a dry permission check with a read-only agent against `~/Documents/.secrets/figma-token` and confirm denial without exposing the value. Run `chezmoi diff` on a test home containing `.config/opencode/.secrets/` and an unmanaged auth/state file; confirm first apply preserves or backs them up.

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- H1 canonical secret path inside a globally allowed external directory (high): partially resolved, still open — read denies now include `**/.secrets/**` and other secret globs (`home/dot_config/exact_opencode/opencode.jsonc:69-78`), but `external_directory` denies for `~/Documents/.secrets/**` and `~/Documents/**/.secrets/**` appear before the broader `~/Documents/**` allow (`home/dot_config/exact_opencode/opencode.jsonc:55-60`). The same config uses later, more-specific entries to override broader rules in `bash` and `git` permissions (`home/dot_config/exact_opencode/opencode.jsonc:81-147`), so this ordering can re-allow the secret path under last-match semantics. Secrets also remain documented and consumed under `~/Documents/.secrets/` (`README.md:60`, `README.md:197`, `home/dot_config/exact_opencode/opencode.jsonc:36`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:13`, `home/dot_config/exact_opencode/skills/replicate-png-generation/SKILL.md:13`, `home/dot_config/exact_opencode/skills/replicate-svg-generation/SKILL.md:13`).
- M1 exact chezmoi apply can delete legacy secrets and unmanaged OpenCode state (medium): partially resolved — docs now scope quick start to machines with no prior OpenCode configuration (`README.md:5-10`) and put backup, secret-move, and `chezmoi diff` migration steps before the existing-user apply command (`README.md:42-79`). The technical risk remains because `.chezmoiroot:1`, `README.md:40`, and `README.md:111` still define `home/dot_config/exact_opencode/` as an exact target for `~/.config/opencode/`, and no pre-apply migration or backup gate was added.

### New findings

No new independent findings. The high secret-permission finding remains a blocker until the secret path is outside `~/Documents/**` or all `.secrets` denies are guaranteed to win over the broad `~/Documents/**` allow for external access and shell reads.

#### High: H1 still open: `.secrets` deny can be overridden by broad `~/Documents/**` allow

- **Location**: `home/dot_config/exact_opencode/opencode.jsonc:55-60`, `home/dot_config/exact_opencode/opencode.jsonc:69-82`, `README.md:60`, `README.md:197`
- **Evidence**: `external_directory` denies `~/Documents/.secrets/**` and `~/Documents/**/.secrets/**` at lines 58-59, then allows all `~/Documents/**` at line 60. Read denies include `**/.secrets/**` at line 69, but bash remains broadly allowed at lines 81-82. The README still recommends `~/Documents/.secrets/` as the local secret directory at lines 60 and 197.
- **Impact**: If OpenCode applies later matching rules last, the broad external allow reopens `~/Documents/.secrets/*`. With bash broadly allowed, a prompt-injected or mis-scoped agent can read token files through shell commands even if the read tool deny fires.
- **False-positive notes**: This depends on OpenCode permission precedence. The config itself strongly suggests order matters because broad bash/git rules are followed by narrower overrides. No raw secrets were present, and no live permission test was run.
- **Remediation**: Move `~/Documents/**` before `.secrets` denies, or move secrets outside `~/Documents/**` entirely. Add explicit bash denies for commands targeting `~/Documents/.secrets/**`, `**/.secrets/**`, `*secret*`, `*token*`, `*credential*`, `*.pem`, and `*.key`, or avoid broad bash allow for agents that do not need it.

#### Medium: M1 partially open: exact target still lacks technical migration guard

- **Location**: `.chezmoiroot:1`, `README.md:40`, `README.md:42-79`, `README.md:111`
- **Evidence**: Documentation now warns existing users and requires backup plus `chezmoi diff` before apply (`README.md:42-79`). The target remains exact: `.chezmoiroot:1` points at `home`, `README.md:40` says unmanaged files in `~/.config/opencode/` are removed on apply, and `README.md:111` repeats the same exact-sync behavior.
- **Impact**: Existing users who miss or bypass the docs can still lose unmanaged `~/.config/opencode/` state on first apply. Documentation reduces accidental loss but does not enforce preservation.
- **False-positive notes**: New installs have no legacy state to delete, and the migration docs are now clearer and earlier. No `chezmoi diff`, `chezmoi apply`, Docker, scanner, network, or active test was run.
- **Remediation**: Prefer non-exact `dot_opencode` with exact managed subdirectories, or add a pre-apply migration/backup gate that preserves `.secrets/`, auth/state files, and user-local extensions before exact apply.

### New validation notes

After permission remediation, verify rule precedence with a read-only agent and a shell-capable agent against a dummy `~/Documents/.secrets/figma-token` file, without exposing real values. After migration remediation, run `chezmoi diff` and apply in a disposable home containing unmanaged `~/.config/opencode/.secrets/` and auth/state files, then confirm preservation or backup.

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- H1 canonical secret path inside a globally allowed external directory (high): partially resolved, still open — direct external-directory order is now corrected because `~/Documents/**` is allowed before the `.secrets` denies (`home/dot_config/exact_opencode/opencode.jsonc:55-60`), and read denies cover `.secrets`, token, key, and credential globs (`:62-78`). Literal bash commands targeting those names are denied after the broad bash allow (`:81-144`). Risk remains because bash is still globally allowed (`:81-82`), the canonical credentials still live under `~/Documents/.secrets/` (`README.md:60`, `README.md:197`, `home/dot_config/exact_opencode/opencode.jsonc:36`, `home/dot_config/exact_opencode/skills/mistral-ocr-pdf-to-md/SKILL.md:13`, `home/dot_config/exact_opencode/skills/replicate-png-generation/SKILL.md:13`, `home/dot_config/exact_opencode/skills/replicate-svg-generation/SKILL.md:13`), and command-string denies can be bypassed by constructing the secret path without matching the literal blocked globs.
- M1 exact chezmoi apply can delete legacy secrets and unmanaged OpenCode state (medium): partially resolved, residual open — docs now gate existing users through backup, secret relocation, dry run, and diff before apply (`README.md:42-79`) and developer docs warn contributors before local apply (`.github/CONTRIBUTING.md:38-48`). Technical exact-sync behavior remains unchanged (`.chezmoiroot:1`, `README.md:40`, `README.md:48`, `README.md:111`), so users who skip or bypass docs can still lose unmanaged `~/.config/opencode/` files.

### New findings

No new independent findings. The prior secret-permission thread is improved but not closed because broad bash remains an allow-by-default path to the documented credential directory.

#### High: H1 still open: broad bash allow can bypass secret-path deny globs

- **Location**: `home/dot_config/exact_opencode/opencode.jsonc:36`, `home/dot_config/exact_opencode/opencode.jsonc:55-60`, `home/dot_config/exact_opencode/opencode.jsonc:62-78`, `home/dot_config/exact_opencode/opencode.jsonc:81-144`, `README.md:60`, `README.md:197`
- **Evidence**: `opencode.jsonc` still points the Figma MCP token at `~/Documents/.secrets/figma-token` (`:36`). `external_directory` now correctly places the broad `~/Documents/**` allow before the `.secrets` denies (`:55-60`), and read denies include `.secrets`, key, token, and credential patterns (`:62-78`). Bash, however, still allows `*` before deny patterns (`:81-144`). The README continues to recommend `~/Documents/.secrets/` as the local secret directory (`README.md:60`, `README.md:197`).
- **Impact**: Prompt injection or a mis-scoped shell-capable agent can still read token files by using an allowed bash command that builds the path without literal `.secrets`, `secret`, `token`, `credential`, `.pem`, or `.key` substrings. Direct read-tool access and obvious `cat ~/Documents/.secrets/...` commands are better covered, but bash remains a bypassable secret exfiltration path.
- **False-positive notes**: This assumes OpenCode bash permissions are command-pattern checks and do not sandbox filesystem reads after command approval. The repository itself treats last matching permission rules as authoritative in prior reviews, so the new order likely fixes direct-match precedence. No raw secrets were present. No live permission test, network, scanner, Docker, or active exploit was run.
- **Remediation**: Move credentials out of any directory reachable by default shell work, or make `bash` default `ask`/`deny` and allow only narrow read-only commands. If broad bash must remain, do not rely on command-string globs as the only secret boundary; use an execution sandbox, a credential broker, environment injection with redacted logging, or OpenCode-level capability separation that prevents arbitrary shell reads of credential files.

#### Medium: M1 residual: exact target still has no enforced migration guard

- **Location**: `.chezmoiroot:1`, `README.md:40`, `README.md:42-79`, `README.md:111`, `.github/CONTRIBUTING.md:38-48`
- **Evidence**: Documentation now warns existing users and requires backup, secret move, dry run, and `chezmoi diff` before existing-user apply (`README.md:42-79`). Contributor setup also previews with `chezmoi diff` and warns that `exact_opencode` removes unmanaged files (`.github/CONTRIBUTING.md:38-48`). The source root and target remain exact (`.chezmoiroot:1`, `README.md:40`, `README.md:111`).
- **Impact**: Existing users who run quick-start commands on a non-empty `~/.config/opencode/`, skip migration docs, or use automation around `chezmoi apply` can still lose unmanaged auth/state, custom agents, or local extensions. Current docs reduce accidental loss but do not enforce preservation.
- **False-positive notes**: New installs are not affected. Existing users who follow the documented migration steps should preserve local-only files. This is data-loss and operational-risk, not remote code execution. No `chezmoi diff`, `chezmoi apply`, Docker, scanner, network, or active migration test was run.
- **Remediation**: Prefer non-exact `dot_opencode` plus exact managed subdirectories, or add a pre-apply migration/backup gate that detects unmanaged `~/.config/opencode/` files and stops before deletion unless backup/preservation has happened.

### New validation notes

For H1, test a dummy token under `~/Documents/.secrets/` with read tool, literal bash read, and obfuscated bash path construction; confirm all are blocked without exposing values. For M1, run `chezmoi diff` and `chezmoi apply` in a disposable home with unmanaged `~/.config/opencode/` files; confirm preservation or enforced stop before deletion.

## Update: 2026-06-15 by security-review-specialist

### Prior finding status

- H1 canonical secret path inside a globally allowed external directory (high): resolved — direct external access now allows `~/Documents/**` before denying `~/Documents/.secrets/**` and nested `.secrets` paths (`home/dot_config/exact_opencode/opencode.jsonc:55-60`), read denies include `.secrets`, private-key, token, credential, and key globs (`:62-78`), and bash now asks by default instead of allowing every command silently (`:81-82`) with explicit secret/path deny patterns after that default (`:136-144`). Secrets still live under `~/Documents/.secrets/` (`README.md:60`, `README.md:197`, `home/dot_config/exact_opencode/opencode.jsonc:36`), but the prior silent read/bash exposure is closed under the reviewed defaults.
- M1 exact chezmoi apply can delete legacy secrets and unmanaged OpenCode state (medium): partially resolved, residual non-blocking risk remains — quick start is scoped to new installs (`README.md:5-10`), existing users are told to back up, move secrets, run dry-run and `chezmoi diff`, then apply (`README.md:42-79`), and contributor docs warn that exact apply removes unmanaged files (`.github/CONTRIBUTING.md:38-48`). The technical exact-sync behavior remains (`.chezmoiroot:1`, `README.md:40`, `README.md:111`), with no pre-apply backup or stop gate.

### New findings

No new independent findings. One prior residual finding remains.

#### Medium: M1 residual: exact target still lacks an enforced migration guard

- **Location**: `.chezmoiroot:1`, `README.md:40`, `README.md:42-79`, `README.md:111`, `.github/CONTRIBUTING.md:38-48`
- **Evidence**: `.chezmoiroot:1` keeps `home/` as the chezmoi source root. `README.md:40` and `README.md:111` state that `home/dot_config/exact_opencode/` maps to `~/.config/opencode/` and removes unmanaged files on apply. `README.md:42-79` and `.github/CONTRIBUTING.md:38-48` now document backup, secret relocation, dry-run, and diff review before apply, but no technical gate enforces those steps.
- **Impact**: Existing users who skip docs, run automation, or apply to a non-empty `~/.config/opencode/` can still lose unmanaged auth/state, custom agents, local extensions, or legacy secret files. Current docs reduce accidental loss; they do not prevent deletion.
- **False-positive notes**: New installs are not affected. Existing users who follow the migration docs should preserve local files. This is residual data-loss and operational risk, not active secret exposure or remote execution. No `chezmoi diff`, `chezmoi apply`, Docker, scanner, network, or active migration test was run.
- **Remediation**: Keep as accepted residual risk, or add a technical guard: use non-exact `dot_opencode` plus exact managed subdirectories, or add a pre-apply migration/backup check that stops when unmanaged `~/.config/opencode/` files exist until backup/preservation is confirmed.

### New validation notes

For H1 regression, test a dummy token under `~/Documents/.secrets/` with read tool, literal bash read, and obfuscated bash path construction; confirm no silent access and no value exposure. For M1, run `chezmoi diff` and `chezmoi apply` in a disposable home containing unmanaged `~/.config/opencode/` files; confirm preservation, backup, or enforced stop before deletion.

