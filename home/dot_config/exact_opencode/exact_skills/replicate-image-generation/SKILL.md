---
name: replicate-image-generation
description: Generate or edit images with Replicate via direct Bash HTTP calls. Use when you need raster image generation in PNG, JPEG, or WebP format.
---

# Replicate image generation

## What you do with this skill

- Generate or edit an image using `openai/gpt-image-2` on Replicate.
- Use a direct `curl` call to the Replicate HTTP API.
- Save the generated PNG, JPEG, or WebP image locally for immediate use.
- Use the token from `~/Documents/.secrets/replicate-key`.

## When to use

Use this skill when you need to generate or edit a raster image.

## Input schema

Required:

- `prompt` string: the image description or editing instruction.

Optional:

- `aspect_ratio` enum: `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, `9:16`, `auto`, `1024x1024`, `1536x1024`, `1024x1536`, `1536x1152`, `1152x1536`, `2048x2048`, `2048x1152`, `1152x2048`, `3840x2160`, `2160x3840` (default: `1:1`).
- `input_images` array of image URLs for editing or composition.
- `quality` enum: `low`, `medium`, `high`, `auto` (default: `auto`).
- `number_of_images` integer from `1` to `10` (default: `1`).
- `background` enum in Replicate's schema: `auto`, `transparent`, `opaque` (default: `auto`). Use only `auto` or `opaque` with GPT Image 2.
- `output_compression` integer from `0` to `100` (default: `90`). OpenAI applies it only to `jpeg` and `webp`; it has no effect on lossless PNG output.
- `output_format` enum: `png`, `jpeg`, `webp` (default: `webp`).
- `moderation` enum: `auto`, `low` (default: `auto`).
- `user_id` string for identifying an end user to OpenAI.
- `openai_api_key` secret string for direct OpenAI billing. Omit it when using Replicate billing.

Rules:

- Use `quality=high`, `output_format=png`, `output_compression=0`, and `moderation=low` unless the user requests different values.
- Allow `png`, `jpeg`, or `webp` output. Keep `output_compression=0` by default for JPEG and WebP; the value has no effect on lossless PNG output.
- Use at most one output unless the user explicitly asks for multiple images.
- Use PNG whenever transparency is requested so the downloaded file can be checked for an alpha channel.
- For a transparent background, keep `background` set to `auto` and explicitly request transparency in the prompt. Do not set `background` to `transparent`: that API option is exposed by Replicate's schema but is not supported reliably by GPT Image 2.
- When transparency is requested, append a concise instruction such as: `Isolated subject, transparent background, centered cutout, clean edges, PNG asset, no shadow, no environment.` Avoid mentioning a checkerboard in the generation prompt because the model may draw one.
- Treat prompt-only transparency as best effort. After downloading the PNG, verify that it contains an alpha channel. Do not report a white or baked-checkerboard RGB image as transparent.
- If true transparency is required and the PNG has no alpha channel, report the limitation and use a separately approved background-removal step or a model that supports transparent output.

## Output schema

- Type: array of strings.
- Item format: URI.
- Each item is a URL to a generated image.

## Direct Bash workflow

```bash
set -euo pipefail

REPLICATE_API_TOKEN="$(tr -d '\n' < "$HOME/Documents/.secrets/replicate-key")"
PROMPT="A photorealistic golden retriever playing in a sunny park"
ASPECT_RATIO="1:1"
QUALITY="high"
NUMBER_OF_IMAGES="1"
BACKGROUND="auto"
OUTPUT_COMPRESSION="0"
OUTPUT_FORMAT="png"
MODERATION="low"
TRANSPARENT_BACKGROUND="false"

if [ -z "$REPLICATE_API_TOKEN" ]; then
  echo "Missing Replicate token in ~/Documents/.secrets/replicate-key" >&2
  exit 1
fi

if [ "$TRANSPARENT_BACKGROUND" = "true" ]; then
  OUTPUT_FORMAT="png"
  PROMPT="$PROMPT. Isolated subject, transparent background, centered cutout, clean edges, PNG asset, no shadow, no environment."
fi

OUTPUT_FILE="output.${OUTPUT_FORMAT}"

REQUEST_BODY="$(python3 - <<'PY' "$PROMPT" "$ASPECT_RATIO" "$QUALITY" "$NUMBER_OF_IMAGES" "$BACKGROUND" "$OUTPUT_COMPRESSION" "$OUTPUT_FORMAT" "$MODERATION"
import json
import sys

prompt, aspect_ratio, quality, number_of_images, background, output_compression, output_format, moderation = sys.argv[1:]
print(json.dumps({
    "input": {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "quality": quality,
        "number_of_images": int(number_of_images),
        "background": background,
        "output_compression": int(output_compression),
        "output_format": output_format,
        "moderation": moderation,
    }
}))
PY
)"

RESPONSE="$(curl --silent --show-error https://api.replicate.com/v1/models/openai/gpt-image-2/predictions \
  --request POST \
  --header "Authorization: Bearer $REPLICATE_API_TOKEN" \
  --header "Content-Type: application/json" \
  --header "Prefer: wait=60" \
  --data "$REQUEST_BODY")"

OUTPUT_URL="$(python3 - <<'PY' "$RESPONSE"
import json
import sys

payload = json.loads(sys.argv[1])
if payload.get("error"):
    raise SystemExit(f"Replicate error: {payload['error']}")
output = payload.get("output")
if isinstance(output, list) and output:
    print(output[0])
else:
    raise SystemExit(f"Prediction did not return an image URL; status={payload.get('status')}")
PY
)"

curl --silent --show-error --location "$OUTPUT_URL" --output "$OUTPUT_FILE"

if [ "$TRANSPARENT_BACKGROUND" = "true" ]; then
  python3 - <<'PY' "$OUTPUT_FILE"
from pathlib import Path
import struct
import sys

data = Path(sys.argv[1]).read_bytes()
if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
    raise SystemExit("Downloaded output is not a valid PNG")

color_type = struct.unpack(">IIBBBBB", data[16:29])[3]
has_transparency_chunk = b"tRNS" in data
if color_type not in (4, 6) and not has_transparency_chunk:
    raise SystemExit("PNG has no alpha channel; the prompt-only transparency request was not satisfied")
PY
fi

echo "Image saved to $OUTPUT_FILE"
echo "Output URL: $OUTPUT_URL"
```

## Error handling

- `401 Unauthorized`: token missing or invalid. Check `~/Documents/.secrets/replicate-key`.
- `402 Payment Required`: billing or quota issue on the Replicate account.
- `422 Unprocessable Entity`: invalid input value or payload structure.
- Missing output URL with `starting` or `processing` status: the synchronous wait ended before generation completed. Poll the prediction URL or retry with a longer wait.
- Transparent-background request returns an RGB image: GPT Image 2 did not satisfy the best-effort prompt request. Do not describe the result as transparent; use a separately approved background-removal step or a model with native alpha support.

## References

- <https://replicate.com/openai/gpt-image-2/api>
- <https://replicate.com/openai/gpt-image-2/api/schema>
- <https://replicate.com/openai/gpt-image-2/api/api-reference>
- <https://replicate.com/openai/gpt-image-2/readme>
- <https://replicate.com/docs>
