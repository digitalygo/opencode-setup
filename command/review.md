---
description: Review repository changes for CONTRIBUTING compliance
agent: planner
---

# Review changes

Read and follow `skills/caveman-review/SKILL.md` for all review communication.

Perform a comprehensive review of repository changes against the standards
outlined in `.github/CONTRIBUTING.md`, ensuring compliance with code style,
naming conventions, Docker standards, code best practices, API design and
testing requirements.

## Initial response

Acknowledge the review request by stating: "I'll review the repository changes
for compliance with `.github/CONTRIBUTING.md`. This includes checking code
style, naming conventions, Docker standards, code best practices, API design,
testing requirements, and commit message format."

## Preparation

1. Run `git status` to assess the current working tree state and identify
   staged/unstaged changes.
2. Run `git diff --stat` to get an overview of modified files and their change
   scope.
3. Determine the review target:
   - Default to the current working tree (staged and unstaged changes) unless
     the user specifies a commit ref, range, or branch.
   - If parameters are provided (e.g., a specific commit or range), use
     `git diff <ref>` or `git diff <range>` to focus the review.
4. Read `.github/CONTRIBUTING.md` and `AGENTS.md` in full to understand all
   applicable standards.
5. If additional standards are referenced in the contributing guide (e.g.,
   Docker or API design docs), read those as well.
6. If the review scope is ambiguous request clarification from the user before
   proceeding.

## Analysis process

1. For each modified file, run `git diff --unified=0 <file>` to capture exact
   line numbers of changes.
2. Read the entire content of affected files using the Read tool when context is
   needed to evaluate compliance (e.g., for naming conventions or API design
   patterns).
3. Cross-reference changes against guidelines:
   - Code style (Bash, JavaScript, etc.) from CONTRIBUTING.md.
   - Naming conventions for files, functions, and variables.
   - Docker standards if applicable.
   - Code best practices, including no-comments policy.
   - API design principles.
   - Testing requirements.
   - Commit message format (conventional commits).
4. Maintain a Todo list via TodoWrite to track review subtasks, such as "Analyze
   file X for style violations" or "Check commit messages in range Y".

## Reporting findings

1. Summarize overall compliance: State whether changes fully comply, partially
   comply, or have violations.
2. If violations are found:
   - Create a review file in `substrate/traces/reviews/` with
     `YYYY-MM-DD-review.md` naming (append a short slug like
     `-api-changes` if multiple reviews occur on the same date).
   - For YAML frontmatter, required sections, and review file format, load the
     `mycelium-review` skill.
   - Ensure all findings reference specific sections of
     `.github/CONTRIBUTING.md` or other standards.
   - If `substrate/traces/` does not exist, check for legacy `thoughts/`
     directory and report that the repository needs migration before creating
     review files.
3. If no violations are detected, state "No violations of
   `.github/CONTRIBUTING.md` were found in the reviewed changes" and do not
   create a review file.

## Final response

Communicate results to the user:

- If a review report was created, provide a link to the file (e.g.,
  `substrate/traces/reviews/YYYY-MM-DD-review.md`) and summarize key findings,
  highlighting any blocking issues that must be addressed before merging.
- If no issues were found, confirm compliance and note that no report was
  generated.
- Remind the user that this is a review-only process; no repository files were
  modified. If clarification is needed on scope or findings, request it
  explicitly.
