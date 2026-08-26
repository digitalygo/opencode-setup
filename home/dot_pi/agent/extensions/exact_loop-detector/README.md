# Loop detector extension

Detects agent loops and interrupts them. Primary focus: a delegated subagent that keeps trying to invoke further subagents (which is blocked), caught by identical error output. Also detects repeated tool patterns that also repeat their output, repeated identical assistant messages, stuck reasoning, repeated file reads, and search spirals.

## Detection

- **subagent-cycle**: in a child subagent (`PI_SUBAGENT_CHILD=1`), `subagentNestingThreshold` consecutive blocked `subagent` attempts whose error output is identical.
- **message-repetition**: assistant text messages with high word-set similarity to the most recent meaningful message (`messageRepeatThreshold` messages matching).
- **reasoning-stagnation**: `reasoningStuckThreshold` consecutive turns with high thinking overlap.
- **tool-repetition**: a contiguous tool pattern of length 2 or 3 repeated `repeatPatternMinReps` times, where both the calls and their outputs are identical.
- **read-repetition**: the same file read 4 or more times across the window.
- **search-spiral**: the same search pattern used across 3+ paths, or 3 consecutive progressively longer patterns.

Each detector can be disabled with its `enable*` config flag.

## Escalation (warn then force-stop)

- First detection on a clean run: injects a steering message telling the agent it appears to be in a loop, to stop repeating the same approach, summarize its current state, and complete its session. Marks one consecutive detection and prunes the window.
- If detections recur on a later turn and `escalateAfter` (default 2) consecutive detections are reached: sends a final message noting the loop persisted, then calls `ctx.abort()` to force-stop the run.
- A turn with no detections resets the consecutive counter.

## Configuration

| Key | Default | Description |
| --- | --- | --- |
| `windowSize` | `10` | Turns analyzed in the sliding window |
| `reasoningStuckThreshold` | `4` | Consecutive similar-thinking turns to flag |
| `reasoningStuckThresholdSimilarity` | `0.85` | Jaccard similarity threshold for thinking |
| `repeatSequenceMinLength` | `6` | Minimum flattened tool-call sequence length |
| `repeatPatternMinReps` | `3` | Minimum repetitions of a tool pattern |
| `subagentNestingThreshold` | `3` | Consecutive identical blocked subagent attempts to flag |
| `messageRepeatThreshold` | `3` | Similar messages required to flag repetition |
| `messageRepeatSimilarity` | `0.85` | Jaccard similarity threshold for messages |
| `messageRepeatMinLength` | `80` | Minimum message length to consider |
| `escalateAfter` | `2` | Consecutive detections before force-stop |
| `enableReasoningDetection` | `true` | Enable reasoning-stagnation detector |
| `enableToolRepetitionDetection` | `true` | Enable tool-repetition detector |
| `enableReadRepetitionDetection` | `true` | Enable read-repetition detector |
| `enableSearchSpiralDetection` | `true` | Enable search-spiral detector |
| `enableSubagentCycleDetection` | `true` | Enable subagent-cycle detector |
| `enableMessageRepetitionDetection` | `true` | Enable message-repetition detector |

## Command

`/loop-detector` with no args prints the current config and window size.

With args, apply `key=value` pairs (space separated):

```text
/loop-detector windowSize=15 enableSubagentCycleDetection=false
```

Boolean keys accept any value other than `false`. Numeric keys are parsed as numbers. Unrecognized keys are ignored.

## Installation

Place the folder under `~/.pi/agent/extensions/` so pi auto-discovers it (each extension must live in its own subdirectory containing `index.ts`).

## License

MIT. This extension is derived from the `pi-deadloop` npm package.
