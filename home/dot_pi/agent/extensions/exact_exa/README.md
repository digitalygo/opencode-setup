# Exa extension for pi

Adds two global tools:

- `exa_search`: Exa Search API (`POST https://api.exa.ai/search`)
- `exa_contents`: Exa Contents API (`POST https://api.exa.ai/contents`)

This extension replaces the previous `exact_kagi` extension.

## Configuration

Create an API key at <https://dashboard.exa.ai/api-keys>. By default, the extension reads it from:

```text
~/Documents/.secrets/exa-token
```

The file must contain only the key and be accessible only by your user:

```bash
chmod 600 ~/Documents/.secrets/exa-token
```

Environment variables `EXA_API_KEY` and `EXA_API_TOKEN` take precedence over the file. Set `EXA_API_KEY_FILE` to use a different file path.

The credential is read when each request starts, so changes to the file do not require restarting pi. The extension never includes the key in tool results or session details; the key is sent to Exa only as an `x-api-key` request header.

Run `/exa` to check the configuration.

## Usage

Ask pi naturally, for example:

- `Cerca le ultime novità su TypeScript 6 con Exa.`
- `Recupera il contenuto completo di https://example.com/article.`

The model can call `exa_search` and `exa_contents` directly. Search defaults to 10 results with relevance highlights enabled. Both tools return readable markdown.

Large results are limited to pi's standard 2,000-line/50 KB tool-output cap. Complete output is written to a temporary file when truncation occurs.

## Endpoints

- `exa_search` calls `POST https://api.exa.ai/search`, supporting filters for category, publish date, include/exclude domains, and user location.
- `exa_contents` calls `POST https://api.exa.ai/contents` for 1-10 HTTPS URLs. Per-URL failures are reported through Exa's `statuses` field.

## Billing

Exa Search and Contents calls are billed according to your Exa account. Requests that fetch full page text (`exa_search.text` or `exa_contents.text`) and LLM summaries (`summary`) cost more. Relevance highlights are the cheap default and are enabled on `exa_search` by default.

API docs: <https://docs.exa.ai/reference>
