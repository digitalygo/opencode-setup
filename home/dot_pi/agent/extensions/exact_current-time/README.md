# Current time extension for pi

Injects the current local date and time into the system prompt on every agent turn so the model always knows the present moment.

## What it does

- Subscribes to the `before_agent_start` event.
- Appends a `Current date and time (ISO 8601): ...` line to the system prompt each turn.
- Uses the local timezone with its UTC offset, for example `2025-08-17T14:30:00+02:00`. It does not use UTC.
- Appends to the existing system prompt instead of replacing it, so other extensions that modify the system prompt keep working.
- Makes no network calls and reads no files.

## Loading the extension

`/reload` activates the extension if it was not present at startup. A plain restart also loads it.

## Limitations

The timestamp is captured once at the start of each agent turn and is not updated during a long-running turn.
