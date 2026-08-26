import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { findOutputLoop } from "../detector.js"

const repeatedText = "The same completed assistant result is repeated without any visible progress being made."

type AssistantOptions = {
  text?: string
  providerID?: string
  modelID?: string
  mode?: string
  extraParts?: unknown[]
  sessionID?: string
  parentID?: string
}

function userMessage(id = "user-1", sessionID = "session-1") {
  return {
    info: {
      id,
      sessionID,
      role: "user",
      time: { created: 1 },
    },
    parts: [{ id: `${id}-text`, sessionID, messageID: id, type: "text", text: "Do the task" }],
  }
}

function assistantMessage(id: string, reasoning: string, options: AssistantOptions = {}) {
  const sessionID = options.sessionID ?? "session-1"
  return {
    info: {
      id,
      sessionID,
      role: "assistant",
      parentID: options.parentID ?? "user-1",
      providerID: options.providerID ?? "provider-a",
      modelID: options.modelID ?? "model-a",
      mode: options.mode ?? "orchestrator",
      time: { created: 2, completed: 3 },
    },
    parts: [
      { id: `${id}-reasoning`, sessionID, messageID: id, type: "reasoning", text: reasoning },
      { id: `${id}-text`, sessionID, messageID: id, type: "text", text: options.text ?? repeatedText },
      ...(options.extraParts ?? []),
    ],
  }
}

function assistantWithoutText(id: string, reasoning: string, extraParts: unknown[]) {
  return {
    info: {
      id,
      sessionID: "session-1",
      role: "assistant",
      parentID: "user-1",
      providerID: "provider-a",
      modelID: "model-a",
      mode: "orchestrator",
      time: { created: 2, completed: 3 },
    },
    parts: [
      { id: `${id}-reasoning`, sessionID: "session-1", messageID: id, type: "reasoning", text: reasoning },
      ...extraParts,
    ],
  }
}

function repeatedMessages(options: AssistantOptions = {}) {
  return [
    userMessage(),
    assistantMessage("assistant-1", "First approach", options),
    assistantMessage("assistant-2", "Second approach", options),
    assistantMessage("assistant-3", "Third approach", options),
  ]
}

function toolPart(messageID: string, input: unknown, output: string, attachments?: unknown[]) {
  return {
    id: `${messageID}-tool`,
    sessionID: "session-1",
    messageID,
    type: "tool",
    callID: `${messageID}-call`,
    tool: "read_file",
    state: {
      status: "completed",
      input,
      output,
      title: "Read file",
      ...(attachments ? { attachments } : {}),
      time: { start: 10, end: 20 },
    },
  }
}

describe("findOutputLoop", () => {
  it("detects three identical visible results with different reasoning", () => {
    const receipt = findOutputLoop(repeatedMessages())

    assert.equal(receipt?.sessionID, "session-1")
    assert.equal(receipt?.userMessageID, "user-1")
    assert.equal(receipt?.repeatCount, 3)
    assert.match(receipt?.digest ?? "", /^[a-f0-9]{64}$/)
  })

  it("is model agnostic", () => {
    const kimi = findOutputLoop(repeatedMessages({ providerID: "openrouter", modelID: "moonshotai/kimi-k2" }))
    const claude = findOutputLoop(repeatedMessages({ providerID: "anthropic", modelID: "claude-sonnet" }))

    assert.equal(kimi?.modelID, "moonshotai/kimi-k2")
    assert.equal(claude?.modelID, "claude-sonnet")
  })

  it("requires three completed repeated results", () => {
    assert.equal(findOutputLoop(repeatedMessages().slice(0, 3)), null)
  })

  it("does not detect different visible output", () => {
    const messages = repeatedMessages()
    messages[3] = assistantMessage("assistant-3", "Third approach", { text: `${repeatedText} Changed.` })

    assert.equal(findOutputLoop(messages), null)
  })

  it("normalizes surrounding whitespace and line endings only", () => {
    const messages = [
      userMessage(),
      assistantMessage("assistant-1", "One", { text: `  ${repeatedText}\r\n` }),
      assistantMessage("assistant-2", "Two", { text: `${repeatedText}\n` }),
      assistantMessage("assistant-3", "Three", { text: `\n${repeatedText}  ` }),
    ]

    assert.equal(findOutputLoop(messages)?.repeatCount, 3)
  })

  it("detects repeated short output", () => {
    assert.equal(findOutputLoop(repeatedMessages({ text: "Done." }))?.repeatCount, 3)
  })

  it("detects repeated completed tool-only results", () => {
    const progress = (messageID: string, cost: number) => [
      { id: `${messageID}-start`, sessionID: "session-1", messageID, type: "step-start", snapshot: "same-start" },
      toolPart(messageID, { path: "same" }, "same output"),
      {
        id: `${messageID}-finish`,
        sessionID: "session-1",
        messageID,
        type: "step-finish",
        reason: "tool-calls",
        snapshot: "same-finish",
        cost,
        tokens: { input: cost, output: cost, reasoning: cost, cache: { read: 0, write: 0 } },
      },
    ]
    const messages = [
      userMessage(),
      assistantWithoutText("assistant-1", "One", progress("assistant-1", 1)),
      assistantWithoutText("assistant-2", "Two", progress("assistant-2", 2)),
      assistantWithoutText("assistant-3", "Three", progress("assistant-3", 3)),
    ]

    assert.equal(findOutputLoop(messages)?.repeatCount, 3)
  })

  it("resets at the latest user message", () => {
    const messages = [
      ...repeatedMessages(),
      userMessage("user-2"),
      assistantMessage("assistant-4", "New request", { parentID: "user-2" }),
    ]

    assert.equal(findOutputLoop(messages), null)
  })

  it("does not compare results from different models", () => {
    const messages = repeatedMessages()
    messages[2] = assistantMessage("assistant-2", "Second approach", { modelID: "model-b" })

    assert.equal(findOutputLoop(messages), null)
  })

  it("does not flag identical text when tool progress differs", () => {
    const messages = [
      userMessage(),
      assistantMessage("assistant-1", "One", { extraParts: [toolPart("assistant-1", { path: "a" }, "first")] }),
      assistantMessage("assistant-2", "Two", { extraParts: [toolPart("assistant-2", { path: "b" }, "second")] }),
      assistantMessage("assistant-3", "Three", { extraParts: [toolPart("assistant-3", { path: "c" }, "third")] }),
    ]

    assert.equal(findOutputLoop(messages), null)
  })

  it("detects identical text with identical tool progress", () => {
    const messages = [
      userMessage(),
      assistantMessage("assistant-1", "One", { extraParts: [toolPart("assistant-1", { path: "same" }, "same")] }),
      assistantMessage("assistant-2", "Two", { extraParts: [toolPart("assistant-2", { path: "same" }, "same")] }),
      assistantMessage("assistant-3", "Three", { extraParts: [toolPart("assistant-3", { path: "same" }, "same")] }),
    ]

    assert.equal(findOutputLoop(messages)?.repeatCount, 3)
  })

  it("detects identical tool attachments with fresh runtime IDs", () => {
    const attachment = (messageID: string) => ({
      id: `${messageID}-attachment`,
      sessionID: "session-1",
      messageID,
      type: "file",
      mime: "text/plain",
      filename: "result.txt",
      url: "data:text/plain;base64,c2FtZS1jb250ZW50",
    })
    const messages = [
      userMessage(),
      assistantMessage("assistant-1", "One", {
        extraParts: [toolPart("assistant-1", { path: "same" }, "same", [attachment("assistant-1")])],
      }),
      assistantMessage("assistant-2", "Two", {
        extraParts: [toolPart("assistant-2", { path: "same" }, "same", [attachment("assistant-2")])],
      }),
      assistantMessage("assistant-3", "Three", {
        extraParts: [toolPart("assistant-3", { path: "same" }, "same", [attachment("assistant-3")])],
      }),
    ]

    assert.equal(findOutputLoop(messages)?.repeatCount, 3)
  })

  it("does not flag identical text when attachment content differs", () => {
    const attachment = (messageID: string, content: string) => ({
      id: `${messageID}-attachment`,
      sessionID: "session-1",
      messageID,
      type: "file",
      mime: "text/plain",
      filename: "result.txt",
      url: `data:text/plain,${content}`,
    })
    const messages = [
      userMessage(),
      assistantMessage("assistant-1", "One", {
        extraParts: [toolPart("assistant-1", { path: "same" }, "same", [attachment("assistant-1", "one")])],
      }),
      assistantMessage("assistant-2", "Two", {
        extraParts: [toolPart("assistant-2", { path: "same" }, "same", [attachment("assistant-2", "two")])],
      }),
      assistantMessage("assistant-3", "Three", {
        extraParts: [toolPart("assistant-3", { path: "same" }, "same", [attachment("assistant-3", "three")])],
      }),
    ]

    assert.equal(findOutputLoop(messages), null)
  })

  it("does not flag identical text when runtime step snapshots differ", () => {
    const stepParts = (messageID: string, snapshot: string, cost: number) => [
      { id: `${messageID}-start`, sessionID: "session-1", messageID, type: "step-start", snapshot },
      {
        id: `${messageID}-finish`,
        sessionID: "session-1",
        messageID,
        type: "step-finish",
        reason: "tool-calls",
        snapshot,
        cost,
        tokens: { input: cost, output: cost, reasoning: cost, cache: { read: 0, write: 0 } },
      },
    ]
    const messages = [
      userMessage(),
      assistantMessage("assistant-1", "One", { extraParts: stepParts("assistant-1", "state-a", 1) }),
      assistantMessage("assistant-2", "Two", { extraParts: stepParts("assistant-2", "state-b", 2) }),
      assistantMessage("assistant-3", "Three", { extraParts: stepParts("assistant-3", "state-c", 3) }),
    ]

    assert.equal(findOutputLoop(messages), null)
  })

  it("ignores runtime step accounting when snapshots are identical", () => {
    const stepFinish = (messageID: string, cost: number) => ({
      id: `${messageID}-finish`,
      sessionID: "session-1",
      messageID,
      type: "step-finish",
      reason: "tool-calls",
      snapshot: "same-state",
      cost,
      tokens: { input: cost, output: cost, reasoning: cost, cache: { read: cost, write: cost } },
    })
    const messages = [
      userMessage(),
      assistantMessage("assistant-1", "One", { extraParts: [stepFinish("assistant-1", 1)] }),
      assistantMessage("assistant-2", "Two", { extraParts: [stepFinish("assistant-2", 2)] }),
      assistantMessage("assistant-3", "Three", { extraParts: [stepFinish("assistant-3", 3)] }),
    ]

    assert.equal(findOutputLoop(messages)?.repeatCount, 3)
  })

  it("detects output at the visible text size limit", () => {
    assert.equal(findOutputLoop(repeatedMessages({ text: "x".repeat(262_144) }))?.repeatCount, 3)
  })

  it("fails open above the visible text size limit", () => {
    assert.equal(findOutputLoop(repeatedMessages({ text: "x".repeat(262_145) })), null)
  })

  it("fails open when a result contains too many parts", () => {
    const extraParts = Array.from({ length: 1_024 }, (_, index) => ({
      type: "reasoning",
      text: `Reasoning ${index}`,
    }))

    assert.equal(findOutputLoop(repeatedMessages({ extraParts })), null)
  })

  it("fails open for unsupported progress parts", () => {
    const messages = repeatedMessages({ extraParts: [{ type: "future-progress-part", value: "changing" }] })

    assert.equal(findOutputLoop(messages), null)
  })

  it("fails open for malformed history", () => {
    assert.doesNotThrow(() => findOutputLoop([null, [], { info: null }, { info: { role: "assistant" } }]))
    assert.equal(findOutputLoop([null, [], { info: null }, { info: { role: "assistant" } }]), null)
  })
})
