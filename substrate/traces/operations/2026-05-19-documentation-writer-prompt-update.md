---
status: completed
created_at: 2026-05-19
files_edited:
  - agent/documentation-writer.md
  - substrate/traces/operations/2026-05-19-documentation-writer-prompt-update.md
rationale:
  - strengthen the documentation-writer prompt with explicit grammar requirements
  - require context-appropriate register for technical programming documentation and academic-style educational material
  - enforce English as the preferred language for code-related documentation
supporting_docs:
  - AGENTS.md
  - .github/CONTRIBUTING.md
  - substrate/traces/reviews/2026-05-19-documentation-writer-prompt-review.md
---

# Summary of changes

- Updated `agent/documentation-writer.md` to require correct grammar in all outputs.
- Clarified that the agent should use a highly technical register for programming and code documentation, a more academic and expository register for lessons or elaborated informational material, and English for code-related documentation.

# Technical reasoning

The previous prompt already established a professional, technical, and accessible tone, but it did not explicitly require grammatical correctness or instruct the agent to adapt its writing register to the subject matter. The user requested stronger quality guidance so the agent produces documentation that reads well and matches the context.

The change was implemented as a minimal prompt refinement instead of a broader rewrite. This preserves the existing structure, keeps the prompt in second person as required by `.github/CONTRIBUTING.md`, and avoids unrelated behavioral changes. The language guidance was also tightened so code and programming documentation must be written in English, which aligns with common software documentation conventions and the user request.

# Impact assessment

- The documentation writer is now more explicitly constrained toward polished, grammatically correct prose.
- Code documentation output should become more consistently English and technically precise.
- Educational or explanatory content can now adopt a more academic tone without conflicting with the default technical style.
- No permissions, tools, or file scope were changed.

# Validation steps

- Read `AGENTS.md` and `.github/CONTRIBUTING.md` to verify shared writing and prompt-style requirements.
- Read `agent/documentation-writer.md` before and after the edit to confirm only the intended guidance changed.
- Reviewed `git diff` to verify only `agent/documentation-writer.md` changed before the operation record was added.
- Synced `.markdownlint.json` and `.markdownlintignore` as required by repository policy.
- Attempted to run `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`, but the environment does not have `npx` installed, so full lint validation could not be completed in-session.
- Requested a security review of the modified prompt file and read `substrate/traces/reviews/2026-05-19-documentation-writer-prompt-review.md`.
