import { describe, it } from "node:test"
import assert from "node:assert"
import { createHash } from "node:crypto"
import { computeSourceEventId } from "../id.js"

function expectedSourceEventId(
  sessionID: string,
  messageID: string,
  partID: string,
): string {
  const raw = `opencode:v1\x00${sessionID}\x00${messageID}\x00${partID}`
  return createHash("sha256").update(raw).digest("hex").toLowerCase()
}

describe("computeSourceEventId", () => {
  it("produces a deterministic lowercase hex sha256", () => {
    const id = computeSourceEventId("sess1", "msg1", "part1")
    assert.strictEqual(typeof id, "string")
    assert.strictEqual(id.length, 64)
    assert.ok(/^[0-9a-f]{64}$/.test(id))
  })

  it("matches independently computed SHA-256", () => {
    const id = computeSourceEventId("sess1", "msg1", "part1")
    const expected = expectedSourceEventId("sess1", "msg1", "part1")
    assert.strictEqual(id, expected)
  })

  it("produces fixed expected value for known input", () => {
    const id = computeSourceEventId(
      "test-session-id",
      "test-message-id",
      "test-part-id",
    )
    const expected = expectedSourceEventId(
      "test-session-id",
      "test-message-id",
      "test-part-id",
    )
    assert.strictEqual(id, expected)
    assert.strictEqual(
      id,
      "c4c6724e28ddab142ca3740bb9122c65a7a713ca10e6d2edc5834921531b968c",
    )
  })

  it("produces different ids for different inputs", () => {
    const a = computeSourceEventId("sess1", "msg1", "part1")
    const b = computeSourceEventId("sess1", "msg1", "part2")
    assert.notStrictEqual(a, b)
  })

  it("is case-sensitive for session/message/part ids", () => {
    const a = computeSourceEventId("Sess1", "msg1", "part1")
    const b = computeSourceEventId("sess1", "msg1", "part1")
    assert.notStrictEqual(a, b)
  })
})
