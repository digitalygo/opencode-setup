import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createOutputLoopGuard } from "../guard.js"

const repeatedText = "The same completed assistant result is repeated without any visible progress being made."

function userMessage(
  id = "user-1",
  sessionID = "session-1",
  parts: unknown[] = [{ id: `${id}-text`, sessionID, messageID: id, type: "text", text: "Do the task" }],
) {
  return {
    info: { id, sessionID, role: "user", time: { created: 1 } },
    parts,
  }
}

function repeatedMessages(sessionID = "session-1", userID = "user-1") {
  const assistants = ["One", "Two", "Three"].map((reasoning, index) => {
    const id = `${sessionID}-assistant-${index + 1}`
    return {
      info: {
        id,
        sessionID,
        role: "assistant",
        parentID: userID,
        providerID: "provider-a",
        modelID: "model-a",
        mode: "orchestrator",
        time: { created: 2, completed: 3 },
      },
      parts: [
        { id: `${id}-reasoning`, sessionID, messageID: id, type: "reasoning", text: reasoning },
        { id: `${id}-text`, sessionID, messageID: id, type: "text", text: repeatedText },
      ],
    }
  })
  return [userMessage(userID, sessionID), ...assistants]
}

describe("createOutputLoopGuard", () => {
  it("expires an unconsumed receipt", () => {
    let now = 0
    const guard = createOutputLoopGuard(() => now)
    assert.ok(guard.inspect(repeatedMessages()))

    now = 300_000
    assert.equal(guard.consume("session-1"), null)
  })

  it("does not let a no-loop inspection erase a receipt for the same user turn", () => {
    const guard = createOutputLoopGuard(() => 0)
    assert.ok(guard.inspect(repeatedMessages()))
    assert.equal(guard.inspect(repeatedMessages().slice(0, 3)), null)

    assert.ok(guard.consume("session-1"))
  })

  it("keeps the same session blocked across provider requests until expiry", () => {
    const guard = createOutputLoopGuard(() => 0)
    assert.ok(guard.inspect(repeatedMessages()))

    assert.ok(guard.consume("session-1"))
    assert.ok(guard.consume("session-1"))
  })

  it("clears a receipt when the chat hook observes a genuine new user turn", () => {
    const guard = createOutputLoopGuard(() => 0)
    assert.ok(guard.inspect(repeatedMessages()))
    guard.observeUserMessage("session-1", userMessage("user-2").parts)

    assert.equal(guard.consume("session-1"), null)
  })

  it("does not clear a receipt for synthetic, ignored, or compaction-only user messages", () => {
    const internalParts: Array<[string, unknown[]]> = [
      ["synthetic", [{ type: "text", text: "internal", synthetic: true }]],
      ["ignored", [{ type: "text", text: "internal", ignored: true }]],
      ["compaction", [{ type: "compaction", auto: true }]],
    ]

    for (const [kind, parts] of internalParts) {
      const guard = createOutputLoopGuard(() => 0)
      assert.ok(guard.inspect(repeatedMessages()))
      guard.observeUserMessage("session-1", parts)
      assert.ok(guard.consume("session-1"), kind)
    }
  })

  it("keeps state bounded and releases capacity on a genuine user message", () => {
    const guard = createOutputLoopGuard(() => 0)
    for (let index = 0; index < 256; index += 1) {
      assert.ok(guard.inspect(repeatedMessages(`session-${index}`, `user-${index}`)))
    }

    assert.ok(guard.inspect(repeatedMessages("session-256", "user-256")))
    assert.equal(guard.consume("session-256"), null)
    assert.ok(guard.consume("session-0"))
    assert.ok(guard.consume("session-1"))

    guard.observeUserMessage("session-0", userMessage("user-new", "session-0").parts)
    assert.equal(guard.consume("session-0"), null)
    assert.ok(guard.consume("session-1"))

    assert.ok(guard.inspect(repeatedMessages("session-256", "user-256")))
    assert.ok(guard.consume("session-256"))
  })
})
