import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { join } from "node:path"
import { writeFileSync, unlinkSync } from "node:fs"
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
  type LogCall,
  type FakeClient,
} from "./hooks-test-support.js"

describe("createHooks scheduler", () => {
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

  it("metadata lookup returns null then succeeds on retry without another event", async () => {
    const captured: Array<{ url: string; body: string }> = []
    let callCount = 0
    const { client } = makeFakeClient()
    const base = testSeams(canonicalHome)
    const injectSeams: Seams = {
      ...base,
      network: {
        fetch: (async (input: RequestInfo, init?: RequestInit) => {
          const url = typeof input === "string" ? input : input.url
          captured.push({ url, body: (init?.body as string) ?? "" })
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
    }

    let deliverNull = true
    const slowClient: FakeClient = {
      session: {
        message: async () => {
          callCount++
          if (deliverNull) return { data: null as unknown as { info: { role: string; providerID: string; modelID: string; mode: string; id: string } } }
          return { data: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } }
        },
      },
      app: { log: async () => {} },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, slowClient as unknown as Parameters<typeof createHooks>[4], injectSeams, { metadataRetryBaseMs: 10, metadataRetryMaxMs: 100, metadataConcurrency: 10 })

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 50))

    assert.ok(callCount >= 1, "at least one lookup attempted")
    assert.strictEqual(captured.length, 0, "no delivery before metadata")

    deliverNull = false

    await new Promise((r) => setTimeout(r, 100))

    assert.ok(callCount > 1, "retry lookup called after metadata available")
    assert.strictEqual(captured.length, 1, "payload delivered after metadata arrived on retry")
  })

  it("two pending steps sharing messageID cause one lookup per retry cycle", async () => {
    let callCount = 0
    const { client } = makeFakeClient()
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

    let ctr = 0
    const slowClient: FakeClient = {
      session: {
        message: async () => {
          ctr++
          callCount++
          if (ctr <= 2) return { data: null as unknown as { info: { role: string; providerID: string; modelID: string; mode: string; id: string } } }
          return { data: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } }
        },
      },
      app: { log: async () => {} },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, slowClient as unknown as Parameters<typeof createHooks>[4], injectSeams, { metadataRetryBaseMs: 10, metadataRetryMaxMs: 50, metadataConcurrency: 10 })

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])
    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part2", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.02, tokens: { input: 200, output: 100, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 200))

    assert.strictEqual(callCount, 3, "three calls: first cycle fires once for both steps, second cycle fires once, third delivers")
    assert.strictEqual(captured.length, 2, "both steps delivered after metadata")
  })

  it("concurrency never exceeds configured cap across distinct messages", async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const pendingResolves: Array<() => void> = []
    const pendingMessages = ["m1", "m2", "m3", "m4"]
    const base = testSeams(canonicalHome)
    const hookSeams: Seams = {
      ...base,
      network: { fetch: base.network.fetch },
    }

    const slowClient: FakeClient = {
      session: {
        message: async () => {
          concurrent++
          if (concurrent > maxConcurrent) maxConcurrent = concurrent
          await new Promise<void>((resolve) => { pendingResolves.push(resolve) })
          concurrent--
          return { data: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "any" } } }
        },
      },
      app: { log: async () => {} },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, slowClient as unknown as Parameters<typeof createHooks>[4], hookSeams, { metadataRetryBaseMs: 5, metadataRetryMaxMs: 50, metadataConcurrency: 2 })

    for (let i = 0; i < 4; i++) {
      await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: `p${i}`, sessionID: "sess1", messageID: pendingMessages[i]!, type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])
    }

    await new Promise((r) => setTimeout(r, 50))

    assert.ok(maxConcurrent <= 2, `max concurrent ${maxConcurrent} should not exceed 2`)

    for (const resolve of pendingResolves) resolve()
  })

  it("metadata retry expires after maxAgeMs and logs pending_expired", async () => {
    let timeValue = Date.now()
    const timeSeam = { now: () => timeValue }
    const captured: Array<{ body: string }> = []
    const base = testSeams(canonicalHome)
    const injectSeams: Seams = {
      ...base,
      time: timeSeam,
      network: {
        fetch: (async (input: RequestInfo, init?: RequestInit) => {
          captured.push({ body: (init?.body as string) ?? "" })
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
    }

    const syncLogCalls: LogCall[] = []
    const slowClient: FakeClient = {
      session: {
        message: async () => ({ data: null as unknown as { info: { role: string; providerID: string; modelID: string; mode: string; id: string } } }),
      },
      app: {
        log: async (opts) => {
          syncLogCalls.push({ service: opts.body.service, level: opts.body.level, message: opts.body.message, extra: opts.body.extra })
        },
      },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, slowClient as unknown as Parameters<typeof createHooks>[4], injectSeams, { metadataRetryBaseMs: 100, metadataRetryMaxMs: 200, metadataConcurrency: 10 })

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    timeValue = Date.now() + (3 * 60 * 60 * 1000)

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg-nonexistent" } } } } as Parameters<typeof hooks.event>[0])

    assert.ok(
      syncLogCalls.some((l: LogCall) => l.extra && (l.extra as Record<string, unknown>).category === "pending_expired"),
      "pending_expired logged for expired record",
    )

    assert.strictEqual(captured.length, 0, "no delivery for expired pending")
    await hooks.dispose?.()
  })

  it("metadata lookup rejects info.id mismatch and does not cache mismatched metadata", async () => {
    let fetchCallCount = 0
    let lookupCallCount = 0
    const base = testSeams(canonicalHome)
    const injectSeams: Seams = {
      ...base,
      network: {
        fetch: (async (input: RequestInfo, init?: RequestInit) => {
          fetchCallCount += 1
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
    }

    const mismatchClient: FakeClient = {
      session: {
        message: async () => {
          lookupCallCount++
          return {
            data: { info: { role: "assistant" as const, providerID: "openai", modelID: "gpt-4", mode: "chat", id: "different-msg" } },
          }
        },
      },
      app: { log: async () => {} },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, mismatchClient as unknown as Parameters<typeof createHooks>[4], injectSeams, { metadataRetryBaseMs: 10, metadataRetryMaxMs: 50, metadataConcurrency: 10 })

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 200))

    assert.ok(lookupCallCount > 1, "mismatched ID causes retries, not cached")
    assert.strictEqual(fetchCallCount, 0, "no delivery on mismatched metadata ID")

    const pendingDir = join(baseDir, "pending")
    const pendingFiles = realFs.existsSync(pendingDir) ? realFs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(pendingFiles.length >= 1, "pending remains for mismatched metadata")
    await hooks.dispose?.()
  })

  it("does not retain pending in memory when persist fails; no later delivery", async () => {
    let fetchCallCount = 0
    const { client, logCalls } = makeFakeClient({ messageData: null })
    let pendingOpenFailed = false
    const base = testSeams(canonicalHome)
    const injectSeams: Seams = {
      ...base,
      fs: {
        ...base.fs,
        openSync: (p: string, flags: number, mode?: number) => {
          if (!pendingOpenFailed && p.includes("/pending/")) {
            pendingOpenFailed = true
            throw new Error("injected open failure under pending")
          }
          return realFs.openSync(p, flags, mode)
        },
      },
      network: {
        fetch: (async (input: RequestInfo, init?: RequestInit) => {
          fetchCallCount += 1
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
    }
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], injectSeams)

    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 100))

    assert.strictEqual(fetchCallCount, 0, "no fetch before metadata arrives")
    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "pending_persist_failed"), "pending_persist_failed structured log")

    const pendingDir = join(baseDir, "pending")
    const pendingFiles = realFs.existsSync(pendingDir) ? realFs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(pendingFiles.length, 0, "no pending disk file created")

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 200))

    assert.strictEqual(fetchCallCount, 0, "no fetch after meta: memory-only record not accepted, nothing to deliver")

    const outboxDir = join(baseDir, "outbox")
    const outboxFiles = realFs.existsSync(outboxDir) ? realFs.readdirSync(outboxDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(outboxFiles.length, 0, "no outbox entry for undurable record")
  })

  it("retains pending and logs outbox_enqueue_failed when first outbox openSync fails, then delivers on retry", async () => {
    let fetchCallCount = 0
    const { client, logCalls } = makeFakeClient()
    let failOutbox = true
    const base = testSeams(canonicalHome)
    const injectSeams: Seams = {
      ...base,
      fs: {
        ...base.fs,
        openSync: (p: string, flags: number, mode?: number) => {
          if (failOutbox && p.includes("/outbox/")) {
            throw new Error("injected open failure under outbox")
          }
          return realFs.openSync(p, flags, mode)
        },
      },
      network: {
        fetch: (async (input: RequestInfo, init?: RequestInit) => {
          fetchCallCount += 1
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
    }
    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], injectSeams)

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])
    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 200))

    assert.strictEqual(fetchCallCount, 0, "no fetch after failed outbox enqueue")

    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "outbox_enqueue_atomic_write_failed"), "outbox_enqueue_atomic_write_failed structured log")
    assert.ok(logCalls.some((l) => l.extra && (l.extra as Record<string, unknown>).category === "outbox_enqueue_failed"), "outbox_enqueue_failed structured log")

    const pendingDir = join(baseDir, "pending")
    const pendingFiles = realFs.existsSync(pendingDir) ? realFs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(pendingFiles.length >= 1, "pending JSON remains on disk")

    failOutbox = false
    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 200))

    assert.strictEqual(fetchCallCount, 1, "fetch called once after retry meta arrival")

    const pendingFilesAfter = realFs.existsSync(pendingDir) ? realFs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(pendingFilesAfter.length, 0, "pending JSON removed after successful outbox enqueue")
  })

  it("cached metadata with enqueue contention: pending retries after claim released and does not strand", async () => {
    let now = Date.now()
    const timeSeam = { now: () => now }
    const captured: Array<{ body: string }> = []

    const { client } = makeFakeClient()
    const base = testSeams(canonicalHome)

    const claimsDir = join(baseDir, "claims")
    realFs.mkdirSync(claimsDir, { mode: 0o700 })

    const partID = "part-ct"
    const sourceEventId = computeSourceEventId("sess1", "msg1", partID)

    const injectSeams: Seams = {
      ...base,
      time: timeSeam,
      network: {
        fetch: (async (_input: RequestInfo, init?: RequestInit) => {
          captured.push({ body: (init?.body as string) ?? "" })
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
      process: {
        pid: () => process.pid,
        aliveCheck: () => true,
      },
    }

    const hooks = createHooks(config, "github.com/user/repo", baseDir, canonicalHome, client as unknown as Parameters<typeof createHooks>[4], injectSeams, { metadataRetryBaseMs: 10, metadataRetryMaxMs: 100, metadataConcurrency: 10 })

    const claimPath = join(claimsDir, `${sourceEventId}.json`)
    const holdClaimMeta = { pid: 1, createdAt: now, nonce: "ct-ext-claim" }
    realFs.writeFileSync(claimPath, JSON.stringify(holdClaimMeta), { mode: 0o600 })

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])
    await hooks.event({ event: { type: "message.part.updated", properties: { part: { id: partID, sessionID: "sess1", messageID: "msg1", type: "step-finish", reason: "stop", cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 100))

    assert.strictEqual(captured.length, 0, "no delivery while claim is held")

    const pendingDir = join(baseDir, "pending")
    const pendingFiles = realFs.existsSync(pendingDir) ? realFs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(pendingFiles.length >= 1, "pending retained during claim contention")

    const claimContent = JSON.parse(realFs.readFileSync(claimPath, "utf8"))
    assert.strictEqual(claimContent.nonce, "ct-ext-claim", "external claim preserved")

    try { realFs.unlinkSync(claimPath) } catch {}

    await hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } } } } as Parameters<typeof hooks.event>[0])

    await new Promise((r) => setTimeout(r, 200))

    assert.strictEqual(captured.length, 1, "delivery succeeds after claim released, triggered by drainPending on message.updated")
    const deliveredPayload = JSON.parse(captured[0]!.body)

    assert.strictEqual(deliveredPayload.providerId, "openai", "correct payload delivered")

    const pendingAfter = realFs.existsSync(pendingDir) ? realFs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(pendingAfter.length, 0, "pending cleaned after successful delivery")

    await hooks.dispose?.()
  })

  it("retries a pending message with its own session after metadata eviction", async () => {
    const captured: Array<{ body: string }> = []
    const lookupPaths: Array<{ id: string; messageID: string }> = []
    const base = testSeams(canonicalHome)
    const injectSeams: Seams = {
      ...base,
      network: {
        fetch: (async (_input: RequestInfo, init?: RequestInit) => {
          captured.push({ body: (init?.body as string) ?? "" })
          return new Response(null, { status: 200 })
        }) as Seams["network"]["fetch"],
      },
      process: {
        pid: () => process.pid,
        aliveCheck: () => true,
      },
    }
    const client: FakeClient = {
      session: {
        message: async ({ path }) => {
          lookupPaths.push(path)
          if (path.id !== "session-b" || path.messageID !== "message-b") {
            return { data: null as unknown as { info: { role: string; providerID: string; modelID: string; mode: string; id: string } } }
          }
          return {
            data: {
              info: {
                role: "assistant",
                providerID: "openai",
                modelID: "gpt-4",
                mode: "chat",
                id: "message-b",
              },
            },
          }
        },
      },
      app: { log: async () => {} },
    }
    const hooks = createHooks(
      config,
      "github.com/user/repo",
      baseDir,
      canonicalHome,
      client as unknown as Parameters<typeof createHooks>[4],
      injectSeams,
      { metadataRetryBaseMs: 20, metadataRetryMaxMs: 50, metadataConcurrency: 10 },
    )
    const partA = {
      id: "part-a",
      sessionID: "session-a",
      messageID: "message-a",
      type: "step-finish",
      reason: "stop",
      cost: 0.01,
      tokens: { input: 10, output: 5, reasoning: 0, cache: { read: 0, write: 0 } },
    }
    const partB = {
      id: "part-b",
      sessionID: "session-b",
      messageID: "message-b",
      type: "step-finish",
      reason: "stop",
      cost: 0.02,
      tokens: { input: 20, output: 10, reasoning: 0, cache: { read: 0, write: 0 } },
    }
    const sourceEventIdB = computeSourceEventId(partB.sessionID, partB.messageID, partB.id)
    const claimPath = join(baseDir, "claims", `${sourceEventIdB}.json`)
    realFs.writeFileSync(
      claimPath,
      JSON.stringify({ pid: 1, createdAt: Date.now(), nonce: "held-b" }),
      { mode: 0o600 },
    )

    await hooks.event({ event: { type: "message.part.updated", properties: { part: partA } } } as Parameters<typeof hooks.event>[0])
    await hooks.event({ event: { type: "message.part.updated", properties: { part: partB } } } as Parameters<typeof hooks.event>[0])

    const metadataEvents: Array<Promise<void>> = []
    metadataEvents.push(hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "message-b" } } } } as Parameters<typeof hooks.event>[0]))
    for (let i = 0; i < 220; i++) {
      metadataEvents.push(hooks.event({ event: { type: "message.updated", properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: `eviction-${i}` } } } } as Parameters<typeof hooks.event>[0]))
    }
    await Promise.all(metadataEvents)
    realFs.unlinkSync(claimPath)
    lookupPaths.length = 0

    await new Promise((resolve) => setTimeout(resolve, 300))

    assert.ok(
      lookupPaths.some((path) => path.id === "session-b" && path.messageID === "message-b"),
      "metadata retry uses the pending message's own session",
    )
    assert.strictEqual(captured.length, 1, "pending message is delivered after its claim is released")
    await hooks.dispose?.()
  })
})
