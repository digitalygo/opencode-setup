import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { join } from "node:path"
import { mkdirSync, symlinkSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import * as realFs from "node:fs"
import { createHooks } from "../hooks.js"
import type { ResolvedConfig } from "../types.js"
import type { Seams } from "../seams.js"
import {
  makeCanonicalHome,
  makeBaseDir,
  makeFakeClient,
  testSeams,
  type FakeClient,
} from "./hooks-test-support.js"

describe("createHooks events", () => {
  let baseDir: string
  let canonicalHome: string
  let chCleanup: () => void
  let config: ResolvedConfig

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    chCleanup = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
    config = { base: "https://api.example.com", key: "sk-test" }
  })

  afterEach(() => chCleanup())

  it("rejects malformed message.part.updated with null part and logs event_invalid", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: null } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid logged for null part")

    const pendingDir = join(baseDir, "pending")
    const pendingFiles = realFs.existsSync(pendingDir) ? realFs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(pendingFiles.length, 0, "no pending write for invalid event")
  })

  it("rejects step with NaN cost and logs event_invalid", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "p1", sessionID: "s1", messageID: "m1", type: "step-finish", cost: NaN, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for NaN cost")

    const outboxDir = join(baseDir, "outbox")
    const outboxFiles = realFs.existsSync(outboxDir) ? realFs.readdirSync(outboxDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(outboxFiles.length, 0, "no outbox write for NaN cost")
  })

  it("rejects step with Infinity tokens and logs event_invalid", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "p1", sessionID: "s1", messageID: "m1", type: "step-finish", cost: 0.01, tokens: { input: Infinity, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for Infinity tokens")

    const outboxDir = join(baseDir, "outbox")
    const outboxFiles = realFs.existsSync(outboxDir) ? realFs.readdirSync(outboxDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(outboxFiles.length, 0, "no outbox write for Infinity tokens")
  })

  it("logs event_invalid for message.updated with missing info", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: {} } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for missing info")
  })

  it("logs event_handler_failed on unexpected error during event processing", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    const event = {
      event: {
        type: "message.part.updated" as string,
        get properties() { throw new Error("getter explosion") },
      },
    }

    await hooks.event(event as unknown as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_handler_failed"), "event_handler_failed logged")
  })

  it("null input event does not throw", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    await assert.doesNotReject(() => hooks.event(null as unknown as Parameters<typeof hooks.event>[0]))
  })

  it("null event type does not throw and logs event_invalid", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    await hooks.event({ event: null as unknown as { type: string; properties: Record<string, unknown> } })
    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"))
  })

  it("null event properties does not throw and logs event_invalid", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    await hooks.event({ event: { type: "message.part.updated", properties: null as unknown as Record<string, unknown> } })
    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"))
  })

  it("non-assistant message.updated is ignored without event_invalid log", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "user", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])
    assert.strictEqual(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), false, "no event_invalid for user message")
  })

  it("non-step-finish message.part.updated is ignored without event_invalid log", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "p1", sessionID: "s1", messageID: "m1", type: "text", cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])
    assert.strictEqual(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), false, "no event_invalid for non-step-finish part")
  })

  it("malformed metadata lookup never writes or fetches", async () => {
    let fetchCallCount = 0
    let openSyncCallCount = 0
    const { client } = makeFakeClient()
    const base = testSeams(canonicalHome)
    const probeSeams: Seams = {
      ...base,
      fs: {
        ...base.fs,
        openSync: (p: string, flags: number, mode?: number) => {
          openSyncCallCount++
          return realFs.openSync(p, flags, mode)
        },
      },
      network: {
        fetch: (async (input: RequestInfo, init?: RequestInit) => {
          fetchCallCount++
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
    }

    const malformedClient: FakeClient = {
      session: {
        message: async () => ({
          data: { info: { role: "assistant" as const, providerID: "", modelID: "gpt-4", mode: "chat", id: "msg1" } },
        }),
      },
      app: { log: async () => {} },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, malformedClient as unknown as Parameters<typeof createHooks>[4], probeSeams, { metadataRetryBaseMs: 10, metadataRetryMaxMs: 100, metadataConcurrency: 10 })

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 200))

    assert.strictEqual(fetchCallCount, 0, "no fetch when metadata is malformed and never validated")
  })

  it("logs event_invalid for message.updated with info array", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: { info: [{ role: "assistant" }] } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for info array")
  })

  it("logs event_invalid for message.updated with assistant role but empty providerID", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for empty providerID")
  })

  it("logs event_invalid for message.updated with assistant role but empty modelID", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for empty modelID")
  })

  it("logs event_invalid for message.updated with assistant role but empty mode", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for empty mode")
  })

  it("logs event_invalid for message.updated with assistant role but empty id", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "" } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for empty id")
  })

  it("logs event_invalid for message.updated with assistant role but unsafe providerID chars", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "bad\x00id", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for unsafe providerID chars")
  })

  it("logs event_invalid for message.part.updated with missing part.type", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "p1", sessionID: "s1", messageID: "m1" } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for missing part.type")
  })

  it("logs event_invalid for message.part.updated with non-string part.type", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "p1", sessionID: "s1", messageID: "m1", type: 123 } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for non-string part.type")
  })

  it("logs event_invalid for message.part.updated with part array", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: [] } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for part array")
  })

  it("logs event_invalid when input event is array", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event([{ event: { type: "message.updated", properties: {} } }] as unknown as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for array input")
  })

  it("logs event_invalid when event properties is an array", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: [] as unknown as Record<string, unknown> } })

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for properties array")
  })

  it("logs event_invalid when event.type is missing", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { properties: {} } as unknown as Parameters<typeof hooks.event>[0]["event"] })

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for missing event.type")
  })

  it("logs event_invalid when event.type is empty string", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "", properties: {} } })

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for empty event.type")
  })

  it("logs event_invalid when event.type has unsafe chars", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "bad\ntype", properties: {} } })

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for unsafe event.type chars")
  })

  it("logs event_invalid when event.type is a number", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: 123 as unknown as string, properties: {} } })

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for non-string event.type")
  })

  it("rejects step with fractional token count and logs event_invalid", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "p1", sessionID: "s1", messageID: "m1", type: "step-finish", cost: 0.01, tokens: { input: 100.5, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for fractional input tokens")

    const outboxDir = join(baseDir, "outbox")
    const outboxFiles = realFs.existsSync(outboxDir) ? realFs.readdirSync(outboxDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(outboxFiles.length, 0, "no outbox write for fractional tokens")
  })

  it("rejects step with token count exceeding 1e12 domain cap", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "p1", sessionID: "s1", messageID: "m1", type: "step-finish", cost: 0.01, tokens: { input: 2e12, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for tokens exceeding 1e12 cap")

    const outboxDir = join(baseDir, "outbox")
    const outboxFiles = realFs.existsSync(outboxDir) ? realFs.readdirSync(outboxDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(outboxFiles.length, 0, "no outbox write for huge tokens")
  })

  it("rejects step with huge cost exceeding 1e12 and logs event_invalid", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "p1", sessionID: "s1", messageID: "m1", type: "step-finish", cost: 2e12, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), "event_invalid for huge cost")
  })
})
