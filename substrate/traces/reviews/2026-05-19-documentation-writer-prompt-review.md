---
status: completed
created_at: 2026-05-19
reviewer: security-specialist
target: opencode-setup/agent/documentation-writer.md
scope: Read-only prompt review of documentation-writer subagent definition. Evaluated permission model, lint workflow supply-chain surface, and new language/grammar rules. No active scans, no Docker execution, no network tests.
git_commit: N/A (read-only, no git operations performed)
branch: N/A
topic: Security review of grammar/tone/language prompt update and pre-existing lint workflow
supporting_docs: []
---

## 1. Summary

Two supply-chain findings (1 medium, 1 low) in the **lint workflow** (lines 67–82). The new language/grammar/register rules (lines 55–64, the stated change) are clean — zero security impact. Permission model (lines 10–14) is correctly scoped: write access restricted to `*.md` files only.

## 2. Scope and methodology

- **Target**: `opencode-setup/agent/documentation-writer.md` — subagent prompt definition
- **Method**: Manual code review of prompt text. Cross-referenced with `AGENTS.md`, `.github/CONTRIBUTING.md`, `.markdownlint.json`, `.markdownlintignore`
- **Focus areas**: Permission escalation, prompt injection, command injection, supply chain, data leakage, instruction ambiguity, compliance with repository standards
- **Not tested**: Runtime behavior, Docker execution, network scans, active exploitation
- **Limitations**: Read-only review. Did not verify GitHub repo ownership of `one-ring-ai/dotfiles` or audit its commit history.

## 3. Findings by severity

### Medium

#### M1 — Remote lint config fetched via curl without integrity verification

- **Location**: `opencode-setup/agent/documentation-writer.md`, lines 67–71
- **Evidence**:

  ```text
  curl -fsSL https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlint.json -o ./.markdownlint.json && curl -fsSL https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlintignore -o ./.markdownlintignore
  ```

  The prompt instructs the agent to download and overwrite local lint config files from a remote GitHub repository before every lint run. No checksum, no signature verification, no TLS pinning.

- **Impact**: If the `one-ring-ai/dotfiles` repository is compromised, an attacker can:
  1. Ship a `.markdownlint.json` that disables all rules — masking malicious markdown content (XSS payloads, phishing links, obfuscated malicious code snippets) in any `.md` file the agent touches.
  2. Ship a `.markdownlintignore` that excludes specific directories from scanning, hiding injected files.
  
  The agent writes `.md` files across the repository (permission on line 13–14). A compromised lint config weakens the last automated check before content lands in the repo.

- **False-positive notes**: This is a confirmed finding. The pattern also exists in `AGENTS.md` line 21, which establishes it as an intentional convention — but the documentation-writer agent is the only agent that autonomously executes this workflow. The risk is real but partially mitigated by the fact that markdownlint configs are declarative (not executable code). However, `npx markdownlint-cli` (next finding) escalates this.

- **Remediation**:
  1. **Pin a known-good hash**: Add a `sha256sum` check after curl. Example:

     ```bash
     curl -fsSL https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlint.json -o ./.markdownlint.json
     echo "EXPECTED_SHA256  ./.markdownlint.json" | sha256sum -c || exit 1
     ```

  2. **Fail closed on fetch error**: Add `set -e` before the curl chain and handle failures. Currently if curl fails, the agent proceeds with stale or no config.

  3. **Vendor the config** (preferred long-term): Commit `.markdownlint.json` and `.markdownlintignore` directly to the repo and remove the remote fetch step. Update via Dependabot/pull requests, not autonomous curl.

  4. **Pin the npx version** (see M2 below) — mitigates the case where a compromised config interacts with a compromised linter.

### Low

#### L1 — Unpinned `npx markdownlint-cli` execution

- **Location**: `opencode-setup/agent/documentation-writer.md`, lines 73 and 75
- **Evidence**:

  ```text
  npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix
  ```

  No version constraint on the `markdownlint-cli` package. `npx` fetches the latest version from the npm registry each run.

- **Impact**: If the `markdownlint-cli` npm package is compromised (supply-chain attack, typo-squatting, maintainer account takeover), the agent executes malicious JavaScript in its runtime context. The agent has filesystem write access (to `.md` files) and network access (per the curl above). A malicious linter could exfiltrate repository contents, modify arbitrary files the agent can reach, or inject payloads into documentation.

- **False-positive notes**: Confirmed. `npx` without a version tag is a known supply-chain vector. The documentation-writer agent runs this autonomously and repeatedly (before every markdown edit).

- **Remediation**:
  1. Pin a specific version:

     ```bash
     npx markdownlint-cli@0.44.0 "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix
     ```

  2. Prefer `npx` with `--yes` only if interactivity is suppressed, else use a locally installed dev dependency (`npm install --save-dev markdownlint-cli@0.44.0 && npx markdownlint-cli ...`).

### Informational

#### I1 — Grammar/tone/register rules (the stated change) — clean

- **Location**: Lines 55–64
- **Evidence**: The new instructions enforce correct grammar, context-aware register (technical vs. academic), and mandatory English for code documentation.
- **Impact**: None. These rules constrain output quality, not behavior. No permission escalation, no injection surface, no data leakage path.
- **Remediation**: None required.

#### I2 — "Translate to English" clause — low theoretical edge

- **Location**: Lines 63–64
- **Evidence**: "If documentation is not in English and there is no established multilingual documentation structure, translate it to English."
- **Impact**: Theoretically, the agent could encounter non-English documentation containing intentionally obscure sensitive content (e.g., internal notes with credentials in Italian) and translate it to English, broadening exposure. In practice, this is negligible — documentation should never contain secrets regardless of language, and this agent only writes `.md` files.
- **Remediation**: None required. Standard secret-scanning (gitleaks, trufflehog) in CI already covers this class of risk.

#### I3 — Permission model — correctly scoped

- **Location**: Lines 10–14
- **Evidence**: `edit: "*": "deny"`, `"*.md": "allow"`, `"**/*.md": "allow"`
- **Impact**: Positive finding. Write access is restricted to markdown files only. No code, no config (except the lint configs it overwrites — see M1), no shell scripts.
- **Remediation**: None required. This is well-scoped.

## 4. Remediation timeline

| Priority | Finding | Rationale |
|----------|---------|-----------|
| 1 (now) | M1 — Remote config fetch | Supply-chain risk. If `one-ring-ai/dotfiles` is compromised, lint becomes blind. Combined with L1, attacker controls both config and tool. Fix: vendor configs or add integrity check. |
| 2 (now) | L1 — Unpinned npx | Supply-chain risk. `npx` pulls latest on every run. Fix: pin version `@0.44.0`. |
| 3 (later) | I2 — Translate edge case | Theoretical only. Fix: ensure CI runs secret scanners on all `.md` files. Already standard practice. |

## 5. Validation notes

- **M1 fix verification**: Remove the curl block from the prompt. Verify `.markdownlint.json` and `.markdownlintignore` are committed to the repo and match the upstream source. Run `npx markdownlint-cli` against existing docs — must pass with zero errors.
- **L1 fix verification**: Add `@<version>` suffix to the `markdownlint-cli` command. Run manually to confirm the correct version resolves. Check `npx markdownlint-cli@0.44.0 --version`.
- **Regression check**: After both fixes, trigger the documentation-writer agent on a test PR. Confirm it lints correctly without remote fetches.

