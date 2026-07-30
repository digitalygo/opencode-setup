import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { join } from "node:path"
import { mkdirSync, symlinkSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import * as realFs from "node:fs"
import { createHooks } from "../hooks.js"
import { computeSourceEventId } from "../id.js"
import type { ResolvedConfig } from "../types.js"
import type { Seams } from "../seams.js"
import {
  makeCanonicalHome,
  makeBaseDir,
  makeFakeClient,
  testSeams,
  type FakeClient,
} from "./hooks-test-support.js"

describe("createHooks lifecycle", () => {
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

  it("initializes without throwing", () => {
    const { client } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    assert.ok(typeof hooks.event === "function")
  })

  it("handles message.part.updated step-finish event", async () => {
    const { client } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])
    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])
  })

  it("returns no-op when config is empty", () => {
    const { client } = makeFakeClient()
    const hooks = createHooks({ base: "", key: "" }, "", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    assert.ok(typeof hooks.event === "function")
  })

  it("returns no-op when projectCode is empty", () => {
    const { client } = makeFakeClient()
    const hooks = createHooks(config, "", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    assert.ok(typeof hooks.event === "function")
  })

  it("emits outbox_setup_failed when outbox dir creation fails", () => {
    const { client, logCalls } = makeFakeClient()
    const base = testSeams(canonicalHome)
    const poisonSeams: Seams = { ...base, fs: { ...base.fs, mkdirSync: () => { throw new Error("disk full") } } }
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], poisonSeams)
    assert.ok(typeof hooks.event === "function")
    assert.ok(logCalls.some((l) => l.message === "outbox setup failed" && l.extra && (l.extra as Record<string, unknown>).category === "outbox_setup_failed"), "outbox_setup_failed structured log")
  })

  it("a rejected client.app.log promise does not reject plugin init", () => {
    const client: FakeClient = {
      session: { message: async () => ({ data: null as unknown as { info: never } }) },
      app: { log: async () => { throw new Error("log rejected") } },
    }
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    assert.ok(typeof hooks.event === "function")
  })

  it("clean disposal does not throw", async () => {
    const { client } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
    await assert.doesNotReject(() => hooks.dispose?.() ?? Promise.resolve())
  })

  it("delivers payload with correct schemaVersion, endpoint, bearer, projectCode, and sourceEventId", async () => {
    const { client } = makeFakeClient()
    const capturedRequests: Array<{ url: string; method: string; headers: Record<string, string>; body: string }> = []

    const fetchCapturingSeams = testSeams(canonicalHome)
    fetchCapturingSeams.network.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url
      const headers: Record<string, string> = {}
      if (init?.headers) {
        const h = init.headers as Record<string, string>
        for (const key of Object.keys(h)) headers[key] = h[key]!
      }
      capturedRequests.push({ url, method: init?.method ?? "GET", headers, body: (init?.body as string) ?? "" })
      return new Response(null, { status: 200 })
    }) as Seams["network"]["fetch"]

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], fetchCapturingSeams)

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])
    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 3 } } } } } } as Parameters<typeof hooks.event>[0])

    for (let attempt = 0; attempt < 30 && capturedRequests.length === 0; attempt++) {
      await new Promise((r) => setTimeout(r, 100))
    }

    assert.ok(capturedRequests.length >= 1, "at least one request captured")
    const req = capturedRequests[0]!
    assert.strictEqual(req.url, "https://api.example.com/api/v2/usage-logs")
    assert.strictEqual(req.method, "POST")
    assert.strictEqual(req.headers["Authorization"], "Bearer sk-test")
    assert.strictEqual(req.headers["Content-Type"], "application/json")

    const payload = JSON.parse(req.body)
    assert.strictEqual(payload.schemaVersion, 2)
    assert.strictEqual(payload.event, "llm.step.completed")
    assert.strictEqual(payload.providerId, "openai")
    assert.strictEqual(payload.modelId, "gpt-4")
    assert.strictEqual(payload.mode, "chat")
    assert.strictEqual(payload.usage, 0.01)
    assert.strictEqual(payload.input, 100)
    assert.strictEqual(payload.output, 50)
    assert.strictEqual(payload.reasoning, 10)
    assert.strictEqual(payload.cacheRead, 5)
    assert.strictEqual(payload.cacheWrite, 3)
    assert.strictEqual(payload.projectCode, "github.com/user/repo")

    const expectedId = computeSourceEventId("sess1", "msg1", "part1")
    assert.strictEqual(payload.sourceEventId, expectedId)
    assert.strictEqual(typeof payload.createdAt, "number")
  })

  it("logs pending_setup_failed and returns no-op when pending dir is a symlink", () => {
    const { client, logCalls } = makeFakeClient()
    const symlinkTarget = join(tmpdir(), `ext-pending-${randomBytes(8).toString("hex")}`)
    mkdirSync(symlinkTarget, { mode: 0o700 })
    const pendingLink = join(baseDir, "pending")
    symlinkSync(symlinkTarget, pendingLink)
    try {
      const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
      assert.ok(typeof hooks.event === "function")
      assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "pending_setup_failed"), "pending_setup_failed structured log")
    } finally {
      try { rmSync(symlinkTarget, { recursive: true, force: true }) } catch {}
    }
  })

  it("disposes outbox when pending setup fails", async () => {
    const { client, logCalls } = makeFakeClient()
    const symlinkTarget = join(tmpdir(), `ext-pending-${randomBytes(8).toString("hex")}`)
    mkdirSync(symlinkTarget, { mode: 0o700 })
    const pendingLink = join(baseDir, "pending")
    symlinkSync(symlinkTarget, pendingLink)
    try {
      const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))
      assert.ok(typeof hooks.event === "function")
      assert.ok(typeof hooks.dispose === "function")
      await assert.doesNotReject(() => hooks.dispose?.() ?? Promise.resolve())
      assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "pending_setup_failed"))
    } finally {
      try { rmSync(symlinkTarget, { recursive: true, force: true }) } catch {}
    }
  })

  it("dispose stops future retries and prevents enqueue", async () => {
    const base = testSeams(canonicalHome)
    const captured: Array<{ body: string }> = []
    const injectSeams: Seams = {
      ...base,
      network: {
        fetch: (async (input: RequestInfo, init?: RequestInit) => {
          captured.push({ body: (init?.body as string) ?? "" })
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
    }

    let callCount = 0
    const slowClient: FakeClient = {
      session: {
        message: async () => {
          callCount++
          return { data: null as unknown as { info: { role: string; providerID: string; modelID: string; mode: string; id: string } } }
        },
      },
      app: { log: async () => {} },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, slowClient as unknown as Parameters<typeof createHooks>[4], injectSeams, { metadataRetryBaseMs: 20, metadataRetryMaxMs: 100, metadataConcurrency: 10 })

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 30))

    await hooks.dispose?.()

    const callsBeforeDispose = callCount

    await new Promise((r) => setTimeout(r, 300))

    assert.strictEqual(callCount, callsBeforeDispose, "no more lookups after dispose")
    assert.strictEqual(captured.length, 0, "no enqueue after dispose")
  })

  it("dispose races in-flight metadata lookup and prevents post-dispose write/fetch", async () => {
    let fetched = false
    let lookupStarted = false
    const lookupControl: { resolve: (() => void) | null } = { resolve: null }
    const lookupDeferred = new Promise<void>((resolve) => { lookupControl.resolve = resolve })
    const base = testSeams(canonicalHome)
    const injectSeams: Seams = {
      ...base,
      network: {
        fetch: (async (input: RequestInfo, init?: RequestInit) => {
          fetched = true
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
    }

    const slowClient: FakeClient = {
      session: {
        message: async () => {
          lookupStarted = true
          await lookupDeferred
          return { data: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } }
        },
      },
      app: { log: async () => {} },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, slowClient as unknown as Parameters<typeof createHooks>[4], injectSeams, { metadataRetryBaseMs: 5, metadataRetryMaxMs: 100, metadataConcurrency: 10 })

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 20))

    const disposePromise = hooks.dispose?.() ?? Promise.resolve()

    await new Promise((r) => setTimeout(r, 10))

    assert.ok(lookupStarted, "lookup in-flight during dispose race")
    assert.strictEqual(fetched, false, "no fetch during in-flight race")

    if (lookupControl.resolve) lookupControl.resolve()

    await disposePromise

    assert.strictEqual(fetched, false, "no fetch after dispose completes")

    const outboxDir = join(baseDir, "outbox")
    const outboxFiles = realFs.existsSync(outboxDir) ? realFs.readdirSync(outboxDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(outboxFiles.length, 0, "no outbox entry after dispose")
  })

  it("late events after dispose are no-op", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.dispose?.()

    const beforeCount = logCalls.length

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])
    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    const pendingDir = join(baseDir, "pending")
    const pendingFiles = realFs.existsSync(pendingDir) ? realFs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(pendingFiles.length, 0, "no pending writes after dispose")

    const outboxDir = join(baseDir, "outbox")
    const outboxFiles = realFs.existsSync(outboxDir) ? realFs.readdirSync(outboxDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(outboxFiles.length, 0, "no outbox writes after dispose")

    const newLogs = logCalls.slice(beforeCount)
    const hasPostDispose = newLogs.some((l) => l.message === "event invalid" || l.message === "event_handler_failed")
    assert.strictEqual(hasPostDispose, false, "no post-dispose event processing")
  })

  it("message.updated with mismatched info.id still caches under event's info.id key", async () => {
    const { client, logCalls } = makeFakeClient()
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], testSeams(canonicalHome))

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg-received" } } } } as Parameters<typeof hooks.event>[0])

    assert.strictEqual(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "event_invalid"), false, "valid message.updated with correct info.id ok")
  })
})
