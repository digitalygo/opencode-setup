---
status: completed
created_at: 2026-04-13
files_edited:
  - skills/caveman/SKILL.md
  - substrate/traces/operations/2026-04-13-caveman-language-and-question-clarity.md
rationale:
  - keep caveman replies terse while making clarification questions easier to understand
  - enforce reply-language mirroring to stop accidental Italian-English mixing
supporting_docs:
  - AGENTS.md
  - .github/CONTRIBUTING.md
  - substrate/traces/operations/2026-04-11-caveman-prompt-instructions-update.md
---

# Caveman language and question clarity

## Summary of changes

- Updated `skills/caveman/SKILL.md` to explicitly mirror the user's language instead of relying on implicit model behavior.
- Added a narrow exception for clarification questions so the agent asks one short, complete, plain-language question before returning to terse mode.
- Added an Italian example that contrasts a clear clarification question with an overly fragmented version.

## Technical reasoning

- The active caveman rules already compressed explanations well, but they did not define how to handle multilingual chats or question phrasing.
- Read-only experiments were run through multiple `general` subagent sessions:
  - 2 baseline sessions with the current skill only
  - 3 candidate A sessions with language mirroring plus short natural questions
  - 3 candidate B sessions with stronger wording for complete-sentence questions and full reply-language matching
- Baseline sessions were already terse, but they offered no explicit guarantee against language drift.
- Candidate B produced the most stable clarification-question behavior across sessions: short, natural questions in the user's language without losing terse explanations in later answers.
- The final wording added to the skill follows that stronger candidate B pattern while keeping the diff small.

## Impact assessment

- User-facing chat behavior should stay concise for normal explanations.
- Clarification questions should now read more naturally, especially in Italian, because the skill tells the agent to leave fragment mode temporarily for questions.
- Cross-language consistency should improve because the skill now explicitly tells the agent to keep the user's language unless the user switches first or a technical term is better left unchanged.
- Commit and review communication remain unaffected because they use `skills/caveman-commit/SKILL.md` and `skills/caveman-review/SKILL.md`.

## Validation steps

1. Researched repository rules and prior caveman decisions in `AGENTS.md`, `.github/CONTRIBUTING.md`, and `substrate/traces/operations/2026-04-11-caveman-prompt-instructions-update.md`.
2. Ran the read-only subagent experiment matrix described above and compared question clarity plus language consistency between baseline and candidate prompts.
3. Verified the real workspace diff with `git diff -- skills/caveman/SKILL.md`.
4. Read the final file contents directly to confirm the new language-mirroring rule, question rule, and example block were present.
