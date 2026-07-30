import { createHash } from "node:crypto"

export function computeSourceEventId(
  sessionID: string,
  messageID: string,
  partID: string,
): string {
  const raw = `opencode:v1\x00${sessionID}\x00${messageID}\x00${partID}`
  return createHash("sha256").update(raw).digest("hex").toLowerCase()
}
