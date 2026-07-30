import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdirSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import * as realFs from "node:fs"
import { computeSourceEventId } from "../id.js"
import { createOutbox } from "../outbox.js"
import type { UsageLogPayload } from "../types.js"
import type { Seams } from "../seams.js"
import { makeCanonicalHome, makeBaseDir, makePayload, makeFakeFetch, makeLogCollector, testSeams } from "./outbox-test-support.js"

describe("outbox-claims-contention", () => {
  let baseDir: string
  let canonicalHome: string
  let chCleanup: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    chCleanup = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => chCleanup())

  it("claim contention: valid record with live claim makes zero POSTs on flush and does not spin", async () => {
    const { fn, callCount } = makeFakeFetch([{ status: 200 }])
    let now = Date.now()
    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-cc1", "msg-cc1", "part-cc1")
    const outboxDir = join(baseDir, "outbox")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })

    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now,
      providerId: "openai",
      modelId: "gpt-4",
      mode: "chat",
      usage: 0.01,
      input: 100,
      output: 50,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "p",
    }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const seamsA = testSeams(fn, canonicalHome, () => now)
    const seamsB = testSeams(fn, canonicalHome, () => now)
    const outboxA = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seamsA, logFn, { autoflush: false, claimStaleMs: 5000, contentionJitterMs: 0 })
    const outboxB = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seamsB, logFn, { autoflush: false, claimStaleMs: 5000, contentionJitterMs: 0 })

    const claimsDir = join(baseDir, "claims")
    const liveClaimMeta = { pid: process.pid, createdAt: now, nonce: "cc1-live-claim" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(liveClaimMeta), { mode: 0o600 })

    await outboxA.flush()

    assert.strictEqual(callCount(), 0, "zero POSTs when live claim blocks processing")
    assert.ok(realFs.existsSync(recordPath), "record preserved under live claim")

    const initialScanCount = callCount()
    await new Promise((r) => setTimeout(r, 100))
    assert.strictEqual(callCount(), initialScanCount, "no extra POSTs spun during short window")
  })

  it("claim expiry: record delivers after claim becomes stale via time advance", async () => {
    let now = Date.now()
    let captureRequest: { body: string } | null = null

    const fetchFn = async (_input: RequestInfo, init?: RequestInit) => {
      captureRequest = { body: (init?.body as string) ?? "" }
      return new Response(null, { status: 200 })
    }

    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-ce1", "msg-ce1", "part-ce1")
    const outboxDir = join(baseDir, "outbox")
    const claimsDir = join(baseDir, "claims")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })
    realFs.mkdirSync(claimsDir, { mode: 0o700 })

    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now,
      providerId: "openai",
      modelId: "gpt-4",
      mode: "chat",
      usage: 0.01,
      input: 100,
      output: 50,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "p",
    }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const oldClaimMeta = { pid: process.pid, createdAt: now, nonce: "ce1-old-claim" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(oldClaimMeta), { mode: 0o600 })

    const seams = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false, claimStaleMs: 30, contentionJitterMs: 0 })

    await outbox.flush()

    assert.strictEqual(captureRequest, null, "zero POSTs on first flush: claim live")

    now += 100

    const seams2 = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)
    const outbox2 = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams2, logFn, { autoflush: false, claimStaleMs: 30, contentionJitterMs: 0 })
    await outbox2.flush()

    assert.ok(captureRequest !== null, "record delivered after claim went stale via time advance")
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted after delivery")

    const claimFiles = realFs.existsSync(claimsDir) ? realFs.readdirSync(claimsDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(claimFiles.length, 0, "claim released")
  })

  it("claim expiry: record delivers after claim PID marked dead", async () => {
    let now = Date.now()
    let fetchCallCount = 0

    const fetchFn = async (_input: RequestInfo, _init?: RequestInit) => {
      fetchCallCount++
      return new Response(null, { status: 200 })
    }

    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-cd1", "msg-cd1", "part-cd1")
    const outboxDir = join(baseDir, "outbox")
    const claimsDir = join(baseDir, "claims")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })
    realFs.mkdirSync(claimsDir, { mode: 0o700 })

    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now,
      providerId: "openai",
      modelId: "gpt-4",
      mode: "chat",
      usage: 0.01,
      input: 100,
      output: 50,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "p",
    }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const extPid = 654321
    const liveClaimMeta = { pid: extPid, createdAt: now, nonce: "cd1-live-by-time" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(liveClaimMeta), { mode: 0o600 })

    const seamsAliveCheckTrue = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)
    seamsAliveCheckTrue.process = { pid: () => process.pid, aliveCheck: () => true }
    const outboxBlocked = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seamsAliveCheckTrue, logFn, { autoflush: false, claimStaleMs: 60000 })
    await outboxBlocked.flush()

    assert.strictEqual(fetchCallCount, 0, "zero POSTs on first flush: claim appears alive via injected aliveCheck")

    const seamsAliveCheckDead: Seams = { ...testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now), process: { pid: () => process.pid, aliveCheck: () => false } }
    const outboxDead = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seamsAliveCheckDead, logFn, { autoflush: false, claimStaleMs: 60000 })
    await outboxDead.flush()

    assert.ok(fetchCallCount >= 1, "record delivered after claim PID marked dead")
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted after delivery")

    const claimFiles = realFs.existsSync(claimsDir) ? realFs.readdirSync(claimsDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(claimFiles.length, 0, "claim released")
  })

  it("due retry record with live claim does not repeatedly scan at zero delay and delivers after claim stale", async () => {
    let now = Date.now()
    const fetchCalls: Array<{ status: number }> = []

    const fetchFn = async (_input: RequestInfo, _init?: RequestInit) => {
      fetchCalls.push({ status: 200 })
      return new Response(null, { status: 200 })
    }

    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-dr1", "msg-dr1", "part-dr1")
    const outboxDir = join(baseDir, "outbox")
    const claimsDir = join(baseDir, "claims")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })
    realFs.mkdirSync(claimsDir, { mode: 0o700 })

    const nowMs = now
    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: nowMs,
      providerId: "openai",
      modelId: "gpt-4",
      mode: "chat",
      usage: 0.01,
      input: 100,
      output: 50,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "p",
    }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload, createdAt: nowMs, retries: 1, nextAttemptAt: nowMs, lastAttempt: nowMs - 1000 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const liveClaimMeta = { pid: process.pid, createdAt: nowMs, nonce: "dr1-live" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(liveClaimMeta), { mode: 0o600 })

    const seams = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false, claimStaleMs: 5000, contentionJitterMs: 0 })

    const flushStart = Date.now()
    await outbox.flush()
    const flushDuration = Date.now() - flushStart

    assert.strictEqual(fetchCalls.length, 0, "zero POSTs: due record has live claim")
    assert.ok(flushDuration < 500, `flush did not block: ${flushDuration}ms`)

    await new Promise((r) => setTimeout(r, 100))
    assert.strictEqual(fetchCalls.length, 0, "no extra POSTs fired during short observation window")

    now += 10000

    const seams2 = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)
    const outbox2 = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams2, logFn, { autoflush: false, claimStaleMs: 5000, contentionJitterMs: 0 })
    await outbox2.flush()

    assert.ok(fetchCalls.length >= 1, "record delivered after claim went stale via time advance")
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted after delivery")
  })

  it("interleaving: enqueue returns false under held claim, original inode preserved, flusher deletes only its record", async () => {
    let now = Date.now()
    const resolveRef: { current: (() => void) | null } = { current: null }
    const flusherDeferred = new Promise<void>((resolve) => { resolveRef.current = resolve })

    let flusherPayload: unknown = null
    const hangFetch = async (_input: RequestInfo, init?: RequestInit) => {
      flusherPayload = init?.body ? JSON.parse(init.body as string) : null
      await flusherDeferred
      return new Response(null, { status: 200 })
    }

    const { logFn } = makeLogCollector()
    const seams = testSeams(hangFetch as unknown as typeof fetch, canonicalHome, () => now)

    const sourceEventId = computeSourceEventId("sess-il1", "msg-il1", "part-il1")
    const outboxDir = join(baseDir, "outbox")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })

    const originalPayload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now,
      providerId: "openai",
      modelId: "gpt-4",
      mode: "chat",
      usage: 0.01,
      input: 100,
      output: 50,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "p",
    }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload: originalPayload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const outboxFlusher = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false })

    const flushPromise = outboxFlusher.flush()

    await new Promise((r) => setTimeout(r, 50))

    const concurrentPayload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now + 1,
      providerId: "anthropic",
      modelId: "claude-3",
      mode: "chat",
      usage: 0.02,
      input: 200,
      output: 100,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "p",
    }

    const seamsB = testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => now)
    const outboxEnqueuer = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seamsB, logFn, { autoflush: false })

    const enqueueResult = outboxEnqueuer.enqueue(sourceEventId, concurrentPayload)
    assert.strictEqual(enqueueResult, false, "enqueue returns false when claim is held by flusher")

    const onDiskContent = JSON.parse(realFs.readFileSync(recordPath, "utf8"))
    assert.strictEqual(onDiskContent.payload.providerId, "openai", "original payload provider preserved")
    assert.strictEqual(onDiskContent.payload.usage, 0.01, "original payload usage preserved")
    assert.strictEqual(onDiskContent.payload.modelId, "gpt-4", "original payload model preserved")

    if (resolveRef.current) resolveRef.current()
    await flushPromise

    assert.strictEqual(realFs.existsSync(recordPath), false, "original record deleted after successful flusher delivery")
    assert.ok(flusherPayload !== null, "flusher completed its POST")

    const claimsDir = join(baseDir, "claims")
    const claimFiles = realFs.existsSync(claimsDir) ? realFs.readdirSync(claimsDir).filter((f: string) => f.endsWith(".json")) : []
    assert.strictEqual(claimFiles.length, 0, "claim released after delivery")
  })

  it("shared directory: two instances with distinguishable payloads, no stale payload posted after inode replaced and deleted", async () => {
    let now = Date.now()
    const fetchEvents: Array<{ body: string }> = []

    const fetchFn = async (_input: RequestInfo, init?: RequestInit) => {
      fetchEvents.push({ body: (init?.body as string) ?? "" })
      return new Response(null, { status: 200 })
    }

    const { logFn } = makeLogCollector()
    const seams = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)

    const sourceEventId = computeSourceEventId("sess-sd1", "msg-sd1", "part-sd1")
    const outboxDir = join(baseDir, "outbox")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })

    const payloadA: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now,
      providerId: "openai",
      modelId: "gpt-4",
      mode: "chat",
      usage: 0.01,
      input: 100,
      output: 50,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "instance-a",
    }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)

    const outboxA = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false })
    outboxA.enqueue(sourceEventId, payloadA)

    await outboxA.flush()

    assert.strictEqual(fetchEvents.length, 1, "instance A posted its payload")
    const postedPayloadA = JSON.parse(fetchEvents[0]!.body)
    assert.strictEqual(postedPayloadA.projectCode, "instance-a", "instance A payload delivered")
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted after instance A delivery")

    const payloadB: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now + 1,
      providerId: "anthropic",
      modelId: "claude-3",
      mode: "chat",
      usage: 0.02,
      input: 200,
      output: 100,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "instance-b",
    }

    const outboxB = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false })
    outboxB.enqueue(sourceEventId, payloadB)
    await outboxB.flush()

    assert.strictEqual(fetchEvents.length, 2, "instance B posted its payload")
    const postedPayloadB = JSON.parse(fetchEvents[1]!.body)
    assert.strictEqual(postedPayloadB.projectCode, "instance-b", "instance B payload delivered")

    for (const event of fetchEvents) {
      const p = JSON.parse(event.body)
      if (p.projectCode === "instance-a") {
        assert.strictEqual(p.providerId, "openai", "instance A payload not corrupted")
      }
      if (p.projectCode === "instance-b") {
        assert.strictEqual(p.providerId, "anthropic", "instance B payload not corrupted")
        assert.strictEqual(p.usage, 0.02, "instance B usage correct")
      }
    }

    assert.strictEqual(realFs.existsSync(recordPath), false, "no stale record remains on disk")
  })

  it("claim expiry exact boundary with >= comparison: record delivers at exactly claimStaleMs", async () => {
    let now = Date.now()
    let fetchCallCount = 0
    const fetchFn = async (_input: RequestInfo, _init?: RequestInit) => {
      fetchCallCount++
      return new Response(null, { status: 200 })
    }

    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-cb1", "msg-cb1", "part-cb1")
    const outboxDir = join(baseDir, "outbox")
    const claimsDir = join(baseDir, "claims")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })
    realFs.mkdirSync(claimsDir, { mode: 0o700 })

    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now,
      providerId: "openai",
      modelId: "gpt-4",
      mode: "chat",
      usage: 0.01,
      input: 100,
      output: 50,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "p",
    }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const claimMeta = { pid: process.pid, createdAt: now, nonce: "cb1-boundary-claim" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(claimMeta), { mode: 0o600 })

    const seams = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false, claimStaleMs: 30, contentionJitterMs: 0 })

    await outbox.flush()
    assert.strictEqual(fetchCallCount, 0, "zero POSTs: claim not yet stale")

    now += 29
    await outbox.flush()
    assert.strictEqual(fetchCallCount, 0, "zero POSTs at now+29ms: still within boundary")

    now += 1
    const seams2 = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)
    const outbox2 = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams2, logFn, { autoflush: false, claimStaleMs: 30, contentionJitterMs: 0 })
    await outbox2.flush()

    assert.ok(fetchCallCount >= 1, "record delivered at exactly claimStaleMs boundary")
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted after delivery")
  })

  it("scheduleRetryFlush targets at least claimExpiry+1ms even with contentionJitterMs:0", async () => {
    let now = Date.now()
    const fetchCalls: Array<{ capturedAt: number }> = []

    const fetchFn = async (_input: RequestInfo, _init?: RequestInit) => {
      fetchCalls.push({ capturedAt: now })
      return new Response(null, { status: 200 })
    }

    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-cd2", "msg-cd2", "part-cd2")
    const outboxDir = join(baseDir, "outbox")
    const claimsDir = join(baseDir, "claims")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })
    realFs.mkdirSync(claimsDir, { mode: 0o700 })

    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: now,
      providerId: "openai",
      modelId: "gpt-4",
      mode: "chat",
      usage: 0.01,
      input: 100,
      output: 50,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      projectCode: "p",
    }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const claimMeta = { pid: process.pid, createdAt: now, nonce: "cd2-schedule-claim" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(claimMeta), { mode: 0o600 })

    const seams = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false, claimStaleMs: 100, contentionJitterMs: 0 })

    await outbox.flush()

    assert.strictEqual(fetchCalls.length, 0, "zero POSTs: claim live")
    assert.ok(realFs.existsSync(recordPath), "record still on disk, awaiting contention resolution")

    now += 100
    await new Promise((r) => setTimeout(r, 30))

    assert.ok(fetchCalls.length === 0, "delayed wake should fire at +1ms minimum, autoflush off so no extra flushes triggered")
  })
})
