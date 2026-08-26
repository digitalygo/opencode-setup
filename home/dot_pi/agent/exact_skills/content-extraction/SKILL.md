---
name: content-extraction
description: Extract the main content of a known URL as Markdown, using the cheapest tool that works. Use when the user asks to extract, read, or fetch the content of a page. Prefer the local Defuddle parser first, then exa_contents as a paid fallback, then Chrome DevTools as a last resort.
---

# Content extraction

Extract the main content of a known URL as Markdown, using the cheapest tool that works. Search is separate and unchanged: use `exa_search` to find pages.

## Tools, in order of preference

### 1. Defuddle (default)

Local, MIT, no API key, no per-page cost. Fetches the HTML and extracts the main content, Readability-style, plus schema.org metadata.

```bash
npx defuddle parse <url> --markdown
```

Install once for a faster command:

```bash
npm install -g defuddle
defuddle parse <url> --markdown
```

Add `--json` to get title, author, description, and other metadata.

Use for static pages: blogs, documentation, articles, notes. Not for JavaScript-rendered pages (returns an empty shell) or heavily bot-protected sites (may return 403).

### 2. exa_contents (fallback)

Use `exa_contents` when Defuddle returns empty or a fetch error. Exa fetches server-side with JavaScript rendering and anti-bot, so it also covers SPAs and bot-protected pages.

Pros: server-side fetch, JavaScript rendering, anti-bot, highlights. Cons: paid, billed per page.

### 3. Chrome DevTools MCP (last resort)

Use `pi-chrome-devtools-mcp` only when exa_contents also fails or you need to interact with the page (click, scroll, log in) before extracting.

Pros: full browser control. Cons: slow and involved.

The default model has no vision. Extract text through the DOM (snapshot or `document.body.innerText`), not screenshots.

## Decision

1. Try Defuddle first.
2. If the result is empty or a fetch error, use exa_contents.
3. If exa_contents also fails or you need to interact with the page, use Chrome DevTools.

## Notes

- Defuddle is not a search tool. Find pages with `exa_search`, then extract them with this workflow.
- For local files (PDFs, Office documents, images), use the document conversion skill instead of this skill.
