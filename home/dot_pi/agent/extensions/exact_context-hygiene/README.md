# Context hygiene extension for pi

Replaces pi's summary-based compaction with selective retention and keeps the session context lean between compactions. At compaction time, one LLM pass chooses which existing messages to keep verbatim and all other messages are dropped from the provider-bound context. Between compactions, the extension quietly removes duplicate tool results, purges failed results, and (when it is cache-cheap) blanks out old tool results. No re-interpretation, no summaries anywhere.

Selective compaction is unchanged from the original `exact_selective-compact` extension. The rename to `context-hygiene` reflects the new always-on hygiene features layered on top of it.

## What it does

- **Selective compaction (unchanged).** Builds a numbered manifest of every provider-visible message, asks the active model which to keep verbatim, and stores the result as per-fingerprint drop budgets that filter every provider-bound context. See [Selective compaction](#selective-compaction).
- **Dedup.** Removes old duplicate tool calls, keeping the last 2 occurrences of any identical call.
- **Pin tool.** Lets the model protect specific tool calls from dedup and prune.
- **Error purge.** Removes failed tool results once they fall far enough behind in the conversation.
- **Threshold prune.** Blanks out old, large tool results with a fixed placeholder, but only when the provider prefix cache is already lost.
- **Compaction escalation.** When context is above 65% and the cache is already lost, triggers a selective compaction instead of pruning.

## Pipeline order

Every `context` event passes the messages through three stages, in this order:

1. **Drop-budget filter** (selective compact): applies the persisted per-fingerprint budgets.
2. **Dedup + error purge**: one atomic pass removes the tool call and its result pair together.
3. **Prune**: replaces the content of eligible tool results with the sticky placeholder.

The pipeline always returns `{ messages }`. Dedup and error purge run immediately on every context update; prune itself is gated (see below). The compaction selector runs separately through the `session_before_compact` hook and is not part of this per-call pipeline.

## Features

### Dedup

Identical tool calls beyond the last 2 occurrences are removed immediately.

- A tool call's fingerprint is `toolName::canonical-args`, where the arguments are canonicalized as sorted-key JSON so key order does not change the fingerprint.
- Keeps the last `DEDUP_KEEP_LAST` (2) occurrences by position in the context; older ones are removed atomically with their results.
- Exclusions: pinned tool results, results of the `subagent` tool, and results of the `context_pin` tool are never deduplicated.

Removal is atomic: the `toolResult` message is removed, the matching `toolCall` block is stripped from its assistant message, and the assistant message is dropped entirely if no text or thinking parts remain.

### Pin tool

`context_pin { count?: number }` pins the last one or more tool calls so their results survive dedup and prune.

- `count` defaults to 1 and is clamped to the range 1..20.
- Pins the most recent real tool calls in the session (newest first), excluding calls to `context_pin` itself.
- Pins are keyed by `toolCallId`. They protect pinned results from dedup and from prune, but **not** from the compaction selector, which stays free to keep or drop pinned messages at compaction time.
- Pins never expire.

### Error purge

A failed tool result (a `toolResult` marked `isError`) is removed atomically with its tool call once at least `ERROR_PURGE_MESSAGE_COUNT` (4) messages of any role follow it in the context array. Pinned results are excluded. Counting is by total following messages, not by user turns.

### Threshold prune

Blanks old, large tool results with a fixed placeholder instead of removing them, keeping the tool call visible.

- **Gates.** Prune adds new entries only when both of these hold: context usage is inside the band from `PRUNE_CONTEXT_MIN` (25%) to `COMPACT_CONTEXT_RATIO` (65%) of the window, and more than `PRUNE_IDLE_MS` (10 minutes) have passed since the newest **assistant** message. The idle reference is the newest assistant message, not the newest message of any role, so a fresh user message cannot mask the idle window.
- **Eligibility.** A result is a candidate only when it is outside the last `PRUNE_RECENT_WINDOW` (50) messages, not pinned, not errored (error purge owns those), has at least `PRUNE_MIN_CONTENT_CHARS` (500) characters of text content, is not already pruned, is not a result of the `subagent` tool, and is not a skill load (a `read` or `grep` call whose arguments include a string ending in `SKILL.md`).
- **Transform.** Only the result content is replaced with the fixed placeholder:

  ```text
  [pruned, re-run the tool if you need this result again]
  ```

  The tool call stays visible.
- **One pass.** All currently eligible results are pruned in a single pass.
- **Sticky.** A pruned result is persisted once and the placeholder is reapplied on every subsequent context pass, even when the gates no longer pass. Without this persistence the projection would rebuild from the untouched transcript and the pruned result would reappear in full on the first active turn.

Prune never touches `bashExecution` messages (the user `!` command output).

### Compaction escalation

When context usage is already above `COMPACT_CONTEXT_RATIO` (65%) of the window and the provider prefix cache is lost, the extension triggers a selective compaction instead of pruning.

- **Trigger.** On `before_agent_start`, if context usage is above `COMPACT_CONTEXT_RATIO` and more than `PRUNE_IDLE_MS` (10 minutes) have passed since the newest **assistant** message, `ctx.compact()` fires once. The selective compaction flow runs through the existing `session_before_compact` hook.
- **No loops.** A disarm flag prevents a second compaction until context usage drops back to or below `COMPACT_CONTEXT_RATIO`, so a compaction that does not reduce enough never re-triggers immediately.
- **Division of labor.** Prune handles the band from `PRUNE_CONTEXT_MIN` (25%) to `COMPACT_CONTEXT_RATIO` (65%); compaction handles everything above it. Both share the same idle gate, so neither interrupts an actively running session.

## Persistence

The extension persists three kinds of custom session entries on the current branch, all append-only and all restored from the current branch on `session_start`:

| Key | Content | Restores |
|---|---|---|
| `selective-compact` | Per-fingerprint drop budgets (or an empty-budget tombstone) | The active compaction selection |
| `context-hygiene-pins` | The cumulative list of pinned `toolCallId`s | Pin state |
| `context-hygiene-pruned` | The cumulative list of pruned `toolCallId`s | Prune state |

Pins accumulate across writes: each pin writes the full running list. Custom entries do not participate in LLM context, so persisted state never leaks into prompts.

## The `/hygiene` command

Registers a single command with two subcommands:

- `status`: reports the pinned count, the pruned count, current context usage percent, minutes since the newest assistant message, and whether the prune gates currently pass (context band and idle individually).
- `prune`: forces one prune pass on the next context update, ignoring the gates. The force flag is consumed once.

## Subagent behavior

Subagents are not treated specially: prune and compaction escalation run the same in subagent processes as in the main session.

## Selective compaction

At compaction time one LLM pass chooses which existing messages to keep verbatim. All other messages are dropped from the provider-bound context. No re-interpretation, no summary.

- Builds a numbered manifest of every provider-visible message on the current branch: index, role, kind (text, tool call, tool result, reasoning, bash, summary, custom), preview (~160 chars, newlines and control characters stripped), approximate tokens (chars / 4), and tool call pairing info. The manifest comes from the compaction-aware provider projection, so it includes messages produced by `custom_message`, `compaction`, and `branch_summary` entries, not only plain `message` entries.
- Asks the active model to return a JSON list of manifest indices to keep, like `{"keep": [0, 3, 7]}`. The response must be a bare JSON object or a single fenced JSON block; surrounding prose is rejected.
- Keeps messages that carry durable context: user requirements and constraints, decisions and rationale, code references and diffs in progress, active errors and diagnostics, and the most recent user messages.
- Drops everything else: pleasantries, superseded drafts, redundant or stale tool outputs, resolved tangents.
- Enforces atomicity: a kept tool result pulls in the assistant message with its tool call, and vice versa. The final user message is always kept.
- Stores the pruning as per-fingerprint drop budgets, meaning how many occurrences of each fingerprint to drop, always the oldest occurrences in branch order, then filters it out of every provider-bound LLM context.
- Works for manual `/compact` and for automatic compaction (threshold and overflow triggers).

## How it works

The extension registers five hooks (`session_start`, `session_before_compact`, `before_agent_start`, `tool_call`, `context`) and one command (`/hygiene`). The built-in `/compact` triggers selective handling through the `session_before_compact` hook.

### session_before_compact

The built-in `/compact [instructions]` enters this hook, with optional free-text selection instructions passed via `event.customInstructions`, so manual and automatic compaction both run through this hook. It runs the selection flow and, on success, always returns a `compaction` result, never `{ cancel: true }`, because cancelling would make pi report an aborted operation. The compaction result carries a short static marker summary, the selector's provider usage, and selective stats in `details`, and makes pi write a real compaction entry without running its own summarizer.

The `firstKeptEntryId` of the written marker is chosen per trigger:

- Overflow recovery (`willRetry` true) reuses `event.preparation.firstKeptEntryId`, guaranteeing a contiguous kept tail so the interrupted turn can be retried. Messages older than that boundary are hidden by the projection, which is acceptable and stays bounded under overflow.
- Manual and threshold success (`willRetry` false) re-resolve the boundary so the entire current compaction-aware provider-visible history is preserved before the new marker. A pure helper resolves the boundary from `event.branchEntries`:
  - With no prior compaction on the branch, the boundary is the first branch entry id, so nothing currently visible is hidden.
  - With a latest prior compaction whose `firstKeptEntryId` is still present in the branch before it, that valid boundary is reused, keeping the retained tail and never resurrecting history hidden by an earlier overflow compaction.
  - If that prior boundary is missing or invalid, the latest prior compaction entry id is used, matching the context currently visible from that marker onward.

In all cases `tokensBefore` is `event.preparation.tokensBefore` (pi's preparation estimate), not the selector's chars/4 estimate.

On failure, which covers no active model, selection LLM errors, aborts, and unparseable responses, the hook returns nothing so the built-in compaction runs and writes its own entry. The current in-memory state is cleared and an empty-budget tombstone is appended so an older persisted selection is never restored after reload.

### tool_call

Each real tool call (excluding `context_pin` itself) is observed and its `toolCallId` recorded in an in-memory ordered list, newest last. The pin tool uses this list to find the most recent calls to pin.

### context

Fires before each LLM call. Returns `{ messages }` after running the pipeline in order: drop-budget filter, then dedup + error purge, then prune. Without an active selection the drop-budget filter passes messages through unchanged, and the other stages still run.

### session_start

Resets the in-memory selection, pins, and pruned state to none, then restores all three from the current branch (`ctx.sessionManager.getBranch()`, not all session entries). Among the persistence entries on that branch, the latest one in branch order wins, with equal timestamps resolved by branch order, the same rule the compaction selection already used. A valid selection entry with non-empty budgets restores an active compaction; the latest entry with an empty budget object (a tombstone) restores as no active state, so an earlier persisted selection is not resurrected. Non-persistence entries are ignored.

## Fallback to built-in compaction

The selective flow aborts safely and the built-in compaction proceeds when any of these happen:

- No active model.
- The selection LLM call fails, is aborted, or returns an error.
- The response cannot be parsed as strict JSON or the keep list is empty or invalid.

For both manual and automatic compaction the hook returns nothing, so pi's own compaction runs. Under overflow it also writes the entry that enables the retry. The retry loop stays bounded by pi's built-in single-recovery guard. Each failure clears state and writes an empty-budget tombstone, so a crash or reload after a failed selection cannot bring back an older selection.

## Selective-compaction persistence

After each successful selection the extension appends a custom session entry (type `selective-compact`) with the drop budgets, a fingerprint to count map, plus a timestamp. The latest persistence entry on the current branch, by branch order, wins on reload. A failed selection appends an empty-budget tombstone so an older persisted selection is not restored after reload; an empty latest budget restores as no active state.

Each successful run also writes a JSON-serializable `details` object on the compaction entry containing selective stats only (kept count, dropped count, and approximate before/after tokens) never message content or fingerprints. The selector's LLM usage is returned as the compaction `usage`, so pi accounts for the nested model call.

The conversation messages in the session JSONL are never rewritten. The extension only appends its own custom state entries to the JSONL, and custom entries do not participate in LLM context, so the persisted state never leaks into prompts.

## Limitations

- The conversation history in the session JSONL is never modified. Every hygiene transform is a context projection only: `/tree`, the transcript, and message history stay fully intact.
- Immediate dedup and error purge bust the provider prefix cache by design when they trigger. This is accepted; both fire on small, localized spans, and prune is idle-gated so it only runs when the cache is already lost.
- The prune placeholder trusts the model's judgment about whether re-running a shell tool is safe. The phrase is short and uniform by design.
- Prune does not touch `bashExecution` messages (user `!` command output).
- Pins never expire; a pinned tool call protects its result until the session ends or the pin list is replaced.
- The selection state lives in memory and is rehydrated from the persisted entry on session start. Without a persisted entry with budgets, pruning is lost on reload; a tombstone deliberately restores nothing.
- Fingerprints are content hashes, so identical content shares one fingerprint and drop budgets apply to the oldest occurrences. A new message identical to an older dropped one is kept unless its fingerprint still has remaining budget. If pi transforms a message for the provider in a way that changes its serialized content, the fingerprint no longer matches and the message is kept. This is the safe direction: unknown messages are never dropped.
- Under overflow the compaction marker hides messages older than `firstKeptEntryId`, and budgets apply to the visible tail. This is acceptable under overflow and remains bounded.
- The extension needs the active model to be available for selective compaction, so it cannot run compaction in sessions without a model. The hygiene features themselves do not need a model.

## Requirements

- Extension API from `@earendil-works/pi-coding-agent` and `@earendil-works/pi-agent-core`.
- markdownlint must pass on this file.
