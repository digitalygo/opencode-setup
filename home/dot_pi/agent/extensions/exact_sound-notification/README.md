# Sound notification extension for pi

Plays an audio cue when an interactive TUI agent run fully settles, so you can step away and notice completion. `done.wav` signals a successful outcome; `error.wav` signals a final assistant error. The sound only fires once per settled run, only in the interactive TUI, and is silent in every other case.

## What it does

- Plays `done.wav` when a run reaches a successful, non-error final outcome in the interactive TUI.
- Plays `error.wav` when a run ends in a final assistant error after all built-in Pi retries are exhausted.
- Keeps intermediate retry failures silent. A sound is only emitted once the run has fully settled, never mid-retry.
- Keeps aborted runs, unknown outcomes, and any non-TUI mode silent, including background, non-interactive, and headless runs.

## How it works

The extension tracks the lifecycle of an interactive TUI agent run and waits for it to fully settle before deciding on a sound. Settling means the run has reached a terminal state: the model produced a final result or gave up after retries. Only then does it pick a cue.

The chosen cue depends on the settled outcome:

- Successful and other non-error finals play `done.wav`.
- Final assistant errors, raised only after all Pi retries are spent, play `error.wav`.
- Aborted and unknown outcomes play nothing.

## Sound assets

The extension bundles its own sound assets under the extension folder's `sounds/` subdirectory. They are resolved from the extension's own location, so no external config folder is read.

```text
home/dot_pi/agent/extensions/exact_sound-notification/sounds/
```

Two files are required:

| File | Purpose |
|------|---------|
| `done.wav` | Successful or non-error final outcome |
| `error.wav` | Final assistant error after all retries |

The sounds are bundled with the extension in `home/dot_pi/agent/extensions/exact_sound-notification/sounds/`. `permission.wav` is also bundled for completeness but is not played by the extension. If an asset is missing, no sound plays and the failure is silent.

## Playback

The cue is played through the first available player in this fallback order:

1. `pw-play` (PipeWire)
2. `paplay` (PulseAudio)
3. `canberra-gtk-play` (libcanberra)
4. `aplay` (ALSA)
5. `afplay` (macOS)

The audio player is resolved at playback time, so installing a player does not require a restart. If none of the players is installed, playback is skipped silently.

Playback behavior:

- Playback is nonblocking, so it never delays the agent loop.
- A new sound cancels any overlap still playing, so consecutive cues never stack.
- Missing players, missing assets, and playback failures are all silent and never surface as errors.

## Loading the extension

`/reload` picks the extension up if it was not present at startup. A plain restart also loads it. After either, the extension is active for the current session.

## Limitations

- The sound only fires in the interactive TUI. Non-TUI, background, and headless modes are always silent.
- A sound is emitted only when a run fully settles. Interrupted, aborted, and unresolved runs stay silent by design.
- Playback depends on at least one supported player and on the asset being present. Absence of either is ignored silently.
