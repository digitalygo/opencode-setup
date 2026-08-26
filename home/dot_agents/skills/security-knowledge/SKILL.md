---
name: security-knowledge
description: On-demand cybersecurity knowledge library (817 skills, 38 categories). Load when you need deep, step-by-step guidance on a specific security technique, tool, or domain beyond your role skill. Find skills via references/index.md, read only a candidate's frontmatter first, then the full skill only on a confirmed match.
---

# Security knowledge library

You have access to a library of 817 production-grade cybersecurity skills across 38 categories, sourced from `mukul975/Anthropic-Cybersecurity-Skills` (Apache-2.0). Each skill is a self-contained procedure for a specific security task, mapped to MITRE ATT&CK, NIST CSF 2.0, MITRE ATLAS, D3FEND, NIST AI RMF, and MITRE F3.

The skills live under `references/<skill-name>/` and are NOT preloaded. Load them on demand, only when the current task actually needs them.

## When to use

Consult this library when you need expert, step-by-step guidance on a specific technique, tool, or domain that your role skill and general knowledge do not cover in enough depth, for example:

- auditing a specific cloud service or IaC (AWS S3, GCP IAM, Azure AD, Kubernetes RBAC, Terraform)
- analyzing a specific artifact (memory dump, malware sample, log source, network capture, disk image)
- a specific vulnerability class, attack technique, or defensive countermeasure

Do not read skills speculatively. Do not preload. Load only what the task needs.

## How to find and load a skill

Follow this flow, stopping as soon as you have what you need:

1. **Read the index** at `references/index.md`. It lists all 817 skills grouped by category. Find the category or categories that match your task.
2. **Shortlist candidates** from the index alone. The skill directory names are descriptive (`auditing-aws-s3-bucket-permissions`, `analyzing-dns-logs-for-exfiltration`).
3. **Read only the frontmatter of each candidate**: the YAML block at the top of `references/<name>/SKILL.md` (roughly the first 10-25 lines, up to the closing `---`). It contains the description, category, tags, and framework mappings. This is enough to confirm whether the skill applies to your problem, without reading the whole procedure.
4. **Read the full skill only for a confirmed match**: `references/<name>/SKILL.md`, plus any files under that skill's own `references/` when the procedure points to them.

A skill may include executable helpers under its `scripts/` directory. Run them only when the skill instructs you to and the action is within your authorization scope.

## Guardrails

- This library includes offensive and dual-use techniques. Use it only for authorized security work: systems you own, systems you have explicit written permission to test, or systems explicitly in scope for the current task.
- The library is reference knowledge. It does not change your role, scope, blocking threshold, or read-only constraints. Those still apply.
