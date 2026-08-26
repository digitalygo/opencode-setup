import assert from "node:assert/strict"
import { describe, it } from "node:test"
import plugin from "../../output-loop-guard.js"

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

function assistantMessage(id: string, reasoning: string, sessionID = "session-1", parentID = "user-1") {
  return {
    info: {
      id,
      sessionID,
      role: "assistant",
      parentID,
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
}

function repeatedMessages(sessionID = "session-1", userID = "user-1") {
  return [
    userMessage(userID, sessionID),
    assistantMessage("assistant-1", "One", sessionID, userID),
    assistantMessage("assistant-2", "Two", sessionID, userID),
    assistantMessage("assistant-3", "Three", sessionID, userID),
  ]
}

type LogMode = "resolve" | "reject" | "pending" | "throw"

async function createHarness(logMode: LogMode = "resolve") {
  const logCalls: unknown[] = []
  const client = {
    app: {
      log: (input: unknown) => {
        logCalls.push(input)
        if (logMode === "throw") throw new Error("log threw")
        if (logMode === "reject") return Promise.reject(new Error("log unavailable"))
        if (logMode === "pending") return new Promise<never>(() => {})
        return Promise.resolve({ data: true })
      },
    },
  }
  const hooks = await plugin({ client } as never)
  return { hooks, logCalls }
}

async function inspect(hooks: Awaited<ReturnType<typeof plugin>>, messages: unknown[]) {
  const transform = hooks["experimental.chat.messages.transform"]
  assert.ok(transform)
  await transform({}, { messages } as never)
}

async function observeUser(
  hooks: Awaited<ReturnType<typeof plugin>>,
  message: ReturnType<typeof userMessage>,
) {
  const chatMessage = hooks["chat.message"]
  assert.ok(chatMessage)
  await chatMessage(
    {
      sessionID: message.info.sessionID,
      agent: "orchestrator",
      model: { providerID: "provider-a", modelID: "model-a" },
      messageID: message.info.id,
    },
    { message: message.info, parts: message.parts } as never,
  )
}

async function request(hooks: Awaited<ReturnType<typeof plugin>>, sessionID: string, userID: string) {
  const params = hooks["chat.params"]
  assert.ok(params)
  return params({
    sessionID,
    agent: "orchestrator",
    model: {} as never,
    provider: {} as never,
    message: userMessage(userID, sessionID).info as never,
  }, { temperature: 0, topP: 1, topK: 0, maxOutputTokens: undefined, options: {} })
}

describe("output-loop-guard plugin", () => {
  it("blocks the next provider request after a repeated result", async () => {
    const { hooks, logCalls } = await createHarness()
    await inspect(hooks, repeatedMessages())

    await assert.rejects(() => request(hooks, "session-1", "user-1"), /identical assistant results repeated 3 times/i)
    assert.equal(logCalls.length, 1)
    const serializedLogs = JSON.stringify(logCalls)
    assert.doesNotMatch(serializedLogs, new RegExp(repeatedText))
    assert.doesNotMatch(serializedLogs, /digest|[a-f0-9]{64}/i)
    assert.match(serializedLogs, /output-loop-guard/)
  })

  it("keeps a session blocked until a genuine new user chat message", async () => {
    const { hooks } = await createHarness()
    await inspect(hooks, repeatedMessages())

    await assert.rejects(() => request(hooks, "session-1", "user-1"))
    await assert.rejects(() => request(hooks, "session-1", "internal-user"))
    const next = userMessage("user-2")
    await observeUser(hooks, next)
    await inspect(hooks, [...repeatedMessages(), next])
    await assert.doesNotReject(() => request(hooks, "session-1", "user-2"))
  })

  it("blocks compaction when its internal user ID differs", async () => {
    const { hooks } = await createHarness()
    await inspect(hooks, repeatedMessages())

    await assert.rejects(() => request(hooks, "session-1", "compaction-user"), /identical assistant results/i)
  })

  it("does not clear a block for internal chat messages or truncated transforms", async () => {
    const internalParts: unknown[][] = [
      [{ type: "text", text: "internal", synthetic: true }],
      [{ type: "text", text: "internal", ignored: true }],
      [{ type: "compaction", auto: true }],
    ]

    for (let index = 0; index < internalParts.length; index += 1) {
      const { hooks } = await createHarness()
      await inspect(hooks, repeatedMessages())
      await observeUser(hooks, userMessage(`internal-${index}`, "session-1", internalParts[index]))
      await inspect(hooks, [userMessage("older-user")])
      await assert.rejects(() => request(hooks, "session-1", `internal-${index}`))
    }
  })

  it("blocks immediately when pending receipt capacity is exhausted", async () => {
    const { hooks } = await createHarness()
    for (let index = 0; index < 256; index += 1) {
      await inspect(hooks, repeatedMessages(`session-${index}`, `user-${index}`))
    }

    await assert.rejects(
      () => inspect(hooks, repeatedMessages("session-256", "user-256")),
      /identical assistant results/i,
    )

    await observeUser(hooks, userMessage("user-new", "session-0"))
    await assert.doesNotReject(() => inspect(hooks, repeatedMessages("session-256", "user-256")))
    await assert.rejects(() => request(hooks, "session-256", "user-256"))
  })

  it("isolates pending receipts by session", async () => {
    const { hooks } = await createHarness()
    await inspect(hooks, repeatedMessages("session-1", "user-1"))

    await assert.doesNotReject(() => request(hooks, "session-2", "user-1"))
    await assert.rejects(() => request(hooks, "session-1", "user-1"))
  })

  it("allows requests when inspection finds no loop", async () => {
    const { hooks, logCalls } = await createHarness()
    await inspect(hooks, repeatedMessages().slice(0, 3))

    await assert.doesNotReject(() => request(hooks, "session-1", "user-1"))
    assert.equal(logCalls.length, 0)
  })

  it("still blocks when structured logging fails", async () => {
    const { hooks } = await createHarness("reject")
    await inspect(hooks, repeatedMessages())

    await assert.rejects(() => request(hooks, "session-1", "user-1"), /identical assistant results/i)
  })

  it("still blocks when structured logging throws synchronously", async () => {
    const { hooks } = await createHarness("throw")
    await inspect(hooks, repeatedMessages())

    await assert.rejects(() => request(hooks, "session-1", "user-1"), /identical assistant results/i)
  })

  it("does not wait for structured logging before blocking", async () => {
    const { hooks } = await createHarness("pending")
    await inspect(hooks, repeatedMessages())

    const outcome = await Promise.race([
      request(hooks, "session-1", "user-1").then(
        () => "allowed",
        () => "blocked",
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 100)),
    ])
    assert.equal(outcome, "blocked")
  })
})
