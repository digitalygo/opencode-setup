---
status: completed
created_at: 2026-05-20
reviewer: security-review-specialist
target: agent/wiki.md, skills/mistral-ocr-pdf-to-md/SKILL.md, tmp/01-attività-economiche.md
scope: read-only follow-up security review of wiki-agent OCR consent gating, OCR skill dependency bootstrap, file validation, network/API handling, and generated Markdown artifact risk
supporting_docs:
  - agent/wiki.md
  - skills/mistral-ocr-pdf-to-md/SKILL.md
  - tmp/01-attività-economiche.md
---

# Summary

Follow-up found 1 medium finding. Prior high consent issue is resolved. Prior path-validation issue is resolved for the reviewed direct-file flow. Prior dependency-bootstrap issue is reduced by the per-user cache and pinned top-level package, but runtime PyPI install still leaves supply-chain and API-key exposure risk. No raw secrets observed. Generated Markdown artifact has no remote links, executable content, or embedded instructions.

# Scope and methodology

Reviewed `git status --short`, scoped `git diff`, full `agent/wiki.md`, full `skills/mistral-ocr-pdf-to-md/SKILL.md`, full `tmp/01-attività-economiche.md`, and the prior review text. Checked prompt trust boundaries, OCR consent flow, source handling, dependency bootstrap, environment variable use, cache/vendor path risk, third-party network/API behavior, cleanup path, symlink/path traversal risk, file type and size validation, and Markdown artifact handling. No Docker, scanner, network, OCR execution, pip install, or active tests run.

# Prior findings status

- `agent/wiki.md:70`: prior high automatic external OCR upload is resolved. The wiki agent now pauses unless the user already requested OCR for those files in the current session, discloses that conversion sends the PDF to Mistral, and waits for explicit approval.
- `skills/mistral-ocr-pdf-to-md/SKILL.md:44-55`: prior medium `/tmp` hijack and unpinned top-level dependency risk is downgraded. The cache moved to `~/.cache/opencode/mistralai_vendor`, and `mistralai==2.4.5` is pinned. Residual runtime-bootstrap risk remains below.
- `skills/mistral-ocr-pdf-to-md/SKILL.md:64-84`: prior medium direct-file symlink/type/size issue is resolved for the reviewed direct-file flow. The snippet rejects final symlinks before resolution, resolves strictly, requires `.pdf`, requires a regular non-empty file, enforces 50 MB, and checks `%PDF-` before upload.

# Findings by severity

## Medium

### M1: runtime PyPI bootstrap still exposes agent runtime and `MISTRAL_API_KEY` to supply-chain compromise

- **Location**: `skills/mistral-ocr-pdf-to-md/SKILL.md:13`, `skills/mistral-ocr-pdf-to-md/SKILL.md:44-55`, `skills/mistral-ocr-pdf-to-md/SKILL.md:88-94`
- **Evidence**: `skills/mistral-ocr-pdf-to-md/SKILL.md:13` requires `MISTRAL_API_KEY` exported in the shell. `skills/mistral-ocr-pdf-to-md/SKILL.md:44-55` prepends `~/.cache/opencode/mistralai_vendor` to `sys.path`, imports from that cache if present, and runs `python -m pip install --target ~/.cache/opencode/mistralai_vendor mistralai==2.4.5` when import fails. The `pip` subprocess has no `env=` scrub and no `--require-hashes` or locked transitive dependency set. `skills/mistral-ocr-pdf-to-md/SKILL.md:88-94` then reads the API key from the inherited environment and uploads the PDF bytes.
- **Impact**: A poisoned user cache, compromised package index, compromised top-level wheel, or compromised transitive dependency can execute Python in the agent context and read exported secrets and local files before OCR. The per-user cache and top-level pin remove the prior shared-`/tmp` and floating-version exposure, but dependency provenance is still not reproducible or cryptographically verified.
- **False-positive notes**: Normal trusted installs are safe. Exploit needs first-run install, existing cache poison, or upstream/package-index compromise. If `mistralai` is installed in a trusted environment and the cache is clean, this path does not trigger.
- **Remediation**: Remove runtime `pip install` from the skill and require a project-managed virtual environment or locked dependency bundle. If bootstrap must stay, install with a constraints or requirements file using hashes, pass a scrubbed environment without `MISTRAL_API_KEY` to `subprocess.check_call`, and verify `vendor_dir` owner, mode, and non-symlink status before adding it to `sys.path`.

# Remediation timeline

1. **Medium**: Remove runtime dependency bootstrap or make it reproducible, hash-verified, and secret-scrubbed before first install or import.

# Validation notes

After remediation, inspect `skills/mistral-ocr-pdf-to-md/SKILL.md` and confirm no runtime `pip install` occurs, or confirm the bootstrap uses hash-locked dependencies, a scrubbed subprocess environment, and cache owner/mode/symlink checks before `sys.path` import. Reconfirm `agent/wiki.md:70` still requires explicit consent before external OCR. Re-review generated Markdown only as untrusted source; current `tmp/01-attività-economiche.md` shows relative image references only and no active content.
