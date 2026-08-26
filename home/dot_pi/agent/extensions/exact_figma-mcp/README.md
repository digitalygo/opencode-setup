# Figma MCP extension for Pi

This extension bridges Pi to the official [`figma-developer-mcp`](https://www.npmjs.com/package/figma-developer-mcp) server over MCP stdio.

## Behavior

- Starts `npx -y figma-developer-mcp@latest --stdio` when a Pi session starts.
- Discovers the server's tools dynamically and registers every one in Pi.
- Prefixes MCP tool names with `figma_` to avoid collisions.
- Passes the Figma token to the server through the `FIGMA_API_KEY` environment variable; the key is never placed on the command line and never logged.
- Maps MCP results (including image content such as Figma screenshots and resource blobs) into Pi content.
- Shuts down the MCP server when the Pi session ends.

The package name intentionally uses `@latest`, as requested. Each new MCP process therefore resolves the latest available version through `npx`.

## API key

The extension reads the Figma Personal Access Token from `~/Documents/.secrets/figma-token` and passes it to the child process via the `FIGMA_API_KEY` environment variable (the mechanism the `figma-developer-mcp` server supports). The key is never written to `argv`, never logged, and only ever lives in the child process environment.

If the token file is missing or empty, the server is not started. The extension shows an error status, emits `Figma MCP skipped: no API key at ~/Documents/.secrets/figma-token` once at session start, and `/figma-status` reports that the key is missing.

## Tool names

Examples:

```text
figma_get_figma_data
figma_download_figma_images
```

The complete list is taken from the running `@latest` server rather than hardcoded. At installation time, version 0.13.2 exposed 2 tools. The `figma_get_figma_data` tool fetches design metadata for a Figma URL, which is the natural entry point before implementing a design.

## Commands

```text
/figma-status
/figma-restart
/figma-logs
```

After installing or changing the extension, run:

```text
/reload
```

## Security

This extension grants a high-privilege Figma token to the active agent. Figma tools can read and modify the authenticated Figma account: create and edit files, write native content to the canvas, download assets, and read design metadata.

Only use a token you are willing to expose fully to the agent. Prefer a dedicated Figma token scoped to the specific files or team you intend to work with rather than a personal account token with broad access.
