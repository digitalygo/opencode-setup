# Godot capture workflow

## Purpose

Produce deterministic screenshots, frame sequences, or gameplay video from a running Godot project without suppressing engine failures.

Follow the version policy in `../SKILL.md`.

## When to use this

- Visible changes need screenshot evidence.
- Motion, animation, physics, transitions, or timing need frame-sequence review.
- The requester needs a presentation video.

Do not require capture for a nonvisual change when automated and runtime checks prove the acceptance criteria.

## Capture principles

- Use the project's configured renderer first.
- Do not force Forward+, Vulkan, Compatibility, or another renderer unless diagnosing a verified renderer problem.
- Keep stderr and the real process exit status.
- Treat parser errors, import errors, crashes, resource leaks, blank frames, and nonzero exits as evidence to investigate.
- Use a fresh, scoped output directory and never delete an ambiguous path.
- Keep captures outside runtime assets and add an empty `.gdignore` when the output lives inside the project.
- Use software rendering for functional visual evidence when necessary, but not as target-hardware performance evidence.

## Environment preflight

1. Resolve the Godot editor binary and run `--version`.
2. Confirm the project imports successfully.
3. Identify the project's renderer and target resolution.
4. Check display availability and whether `xvfb-run`, `Xvfb`, and the `xauth` dependency required by `xvfb-run` are available on headless Linux.
5. Check for an available process timeout mechanism.
6. Check `ffmpeg` only when video conversion is required.

## Display strategy

- With a working display server, run the project normally.
- On Linux without `DISPLAY` or `WAYLAND_DISPLAY`, use `xvfb-run` only after a smoke test proves the wrapper and `xauth` dependency work.
- If `xvfb-run` is incomplete but `Xvfb` is available, start a private X server through the host's process manager, set `DISPLAY` only for the capture process, and terminate the server afterward.
- Use Godot's `--headless` mode for nonvisual checks.
- Do not combine `--headless` and `--write-movie` unless that exact engine and renderer path has been proven. A dummy renderer can produce blank output or crash instead of capturing frames.
- If the configured renderer cannot capture in the environment, report the limitation and try a documented, project-compatible fallback without changing committed project settings.

## Screenshot and frame-sequence contract

Use a test or presentation script that extends a command-line-compatible Godot main loop and produces deterministic state.

Linux example with a display:

```bash
mkdir -p screenshots/task_name
touch screenshots/.gdignore
timeout 30s godot --path . \
  --write-movie screenshots/task_name/frame.png \
  --fixed-fps 10 \
  --quit-after 50 \
  --script test/test_task.gd
```

Linux example without a display:

```bash
mkdir -p screenshots/task_name
touch screenshots/.gdignore
timeout 30s xvfb-run -a godot --path . \
  --write-movie screenshots/task_name/frame.png \
  --fixed-fps 10 \
  --quit-after 50 \
  --script test/test_task.gd
```

Adapt `timeout` and the display wrapper to the host. Do not create an unverified custom timeout implementation merely to copy these examples.

Godot expands a PNG movie path into numbered frames and may create a companion audio file.

## Video contract

Capture video only when requested or when it is the most efficient evidence for dynamic acceptance criteria.

```bash
mkdir -p screenshots/presentation
touch screenshots/.gdignore
timeout 60s godot --path . \
  --write-movie screenshots/presentation/output.avi \
  --fixed-fps 30 \
  --quit-after 900 \
  --script test/presentation.gd
```

When `ffmpeg` is available and MP4 is needed:

```bash
ffmpeg -i screenshots/presentation/output.avi \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -crf 28 \
  -preset slow \
  -vf "scale='min(1280,iw)':-2" \
  -movflags +faststart \
  screenshots/presentation/gameplay.mp4
```

Choose duration, frame rate, resolution, and codec from the evidence requirement rather than treating 30 seconds as mandatory.

## Frame-rate guidance

- Static composition: one or a few settled frames.
- Short transitions: enough fixed-FPS frames to include pre-state, transition, and post-state.
- Physics and animation: use a cadence high enough to reveal jitter, clipping, and timing defects.
- Presentation video: use the project's intended playback rate when practical.

A low-rate sampled contact sheet can help review a long sequence, but preserve the full source sequence for timing claims.

## Verification

- Check the capture command's real exit status.
- Read unfiltered stderr and engine logs.
- Confirm files are nonempty and dimensions match expectations.
- Inspect first, middle, transition, and final frames.
- Confirm the capture script did not override the behavior being tested.
- Treat black, blank, frozen, incomplete, or obviously incorrect frames as capture failure.
- Do not infer runtime performance from fixed-FPS movie writing.

## Boundaries

- This workflow does not define gameplay acceptance criteria.
- This workflow does not perform the independent visual verdict.
- Use `godot-visual-qa.md` after capture when visual correctness is in scope.
