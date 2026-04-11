---
name: replicate-svg-generation
description: Generate SVG images with Replicate via direct Bash HTTP calls. Use when you need vector image generation.
---

# Replicate SVG vector image generation

## what you do with this skill

- generate a `.svg` image using `recraft-ai/recraft-v4-svg` on Replicate
- use a direct `curl` call to Replicate HTTP API
- save the SVG locally for immediate usage
- use token from `~/.config/opencode/.secrets/replicate-key`

## When to use

Use this skill when you need to generate an SVG vector image.

## Input schema

Required:

- `prompt` (string) - The text description of the image to generate. Always required.

Optional:

- `aspect_ratio` enum: `Not set`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `16:9`, `9:16`, `1:2`, `2:1`, `14:10`, `10:14`, `4:5`, `5:4`, `6:10`
- `size` enum: `1024x1024`, `1536x768`, `768x1536`, `1280x832`, `832x1280`, `1216x896`, `896x1216`, `1152x896`, `896x1152`, `832x1344`, `1280x896`, `896x1280`, `1344x768`, `768x1344`

Rules:

- `prompt` is always required.
- If `aspect_ratio` is different from `Not set`, do not send `size`.
- If `aspect_ratio` is `Not set`, you may send `size`.

## Output schema

- Type: `string`
- Format: `uri`
- The output is a URL to the generated `.svg`.

## Direct bash workflow (HTTP API)

```bash
set -euo pipefail

REPLICATE_API_TOKEN="$(tr -d '\n' < "$HOME/.config/opencode/.secrets/replicate-key")"
PROMPT="Retro 1970s style poster with the text 'Recraft V4' in bold groovy typography with rainbow gradient colors"
ASPECT_RATIO="1:1"
SIZE="1024x1024"
OUTPUT_FILE="output.svg"

if [ -z "$REPLICATE_API_TOKEN" ]; then
  echo "Missing Replicate token in ~/.config/opencode/.secrets/replicate-key" >&2
  exit 1
fi

if [ "$ASPECT_RATIO" = "Not set" ]; then
  REQUEST_BODY="$(python3 - <<'PY' "$PROMPT" "$SIZE"
import json, sys
prompt, size = sys.argv[1], sys.argv[2]
print(json.dumps({"input": {"prompt": prompt, "size": size}}))
PY
)"
else
  REQUEST_BODY="$(python3 - <<'PY' "$PROMPT" "$ASPECT_RATIO"
import json, sys
prompt, aspect_ratio = sys.argv[1], sys.argv[2]
print(json.dumps({"input": {"prompt": prompt, "aspect_ratio": aspect_ratio}}))
PY
)"
fi

RESPONSE="$(curl --silent --show-error https://api.replicate.com/v1/models/recraft-ai/recraft-v4-svg/predictions \
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
echo "SVG saved to $OUTPUT_FILE"
echo "Output URL: $OUTPUT_URL"
```

## Error handling

- `401 Unauthorized`: token missing or invalid. Check `~/.config/opencode/.secrets/replicate-key`.
- `402 Payment Required`: billing or quota issue on Replicate account.
- `422 Unprocessable Entity`: invalid `aspect_ratio`, `size`, or payload structure.
- Empty output URL: request accepted but no usable output returned.

## References

- <https://replicate.com/recraft-ai/recraft-v4-svg/api>
- <https://replicate.com/recraft-ai/recraft-v4-svg/api/schema>
- <https://replicate.com/recraft-ai/recraft-v4-svg/api/api-reference>
- <https://replicate.com/docs>
