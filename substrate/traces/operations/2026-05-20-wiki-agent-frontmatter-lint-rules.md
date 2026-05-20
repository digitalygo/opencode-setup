---
status: completed
created_at: 2026-05-20
files_edited:
  - agent/wiki.md
  - substrate/traces/operations/2026-05-20-wiki-agent-frontmatter-lint-rules.md
rationale:
  - prevent YAML frontmatter breakage by forbidding colons in title values, which YAML interprets as key-value separators
  - reinforce that lint config files must not be modified locally to maintain consistency with the upstream standard
supporting_docs:
  - agent/wiki.md
---

# Wiki agent frontmatter and lint rules

## Summary of changes

- Updated `agent/wiki.md` "Canonical markdown structure" section: added a rule that `title` values in YAML frontmatter must not contain `:`, as colons are interpreted as key-value separators and can invalidate the entire frontmatter block. Instructs the agent to rephrase titles that would contain a colon.
- Updated `agent/wiki.md` "Critical constraints" section: added a constraint forbidding modification of `.markdownlint.json` and `.markdownlintignore` after syncing from the upstream dotfiles source. The agent must use the downloaded files exactly as-is when running the markdown lint workflow.

## Technical reasoning

- YAML frontmatter uses `key: value` syntax. A literal `:` inside an unquoted title string breaks parsing, corrupting the frontmatter and potentially rendering the page metadata unreadable. Common examples like `"React: a retrospective"` or `"Docker: best practices"` are natural in titles but dangerous in YAML. Requiring rephrasing (e.g., `"React — a retrospective"` or quoting the value) avoids silent breakage.
- `.markdownlint.json` and `.markdownlintignore` are synced from the upstream dotfiles repository as a shared standard. Local modifications would drift from the canonical config and cause inconsistent lint results across agents and sessions. The constraint ensures the wiki agent treats these files as read-only references.

## Impact assessment

- Wiki pages created or edited by the wiki agent will no longer risk broken frontmatter from colon-containing titles.
- Markdown lint runs will remain consistent with the upstream standard across all sessions.
- Both changes are additive constraints; existing behavior and workflows are unchanged.

## Validation steps

1. Read modified sections in `agent/wiki.md` to confirm both rules landed in the correct locations.
2. Verified the "Canonical markdown structure" section now includes the colon rule as part of the YAML frontmatter bullet.
3. Verified the "Critical constraints" section now includes the lint config immutability rule.
4. Confirmed the diff is limited to `agent/wiki.md` with no other files touched.
