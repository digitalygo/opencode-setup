---
name: mycelium-research
description: Authoring guidance for Mycelium research documents — findings, analysis, and opportunity assessments before planning starts
---

# Mycelium research authoring

Use this guidance when you write research documents under `substrate/traces/research/`. Research captures findings, analysis, and assessments that inform later planning and implementation.

## What research documents are

Research documents record the output of investigation. They capture:

- Codebase analysis and pattern discovery
- Web research findings with source references
- Improvement opportunities with priority and impact assessment
- Feasibility and trade-off analysis
- Answers to user questions that produce lasting reference value

Research must be thorough and verifiable. Do not write research that only paraphrases the question without adding findings. Capture all findings in detail and keep the user scope in mind. Every research document is written for a specific investigation purpose; do not drift outside that scope.

## When to write a research document

- You conducted an investigation that produced findings with lasting value
- The user asked you to save your research as documentation
- The findings inform future plans, operations, or decisions
- The scope and findings are substantial enough to reference later

Skip writing a research document when the user only asked a quick question and no lasting reference value exists.

## File naming

Use this format:

```text
substrate/traces/research/YYYY-MM-DD-description.md
```

- `YYYY-MM-DD` is today's date
- `description` is a brief kebab-case summary

If you need to write documentation under `docs/` or `tmp/` instead of `substrate/traces/research/`, follow the repository guidelines in `AGENTS.md`, `.github/CONTRIBUTING.md`, directives, and expectations.

## Body structure

Structure research documents around these patterns:

### For codebase analysis

1. **Scope** — what was reviewed, what was excluded
2. **Executive summary** — key findings in one paragraph
3. **What you reviewed** — list of files, agents, or systems inspected
4. **Findings** — organized by area or priority
5. **Recommendations** — ordered by impact and effort

### For improvement opportunities

1. **Scope**
2. **Executive summary**
3. **Proposed improvements** — each with: why change it, what result it brings, why it matters
4. **Priority order** — immediate vs next wave
5. **Expected outcomes by area** — table summary

### For general investigation

1. **Scope**
2. **Findings** — with source references and verification
3. **Analysis** — interpretation and synthesis
4. **Recommendations** — if applicable

## Verification requirements

When research includes codebase findings:

- Cross-verify with at least one other subagent when producing findings that will inform an implementation plan
- Always read subagent outputs directly; never assume findings are correct without reviewing the result
- Reference exact file paths and line numbers where applicable

When research includes web findings:

- Run `date` first to anchor findings to the current year
- Include source URLs
- Verify information across multiple sources when feasible

## Agent responsibility

Research is written by the planner agent or the quick agent. The planner uses research as input for plans. The quick agent uses research to answer user questions thoroughly.

## Plan vs research

| Aspect | Plan | Research |
|--------|------|----------|
| Output | Ordered steps for execution | Findings and analysis |
| Audience | Orchestrator and implementers | Decision-makers |
| Actionability | Must be executable | May inform but not prescribe |
| File path | `substrate/traces/plans/` | `substrate/traces/research/` |
| Author | Planner agent | Planner or quick agent |

## Available references

See existing research under `substrate/traces/research/` for working examples.
