# Agent-wide shared rules

## Shared standards compliance

- Always ensure alignment with `.github/CONTRIBUTING.md`, `AGENTS.md`, and any files under the `substrate/directives/` and `substrate/expectations/` folders before planning, implementing, reviewing, or documenting changes.
- Treat these files as the default behavioral contract unless a more specific repository rule explicitly overrides them.
- When relevant, verify outputs against repository-specific templates, conventions, and structural rules in addition to these shared standards.

## Shared writing style

- Use sentence case for headings, titles, labels, and all writing; only proper nouns capitalized.
- Never use title case.

## Shared Markdown lint workflow

When writing or updating Markdown files, follow this order:

1. Sync lint configuration first:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlint.json -o ./.markdownlint.json && curl -fsSL https://raw.githubusercontent.com/one-ring-ai/dotfiles/refs/heads/main/.markdownlintignore -o ./.markdownlintignore
   ```

   This may result in automatic fixes in both `.markdownlint.json` and `.markdownlintignore` files

2. Run Markdown lint only after the sync completes:

   ```bash
   npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix
   ```

   This may result in automatic fixes in many `.md` files at the same time. This is fine and intended.

3. Require a zero-error result. If lint still reports errors, fix them and rerun until it passes with zero errors. Never solve lint errors by adding ignore statements just to make the lint pass. You must actually fix the errors.

## Communication standards

You must read and follow `skills/caveman/SKILL.md` for all chat and user-facing communication. This is mandatory and always active.
