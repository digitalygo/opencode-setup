# Godot capture skill

## Purpose

Produce deterministic screenshots and gameplay video from a running Godot 4.6 project in headless or remote environments so executor and visual QA can verify real output.

## Use this when

- A task needs screenshot proof.
- Dynamic systems need frame-sequence review.
- Final presentation video is required.

## Setup goals

- Prefer hardware rendering when available.
- Support headless Linux with `xvfb-run`.
- Keep one reusable wrapper script for all captures.

## Setup workflow

Create `.capture/run_godot` plus `.capture/env` once per session.

Make wrapper handle this:

- Detect whether a display server exists.
- Use `xvfb-run` on headless Linux if needed.
- Prefer `--rendering-method forward_plus` on hardware-capable systems.
- Filter known harmless RID leak noise from stderr.

Persist environment values:

- `GPU_AVAILABLE=true|false`
- `TIMEOUT_CMD=timeout|gtimeout|custom wrapper`

Concrete setup example:

```bash
set -e
mkdir -p .capture
touch .capture/.gdignore

PLATFORM=$(uname -s)
GPU_KIND=software

if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_CMD=timeout
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_CMD=gtimeout
else
  cat > .capture/ptimeout <<'PERL'
#!/usr/bin/env perl
use POSIX; my $s=shift; my $p; $SIG{ALRM}=sub{kill 'TERM',$p;exit 124};
alarm $s; die "fork: $!" unless defined($p=fork); exec @ARGV unless $p; waitpid $p,0; exit($?>>8);
PERL
  chmod +x .capture/ptimeout
  TIMEOUT_CMD="$(pwd)/.capture/ptimeout"
fi

if [[ "$PLATFORM" == "Darwin" ]]; then
  GPU_KIND=hardware
elif command -v vulkaninfo >/dev/null 2>&1; then
  if vulkaninfo --summary 2>&1 | grep -Eq "deviceType *= PHYSICAL_DEVICE_TYPE_(DISCRETE_GPU|INTEGRATED_GPU|VIRTUAL_GPU)"; then
    GPU_KIND=hardware
  fi
fi

cat > .capture/run_godot <<'WRAPPER'
#!/usr/bin/env bash
set -o pipefail
NOISE="leaked RID|Leaked instance|ObjectDB instances"
cmd=()

if [[ "$(uname -s)" != "Darwin" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  cmd+=(xvfb-run -a -s '-screen 0 1920x1080x24')
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  cmd+=(godot --path . --rendering-method forward_plus)
elif command -v vulkaninfo >/dev/null 2>&1 && vulkaninfo --summary 2>&1 | grep -Eq "deviceType *= PHYSICAL_DEVICE_TYPE_(DISCRETE_GPU|INTEGRATED_GPU|VIRTUAL_GPU)"; then
  cmd+=(godot --path . --rendering-method forward_plus)
else
  cmd+=(godot --path . --rendering-driver vulkan)
fi

"${cmd[@]}" "$@" 2>&1 | { grep -v "$NOISE" || true; }
WRAPPER
chmod +x .capture/run_godot

cat > .capture/env <<ENV
GPU_AVAILABLE=$([[ "$GPU_KIND" == "hardware" ]] && echo true || echo false)
TIMEOUT_CMD=$TIMEOUT_CMD
ENV
```

## Screenshot capture contract

```bash
source .capture/env

MOVIE=screenshots/task_name
rm -rf "$MOVIE" && mkdir -p "$MOVIE"
touch screenshots/.gdignore
$TIMEOUT_CMD 30 .capture/run_godot \
  --write-movie "$MOVIE"/frame.png \
  --fixed-fps 10 --quit-after 50 \
  --script test/test_task.gd
```

Godot expands `frame.png` into numbered PNG frames plus a `frame.wav` companion file.

## Video capture contract

Only run full video capture when `GPU_AVAILABLE=true`.

```bash
source .capture/env

VIDEO=screenshots/presentation
rm -rf "$VIDEO" && mkdir -p "$VIDEO"
touch screenshots/.gdignore
$TIMEOUT_CMD 60 .capture/run_godot \
  --write-movie "$VIDEO"/output.avi \
  --fixed-fps 30 --quit-after 900 \
  --script test/presentation.gd

ffmpeg -i "$VIDEO"/output.avi \
  -c:v libx264 -pix_fmt yuv420p -crf 28 -preset slow \
  -vf "scale='min(1280,iw)':-2" \
  -movflags +faststart \
  "$VIDEO"/gameplay.mp4
```

## Frame rates

- Static scenes: `--fixed-fps 1`.
- Dynamic gameplay: `--fixed-fps 10`.
- Presentation video: `--fixed-fps 30`.

Do not use very low FPS for physics validation. Physics becomes misleading.

## Hard rules

- Always create `screenshots/.gdignore`.
- Use frame sequences for motion bugs, not one screenshot.
- If `GPU_AVAILABLE=false`, skip final video and report limitation explicitly.
- Position camera before frame 0 when using `--write-movie`.
- Treat blank, black, or obviously wrong frames as capture failure, not game success.

## Common failure modes

- Black frames -> wrong renderer or display setup.
- Junk first frame -> camera only set in `_process()` instead of `_initialize()`.
- Missing frames -> wrong `--quit-after` or capture script exited early.
- Dynamic bug invisible -> capture window too short or FPS too low.

## Boundaries

- You do not use this file to decide gameplay verification criteria.
- You do not use this file to perform image critique itself.
- You use this file with executor and visual QA; it does not replace them.
