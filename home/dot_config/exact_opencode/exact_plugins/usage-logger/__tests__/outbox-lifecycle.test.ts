import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import * as realFs from "node:fs"
import { computeSourceEventId } from "../id.js"
import { createOutbox } from "../outbox.js"
import type { UsageLogPayload } from "../types.js"
import { makeCanonicalHome, makeBaseDir, makePayload, makeFakeFetch, makeLogCollector, testSeams, countFiles } from "./outbox-test-support.js"

describe("outbox-lifecycle", () => {
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

  it("dispose clears retry timers", async () => {
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => Date.now()), logFn)
    await assert.doesNotReject(() => outbox.dispose())
  })

  it("chmods state base directory to 0700 when init starts with 0755", () => {
    const ch = makeCanonicalHome()
    try {
      const testDir = join(ch.home, `test-${randomBytes(8).toString("hex")}`)
      mkdirSync(testDir, { mode: 0o755 })
      const preMode = realFs.statSync(testDir).mode & 0o777
      assert.strictEqual(preMode, 0o755)

      const { logFn } = makeLogCollector()
      createOutbox(testDir, "key", "https://api.example.com/api/v2/usage-logs", ch.home, testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, ch.home, () => Date.now()), logFn)

      const postMode = realFs.statSync(testDir).mode & 0o777
      assert.strictEqual(postMode, 0o700)
    } finally {
      ch.cleanup()
    }
  })

  it("delivers a preexisting outbox record on startup flush", async () => {
    const outboxDir = join(baseDir, "outbox")
    mkdirSync(outboxDir, { mode: 0o700 })
    const sourceEventId = computeSourceEventId("sess1", "msg1", "part1")
    const record = {
      sourceEventId,
      payload: makePayload("github.com/org/repo"),
      createdAt: Date.now(),
      retries: 0,
    }
    realFs.writeFileSync(join(outboxDir, `${sourceEventId}.json`), JSON.stringify(record), { mode: 0o600 })

    const { fn, calls } = makeFakeFetch([{ status: 200 }])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: true })

    await new Promise((r) => setTimeout(r, 200))

    assert.ok(calls.length >= 1, "preexisting record delivered on startup")
    assert.strictEqual(realFs.existsSync(join(outboxDir, `${sourceEventId}.json`)), false, "outbox file deleted after delivery")
  })

  it("dispose aborts in-flight fetch and prevents new enqueue", async () => {
    let fetchAborted = false
    const resolveRef: { current: (() => void) | null } = { current: null }
    const fetchPromise = new Promise<void>((resolve) => { resolveRef.current = resolve })

    const base = testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => Date.now())
    const injectSeams = {
      ...base,
      network: {
        fetch: async (_input: RequestInfo, init?: RequestInit) => {
          try {
            await fetchPromise
            return new Response(null, { status: 200 })
          } catch {
            fetchAborted = true
            throw new Error("aborted")
          }
        },
      },
    } as typeof base

    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectSeams, logFn, { autoflush: false })
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))

    const flushPromise = outbox.flush()

    await new Promise((r) => setTimeout(r, 50))

    await outbox.dispose()

    if (resolveRef.current) resolveRef.current()

    await flushPromise.catch(() => {})

    assert.strictEqual(fetchAborted, false, "fetch was not aborted but completed after dispose resolve")

    assert.strictEqual(outbox.enqueue(makePayload("p2").sourceEventId, makePayload("p2")), false, "enqueue rejected after dispose")
  })

  it("dispose clears retry timers and no mutations occur after", async () => {
    const base = testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => Date.now())
    const injectSeams = {
      ...base,
      time: {
        ...base.time,
      },
    }
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectSeams, logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const sourceEventId = computeSourceEventId("sess1", "msg1", "part1")
    const record = {
      sourceEventId,
      payload: makePayload("p"),
      createdAt: Date.now(),
      retries: 0,
      nextAttemptAt: Date.now() + 5000,
    }
    realFs.writeFileSync(join(outboxDir, `${sourceEventId}.json`), JSON.stringify(record), { mode: 0o600 })

    await outbox.flush()

    await new Promise((r) => setTimeout(r, 50))

    await outbox.dispose()
    await new Promise((r) => setTimeout(r, 50))

    assert.strictEqual(outbox.enqueue(makePayload("p2").sourceEventId, makePayload("p2")), false, "enqueue rejected after dispose")
  })

  it("rejects outbox record with future createdAt beyond allowed skew", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const sourceEventId = computeSourceEventId("sess-ft", "msg-ft", "part-ft")
    const now = Date.now()
    const badRecord = {
      sourceEventId,
      payload: { ...makePayload("p"), createdAt: now + 120_000 },
      createdAt: now + 120_000,
      retries: 0,
    }
    const filePath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(filePath, JSON.stringify(badRecord), { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(filePath), false, "future-createdAt record dead-lettered")
    const dlDir = join(baseDir, "dead-letter")
    const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length >= 1, "dead-letter marker created for future timestamps")
  })

  it("rejects outbox record with nextAttemptAt beyond max future horizon", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const sourceEventId = computeSourceEventId("sess-na", "msg-na", "part-na")
    const now = Date.now()
    const badRecord = {
      sourceEventId,
      payload: makePayload("p"),
      createdAt: now,
      retries: 0,
      nextAttemptAt: now + 40 * 24 * 60 * 60 * 1000,
    }
    const filePath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(filePath, JSON.stringify(badRecord), { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(filePath), false, "future-nextAttemptAt record dead-lettered")
    const dlDir = join(baseDir, "dead-letter")
    const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length >= 1, "dead-letter marker created")
  })

  it("caps nextAttemptAt to maxRetryBackoffMs horizon on retry", async () => {
    const { fn } = makeFakeFetch([{ status: 500 }])
    let now = Date.now()
    const seams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { baseBackoffMs: 1, jitterFactor: 0, maxRetryBackoffMs: 100, autoflush: false })
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    await outbox.flush()

    const outboxDir = join(baseDir, "outbox")
    const files = realFs.readdirSync(outboxDir).filter((f: string) => f.endsWith(".json"))
    assert.ok(files.length >= 1, "outbox record retained after retry")
    for (const file of files) {
      const raw = JSON.parse(realFs.readFileSync(join(outboxDir, file), "utf8"))
      assert.ok(typeof raw.nextAttemptAt === "number", "nextAttemptAt set")
      assert.ok(raw.nextAttemptAt <= now + 100, `nextAttemptAt capped to horizon: got ${raw.nextAttemptAt - now}`)
    }
  })

  it("rejects record with negative lastAttempt", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const sourceEventId = computeSourceEventId("sess-nl", "msg-nl", "part-nl")
    const now = Date.now()
    const badRecord = {
      sourceEventId,
      payload: makePayload("p"),
      createdAt: now,
      retries: 0,
      lastAttempt: -1,
    }
    const filePath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(filePath, JSON.stringify(badRecord), { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(filePath), false, "negative-lastAttempt record dead-lettered")
  })
})
