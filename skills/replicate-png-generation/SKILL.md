---
name: replicate-png-generation
description: Generate PNG images with Replicate via direct Bash HTTP calls. Use when you need PNG image generation.
---

# Replicate PNG image generation

## what you do with this skill

- generate a `.png` image using `google/nano-banana-2` on Replicate
- use a direct `curl` call to Replicate HTTP API
- save the PNG locally for immediate usage
- use token from `~/.config/opencode/.secrets/replicate-key`

## When to use

Use this skill when you need to generate a PNG image.

## Input schema

Required:

- `prompt` (string) - The text description of the image to generate. Always required.
- `aspect_ratio` enum: `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`

Optional:

- `google_search` boolean (default: `false`)
- `image_search` boolean (default: `false`)
- `output_format` enum: `jpg`, `png` (default: `jpg`)

Rules:

- `prompt` is always required.
- `aspect_ratio` is always required.
- `output_format` use `png` to obtain a PNG image.

## Output schema

- Type: `string`
- Format: `uri`
- The output is a URL to the generated `.png` file (when `output_format=png`).

## Direct bash workflow (HTTP API)

```bash
set -euo pipefail

REPLICATE_API_TOKEN="$(tr -d '\n' < "$HOME/.config/opencode/.secrets/replicate-key")"
PROMPT="A photorealistic golden retriever playing in a sunny park"
ASPECT_RATIO="1:1"
GOOGLE_SEARCH="false"
IMAGE_SEARCH="false"
OUTPUT_FORMAT="png"
OUTPUT_FILE="output.png"

if [ -z "$REPLICATE_API_TOKEN" ]; then
  echo "Missing Replicate token in ~/.config/opencode/.secrets/replicate-key" >&2
  exit 1
fi

REQUEST_BODY="$(python3 - <<'PY' "$PROMPT" "$ASPECT_RATIO" "$GOOGLE_SEARCH" "$IMAGE_SEARCH" "$OUTPUT_FORMAT"
import json, sys
prompt, aspect_ratio, google_search, image_search, output_format = sys.argv[1:7]
print(json.dumps({
  "version": "71516450bdbeafc41df33ad538bc8cc6a90f80038a563b1260531c02d694f4fd",
  "input": {
    "prompt": prompt,
    "aspect_ratio": aspect_ratio,
    "google_search": google_search.lower() == "true",
    "image_search": image_search.lower() == "true",
    "output_format": output_format
  }
}))
PY
)"

RESPONSE="$(curl --silent --show-error https://api.replicate.com/v1/models/google/nano-banana-2/predictions \
  --request POST \
  --header "Authorization: Bearer $REPLICATE_API_TOKEN" \
  --header "Content-Type: application/json" \
  --header "Prefer: wait" \
  --data "$REQUEST_BODY")"

OUTPUT_URL="$(python3 - <<'PY' "$RESPONSE"
import json, sys
payload = json.loads(sys.argv[1])
output = payload.get("output")
if isinstance(output, str):
    print(output)
elif isinstance(output, list) and output:
    print(output[0])
else:
    raise SystemExit("No output URL found in Replicate response")
PY
)"

curl --silent --show-error --location "$OUTPUT_URL" --output "$OUTPUT_FILE"
echo "PNG saved to $OUTPUT_FILE"
echo "Output URL: $OUTPUT_URL"
```

## Error handling

- `401 Unauthorized`: token missing or invalid. Check `~/.config/opencode/.secrets/replicate-key`.
- `402 Payment Required`: billing or quota issue on Replicate account.
- `422 Unprocessable Entity`: invalid `aspect_ratio` or payload structure.
- Empty output URL: request accepted but no usable output returned.

## References

- <https://replicate.com/google/nano-banana-2/api>
- <https://replicate.com/google/nano-banana-2/api/schema>
- <https://replicate.com/google/nano-banana-2/api/api-reference>
- <https://replicate.com/docs>
