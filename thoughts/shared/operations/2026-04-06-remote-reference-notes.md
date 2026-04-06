---
status: completed
created_at: 2026-04-06
files_edited: [skills/intents-schema/SKILL.md, skills/modern-css-snippets/SKILL.md, tmp/test/testamento/test-file.md]
rationale: Added remote reference guidance for skills and resolved markdownlint heading requirement.
supporting_docs: [https://github.com/digitalygo/opencode-setup/tree/main/skills/intents-schema/references, https://github.com/digitalygo/opencode-setup/tree/main/skills/modern-css-snippets/references]
---

## Summary of changes

- Added a note to the intents-schema skill pointing to the public references directory when local references are unreadable.
- Added a matching note to the modern-css-snippets skill with the public references directory link.
- Added an H1 heading to tmp/test/testamento/test-file.md to satisfy markdownlint MD041.

## Technical reasoning

- The remote reference links ensure agents can access the tracked templates and schemas even if local files are inaccessible.
- The heading addition addresses the markdownlint requirement that files start with a top-level heading, preventing lint failures during validation.

## Impact assessment

- Documentation-only updates; no runtime or configuration changes.
- Lint compliance reduces future CI friction for markdown validations.

## Validation steps

- Ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix` after syncing lint configs; all issues resolved.
