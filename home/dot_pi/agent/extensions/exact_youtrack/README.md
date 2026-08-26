# YouTrack extension for pi

Adds eight tools for reading and managing issues on your YouTrack instance:

- `youtrack_list_projects`: list projects
- `youtrack_search_issues`: search issues
- `youtrack_get_issue`: read one issue in full
- `youtrack_list_comments`: read an issue's comments
- `youtrack_create_issue`: create an issue
- `youtrack_update_issue`: update summary or description
- `youtrack_add_comment`: add a comment
- `youtrack_run_command`: apply a command (state, assignee, tags, links)

## Configuration

The extension reads the base URL and a permanent token from a credentials file. By default:

```text
~/Documents/.secrets/youtrack-key
```

The file has one value per line:

```text
https://digitalygo.youtrack.cloud
perm-your-token-here
```

Line 1 is the base URL, line 2 is the permanent token. The file must be readable only by your user:

```bash
chmod 600 ~/Documents/.secrets/youtrack-key
```

Environment variables take precedence over the file. The `YOUTRACK_URL` and `YOUTRACK_TOKEN` variables are preferred; `YT_URL` and `YT_TOKEN` are accepted as aliases. You can mix sources, for example setting `YOUTRACK_URL` and reading the token from the file. The base URL must be `https:` and trailing slashes are stripped.

The credential is read when each request starts, so changes to the file or environment do not require restarting pi. The extension never includes the token in tool results or session details; the token is sent to YouTrack only as an `Authorization: Bearer` header.

Run `/youtrack` to check the configuration.

## Usage

Ask pi naturally, for example:

- `Che issue ci sono su DiggoCMS?`
- `Apri il ticket DCMS-62 e riassumi la descrizione.`
- `Crea un issue in DCMS dal titolo "Fix login" con questa descrizione.`
- `Sposta DCMS-62 in stato In Progress.`

The model calls the tools above directly. All read results are formatted as readable markdown. Large results are limited to pi's standard 2,000-line/50 KB tool-output cap; complete output is written to a temporary file when truncation occurs.

## The commands tool and braces

`youtrack_run_command` mirrors the YouTrack command box for structured changes such as state, assignee, tags, or links.

Multi-word values must be wrapped in braces:

| Intent | Command query |
|--------|---------------|
| Set state to In Progress | `State {In Progress}` |
| Set state to Open (single word) | `State Open` or `Open` |
| Assign to a user | `assignee luca.nori` |
| Assign to me | `for me` |
| Add a tag | `tag frontend` |
| Add a tag with spaces | `tag {To deploy}` |
| Link a subtask | `subtask of DCMS-10` |

Target issues are passed through the `issues` parameter, so the query should not be prefixed with `for:`. Set `silent` to `true` to avoid sending notifications. The commands endpoint returns HTTP 200 with an empty body on success, which the extension treats as success.

## Billing

This extension talks to your own YouTrack instance over the REST API. There is no per-call API billing.

API docs: <https://www.jetbrains.com/help/youtrack/devportal/>
