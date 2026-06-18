# Agent-wide shared rules

## Shared standards compliance

- Always ensure alignment with `.github/CONTRIBUTING.md`, `AGENTS.md`, and any files under the `substrate/directives/` and `substrate/expectations/` folders before planning, implementing, reviewing, or documenting changes.
- Treat these files as the default behavioral contract unless a more specific repository rule explicitly overrides them.
- When relevant, verify outputs against repository-specific templates, conventions, and structural rules in addition to these shared standards.

## Shared writing style

- Use sentence case for headings, titles, labels, and all writing; only proper nouns capitalized.
- Never use title case.
- Never use em dash.

## Shared Markdown authoring standards

When writing Markdown files, produce correct output from the start.

### Structural rules

- **One H1 per file** — mark the document title with a single level-1 heading.
  Use the level-1 heading on the first non-blank, non-front-matter line.
- **Heading progression** — never skip heading levels (H1 then H2 then H3, not
  H1 then H3).
- **Blank lines around blocks** — one blank line before and after every heading,
  fenced code block, list, and blockquote.
- **Single trailing newline** — exactly one newline at end of file. No trailing
  spaces or tabs anywhere in the file.

### List rules

- **Marker consistency** — pick either `-` or `*` for unordered lists and stick
  with it throughout the file.
- **Ordered lists** — use `1.` for every item; the renderer numbers them
  automatically.
- **Indent consistently** — use the same sub-list indent across the entire file
  (2 or 4 spaces).

### Code blocks

- **Fenced blocks only** — use ` ``` ` fences, never indented code blocks.
- **Language tag required** — every fenced code block must include a language
  identifier (` ```bash`, ` ```json`, ` ```markdown`).

### Inline formatting

- **No spaces inside emphasis** — `**bold**` and `_italic_`, not
  `** bold **` or `_ italic _`.
- **No emphasis as heading substitute** — use actual headings, not bolded
  paragraphs.
- **Consistent emphasis style** — use the same marker style for strong and
  emphasis across the file.

### Links

- **Descriptive link text for standard links** — For `[text](url)` links, link
  text must describe the destination; no bare URLs and no "click here". This
  rule applies to standard Markdown links that point to external resources or
  non-vault paths.
- **No empty link targets** — every link must have a non-empty URL.

### Obsidian syntax extensions

Obsidian-specific syntax is explicitly allowed and must be preserved. The base
format remains CommonMark/GFM; the following extensions are first-class and must
not be stripped, converted, or lint-fixed away:

- **Wikilinks** — `[[page-name]]` and `[[page-name|Alias]]` for internal vault
  cross-references. Wikilinks are the preferred linking style inside
  Obsidian-managed vaults. Do not convert them to standard Markdown links.
- **Embeds** — `![[page-name]]` for transcluding content from another note.
- **Callouts** — `> [!note]`, `> [!warning]`, `> [!tip]`, and other Obsidian
  callout types.
- **YAML frontmatter / properties** — `---` delimited metadata blocks at the
  start of a file. Recognized as structural metadata, not content. The "one H1
  per file" rule counts the first heading after frontmatter/properties as the
  document title heading.
- **Block references** — place a block ID with `^block-id` at the end of a
  paragraph; reference it from another note with `[[page-name#^block-id]]`.
- **Tags** — `#tag` and `#nested/tag` syntax for inline tagging.
- **Math** — `$inline$` and `$$display$$` LaTeX math blocks.

### Prohibitions

- **No inline markdownlint suppression directives** — never add
  `<!-- markdownlint-disable -->`, `<!-- markdownlint-disable MDxxx -->`,
  `<!-- markdownlint-configure-file {"MDxxx": false} -->`, or equivalent
  per-file or file-level overrides. When the linter flags an issue, fix the
  content, not the rules.

These standards align with the repository's `.markdownlint.json` configuration,
the CommonMark specification, and Obsidian's CommonMark/GFM-based syntax
extensions. Produce correct Markdown at authoring time; lint is a verification
step, not a repair loop. Obsidian extensions (wikilinks, embeds, callouts,
frontmatter, block refs, tags, math) are valid syntax and must never be
converted or stripped to satisfy lint.
