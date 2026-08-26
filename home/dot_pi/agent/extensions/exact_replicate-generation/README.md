# Replicate generation extension for pi

Registers two global tools:

- `replicate_image_generation`: raster generation/editing with `openai/gpt-image-2`
- `replicate_svg_generation`: vector generation with `recraft-ai/recraft-v4-svg`

Both tools use Replicate's HTTP API directly from TypeScript, poll asynchronous predictions when necessary, download and validate generated files, and write them atomically.

## Configuration

The Replicate token is read from:

```text
~/Documents/.secrets/replicate-key
```

The file must contain only the token and have permissions `600`:

```bash
chmod 600 ~/Documents/.secrets/replicate-key
```

Set `REPLICATE_API_KEY_FILE` to use another token file. The token is never included in tool results, request bodies, or command-line arguments.

Run `/replicate` to check configuration.

## Raster images

`replicate_image_generation` supports PNG, JPEG, and WebP output, 1-10 images, image URL inputs, quality and moderation options, and optional end-user attribution.

Defaults follow the source skill's recommended settings:

- quality: `high`
- output format: `png`
- compression: `0`
- moderation: `low`
- number of images: `1`

Set `transparent_background=true` for a best-effort transparent PNG. The extension forces PNG, adds a cutout instruction, and checks the downloaded PNG for an alpha channel. It reports a warning rather than falsely claiming transparency when alpha is absent.

## SVG images

`replicate_svg_generation` supports either an aspect ratio or explicit dimensions. `size` is accepted only when `aspect_ratio` is `Not set`.

## Local output

Both tools accept an optional `output_path`. Without it, they create a unique filename in pi's current working directory. Existing regular files are replaced atomically; symlink outputs are rejected. Generated files use mode `600`.

The tools also return Replicate's output URLs, which may expire. Keep the downloaded local files for durable use.

## Privacy and billing

Replicate generation is billed. Prompts, source image URLs, and optional user IDs are sent to Replicate and the underlying model provider. Use these tools only when explicitly requested.

Source skills:

```text
/home/luca/Documents/github-digitalygo/dotfiles/home/dot_config/exact_opencode/exact_skills/replicate-image-generation/SKILL.md
/home/luca/Documents/github-digitalygo/dotfiles/home/dot_config/exact_opencode/exact_skills/replicate-svg-generation/SKILL.md
```
