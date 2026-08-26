# Chrome DevTools MCP extension for Pi

This extension bridges Pi to the official [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) server over MCP stdio.

## Behavior

- Starts `npx -y chrome-devtools-mcp@latest` when a Pi session starts.
- Discovers the server's tools dynamically and registers every one in Pi.
- Prefixes MCP tool names with `chrome_devtools_` to avoid collisions.
- Uses `--headless=true` by default without reducing the available tool set.
- Does not use `--slim` or `--isolated`.
- Launches Chrome in the background on the first browser tool call.
- Uses a persistent Pi-specific Chrome profile at `~/.cache/chrome-devtools-mcp/pi-profile` so it does not conflict with OpenCode's default MCP profile.
- Shuts down the MCP server and its Chrome process when the Pi session ends.
- Disables Chrome DevTools MCP usage statistics, update notifications, and CrUX lookups.

The package name intentionally uses `@latest`, as requested. Each new MCP process therefore resolves the latest available version through `npx`.

## Full-access flags

The server is started with all standard and optional tool categories enabled:

- input, navigation, emulation, performance, network, and debugging;
- Chrome extension installation and management;
- heap/memory debugging;
- coordinate-based vision tools;
- screencast tools;
- third-party developer tools;
- experimental WebMCP tools;
- DevTools targets and all page types;
- structured output and page-ID routing;
- unrestricted local paths.

A local `ffmpeg-static` dependency is included so the screencast tools work without a system FFmpeg installation.

## Tool names

Examples:

```text
chrome_devtools_list_pages
chrome_devtools_new_page
chrome_devtools_navigate_page
chrome_devtools_take_snapshot
chrome_devtools_take_screenshot
chrome_devtools_click
chrome_devtools_fill_form
chrome_devtools_evaluate_script
chrome_devtools_list_console_messages
chrome_devtools_list_network_requests
chrome_devtools_performance_start_trace
chrome_devtools_lighthouse_audit
chrome_devtools_take_heapsnapshot
chrome_devtools_install_extension
chrome_devtools_execute_webmcp_tool
```

The complete list is taken from the running `@latest` server rather than hardcoded. At installation time, version 1.6.0 exposed 51 tools with the full configuration.

## Commands

```text
/chrome-devtools-status
/chrome-devtools-restart
/chrome-devtools-logs
```

After installing or changing the extension, run:

```text
/reload
```

## Subagents

If a subagent omits `tools`, it receives the normal Pi tool set, including Chrome DevTools tools.

If a subagent declares a `tools` allowlist, every Chrome tool it needs must be listed explicitly:

```yaml
---
name: browser-debugger
description: Debugs web applications using the full Chrome DevTools toolset
model: provider/model:high
tools: read, bash, chrome_devtools_list_pages, chrome_devtools_new_page, chrome_devtools_navigate_page, chrome_devtools_take_snapshot, chrome_devtools_take_screenshot, chrome_devtools_click, chrome_devtools_fill_form, chrome_devtools_evaluate_script, chrome_devtools_list_console_messages, chrome_devtools_get_console_message, chrome_devtools_list_network_requests, chrome_devtools_get_network_request, chrome_devtools_performance_start_trace, chrome_devtools_performance_stop_trace, chrome_devtools_performance_analyze_insight, chrome_devtools_lighthouse_audit
---
```

For unrestricted access to all current and future Chrome tools, omit the `tools` field.

## Security

This is deliberately a high-privilege extension. Chrome DevTools tools can:

- read and modify any page loaded in the Pi Chrome profile;
- execute JavaScript in pages;
- inspect network traffic, console output, cookies, and application state;
- upload local files;
- write screenshots, traces, heap snapshots, reports, and videos;
- install, reload, trigger, and uninstall Chrome extensions;
- access unrestricted local paths through server file operations.

Do not use the Pi Chrome profile for sensitive browsing unless you intend to expose that browser state to the active agent. Headless mode only hides the browser window; it does not reduce the agent's access.

The persistent profile can only be controlled by one independent Chrome DevTools MCP process at a time. Avoid calling browser tools simultaneously from multiple Pi processes or subagents; use one browser-operating agent at a time.
