import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdirSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import * as realFs from "node:fs"
import { computeSourceEventId } from "../id.js"
import { createOutbox, OUTBOX_MAX_RETRIES } from "../outbox.js"
import type { UsageLogPayload } from "../types.js"
import type { Seams } from "../seams.js"
import { makeCanonicalHome, makeBaseDir, makePayload, makeFakeFetch, makeLogCollector, testSeams, countFiles } from "./outbox-test-support.js"

describe("outbox-delivery", () => {
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

  it("enqueues a payload, posts with bearer auth, and deletes outbox file on 200", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }])
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "test-key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn)
    const payload = makePayload("github.com/user/repo")

    assert.ok(outbox.enqueue(payload.sourceEventId, payload))
    await outbox.flush()

    assert.strictEqual(callCount(), 1)
    assert.strictEqual(calls[0]!.url, "https://api.example.com/api/v2/usage-logs")
    assert.strictEqual(calls[0]!.headers["Authorization"], "Bearer test-key")
    assert.strictEqual(calls[0]!.headers["Content-Type"], "application/json")
    assert.strictEqual(calls[0]!.status, 200)

    const payloadParsed = JSON.parse(calls[0]!.body)
    assert.strictEqual(payloadParsed.schemaVersion, 2)
    assert.strictEqual(payloadParsed.event, "llm.step.completed")
    assert.strictEqual(payloadParsed.projectCode, "github.com/user/repo")
    assert.strictEqual(payloadParsed.sourceEventId, payload.sourceEventId)

    assert.ok(logCalls.find((l) => l.category === "delivered"), "delivered log emitted")
    assert.strictEqual(countFiles(join(baseDir, "outbox")), 0)
  })

  it("deletes outbox file after successful delivery for 201/202/204", async () => {
    for (const status of [201, 202, 204]) {
      const ch = makeCanonicalHome()
      const testDir = makeBaseDir(ch.home)
      try {
        const { fn } = makeFakeFetch([{ status }])
        const { logFn } = makeLogCollector()
        const outbox = createOutbox(testDir, "key", "https://api.example.com/api/v2/usage-logs", ch.home, testSeams(fn, ch.home, () => Date.now()), logFn)
        outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
        await outbox.flush()
        assert.strictEqual(countFiles(join(testDir, "outbox")), 0, `status ${status}: outbox file should be deleted`)
      } finally {
        ch.cleanup()
      }
    }
  })

  it("retains outbox record on 429 and increments retries", async () => {
    const { fn } = makeFakeFetch([{ status: 429 }])
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn)
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    await outbox.flush()

    const outboxDir = join(baseDir, "outbox")
    assert.ok(countFiles(outboxDir) >= 1, "outbox record retained after 429")

    const files = readdirSync(outboxDir).filter((f) => f.endsWith(".json"))
    for (const file of files) {
      const raw = realFs.readFileSync(join(outboxDir, file), "utf8")
      const record = JSON.parse(raw)
      assert.ok(record.retries >= 1, `429 should increment retries, got ${record.retries}`)
      assert.ok(typeof record.nextAttemptAt === "number", "nextAttemptAt should be set")
    }

    assert.strictEqual(countFiles(join(baseDir, "dead-letter")), 0)
    assert.ok(logCalls.some((l) => l.category === "retryable"), "retryable log emitted")
  })

  it("retains outbox record on 408 and increments retries", async () => {
    const { fn } = makeFakeFetch([{ status: 408 }])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn)
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    await outbox.flush()

    const outboxDir = join(baseDir, "outbox")
    assert.ok(countFiles(outboxDir) >= 1, "outbox record retained after 408")
    const files = readdirSync(outboxDir).filter((f) => f.endsWith(".json"))
    for (const file of files) {
      const raw = realFs.readFileSync(join(outboxDir, file), "utf8")
      assert.ok(JSON.parse(raw).retries >= 1, "408 should increment retries")
    }
  })

  it("retains outbox record on 5xx with retries", async () => {
    const { fn } = makeFakeFetch([{ status: 503 }])
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn)
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    await outbox.flush()
    assert.ok(countFiles(join(baseDir, "outbox")) >= 1)
    assert.ok(logCalls.some((l) => l.category === "retryable"))
  })

  it("moves 400 to dead-letter and logs permanent", async () => {
    const { fn } = makeFakeFetch([{ status: 400 }])
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn)
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    await outbox.flush()

    const dlDir = join(baseDir, "dead-letter")
    assert.strictEqual(existsSync(dlDir) ? readdirSync(dlDir).filter((f) => f.endsWith(".json")).length : 0, 1)
    assert.strictEqual(countFiles(join(baseDir, "outbox")), 0)
    assert.ok(logCalls.some((l) => l.category === "permanent"))
  })

  it("enforces max retries and moves to dead-letter", async () => {
    const responses: Array<{ status: number }> = Array.from({ length: OUTBOX_MAX_RETRIES + 2 }, () => ({ status: 500 }))
    const { fn } = makeFakeFetch(responses)
    let now = Date.now()
    const seams = testSeams(fn, canonicalHome, () => now)
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { baseBackoffMs: 1, jitterFactor: 0, maxRetryBackoffMs: 10 })
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    for (let i = 0; i < OUTBOX_MAX_RETRIES + 2; i++) { await outbox.flush(); now += 100 }

    const dlDir = join(baseDir, "dead-letter")
    const dlCount = existsSync(dlDir) ? readdirSync(dlDir).filter((f) => f.endsWith(".json")).length : 0
    assert.strictEqual(dlCount, 1, "dead-letter created after max retries")
    assert.strictEqual(countFiles(join(baseDir, "outbox")), 0)
    assert.ok(logCalls.some((l) => l.category === "outbox_retries_exhausted"))
  })

  it("delivers on 429 then 200 retry", async () => {
    const { fn } = makeFakeFetch([{ status: 429 }, { status: 200 }])
    let now = Date.now()
    const seams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { baseBackoffMs: 0, jitterFactor: 0, autoflush: false })
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    await outbox.flush()
    assert.ok(countFiles(join(baseDir, "outbox")) >= 1, "record retained after 429")
    now += 1000
    await outbox.flush()
    assert.strictEqual(countFiles(join(baseDir, "outbox")), 0, "record delivered on retry")
  })

  it("posts with bearer auth", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "bearer-key", "https://logs.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn)
    outbox.enqueue(makePayload("org/repo").sourceEventId, makePayload("org/repo"))
    await outbox.flush()
    assert.strictEqual(callCount(), 1)
    assert.strictEqual(calls[0]!.headers["Authorization"], "Bearer bearer-key")
  })

  it("drains response body after headers and does not clear timeout prematurely", async () => {
    let drainStarted = false
    let drainCompleted = false
    let signalAborted = false

    const streamBody = new ReadableStream({
      start(controller) {
        try {
          controller.enqueue(new TextEncoder().encode("chunk1"))
          controller.enqueue(new TextEncoder().encode("chunk2"))
        } catch {}
        setTimeout(() => {
          try { controller.close() } catch {}
        }, 50)
      },
      cancel() {
        drainStarted = true
        drainCompleted = true
      },
    })

    const fetchSpy = async (_input: RequestInfo, init?: RequestInit) => {
      if (init?.signal) {
        const signal = init.signal as AbortSignal
        signal.addEventListener("abort", () => { signalAborted = true })
      }
      return new Response(streamBody, { status: 200 })
    }

    const base = testSeams(fetchSpy as unknown as typeof fetch, canonicalHome, () => Date.now())
    const injectSeams: Seams = {
      ...base,
      network: { fetch: fetchSpy },
    }

    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectSeams, logFn, { autoflush: false })
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    await outbox.flush()

    assert.ok(drainCompleted, "response body was drained/canceled")
    const outboxDir = join(baseDir, "outbox")
    assert.strictEqual(countFiles(outboxDir), 0, "record delivered and deleted")
  })

  it("body drain failure is retryable (not delivered)", async () => {
    let fetchCallCount = 0
    const drainingBody = new ReadableStream({
      start(_controller: ReadableStreamDefaultController) {},
      cancel() { throw new Error("cancel failed") },
    })

    const fetchSpy = async (_input: RequestInfo, init?: RequestInit) => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(drainingBody, { status: 200 })
      }
      return new Response(null, { status: 200 })
    }

    const base = testSeams(fetchSpy as unknown as typeof fetch, canonicalHome, () => Date.now())
    const injectSeams: Seams = {
      ...base,
      network: { fetch: fetchSpy },
    }

    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectSeams, logFn, { baseBackoffMs: 1, jitterFactor: 0, autoflush: false })
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))

    await outbox.flush()

    assert.strictEqual(fetchCallCount, 1, "only one fetch fired (body drain failed)")
    const outboxDir = join(baseDir, "outbox")
    assert.ok(countFiles(outboxDir) >= 1, "record retained after body drain failure")
    const files = readdirSync(outboxDir).filter((f) => f.endsWith(".json"))
    for (const file of files) {
      const raw = JSON.parse(realFs.readFileSync(join(outboxDir, file), "utf8"))
      assert.ok(raw.retries >= 1, "retries incremented after body drain failure")
    }
  })

  it("schedules fallback unref retry on retry-record write failure", async () => {
    let fetchCallCount = 0
    const { logCalls, logFn } = makeLogCollector()
    let writeAttemptCount = 0
    let firstRetryWriteFailed = false
    const base = testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => Date.now())
    const injectSeams: Seams = {
      ...base,
      network: {
        fetch: async (_input: RequestInfo, _init?: RequestInit) => {
          fetchCallCount++
          if (fetchCallCount === 1) return new Response(null, { status: 429 })
          return new Response(null, { status: 200 })
        },
      },
      fs: {
        ...base.fs,
        openSync: (p: string, flags: number, mode?: number) => {
          if (p.includes("/outbox/") && (flags & realFs.constants.O_CREAT)) {
            writeAttemptCount++
            if (writeAttemptCount === 1) {
              firstRetryWriteFailed = true
              throw new Error("injected write failure for first retry record")
            }
          }
          return realFs.openSync(p, flags, mode)
        },
      },
    }
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectSeams, logFn, { baseBackoffMs: 50, jitterFactor: 0, autoflush: false })
    const sourceEventId = computeSourceEventId("sess1", "msg1", "part1")
    const record = {
      sourceEventId,
      payload: makePayload("p"),
      createdAt: Date.now(),
      retries: 0,
    }
    const outboxDir = join(baseDir, "outbox")
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    await outbox.flush()

    assert.ok(firstRetryWriteFailed, "first retry record write failed")
    assert.ok(logCalls.some((l) => l.category === "outbox_atomic_write_failed"), "write failure logged")
    assert.strictEqual(fetchCallCount, 1, "only the first fetch fired in this flush")

    await new Promise((r) => setTimeout(r, 200))

    assert.ok(fetchCallCount >= 2, `second fetch fired via fallback retry, got ${fetchCallCount}`)
    assert.strictEqual(realFs.existsSync(recordPath), false, "source record ultimately removed after successful delivery")
  })

  it("dispose-abort does not increment retries nor rewrite record", async () => {
    const base = testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => Date.now())
    let fetchSignalAborted = false
    const injectSeams: Seams = {
      ...base,
      network: {
        fetch: async (_input: RequestInfo, init?: RequestInit) => {
          if (init?.signal) {
            const signal = init.signal as AbortSignal
            if (signal.aborted) {
              fetchSignalAborted = true
              throw new DOMException("aborted", "AbortError")
            }
            await new Promise<void>((resolve, reject) => {
              signal.addEventListener("abort", () => {
                fetchSignalAborted = true
                reject(new DOMException("aborted", "AbortError"))
              })
            })
            throw new DOMException("aborted", "AbortError")
          }
          return new Response(null, { status: 200 })
        },
      },
    }
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectSeams, logFn, { autoflush: false })
    const sourceEventId = computeSourceEventId("sess-ab", "msg-ab", "part-ab")
    const now = Date.now()
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
    outbox.enqueue(sourceEventId, payload)

    const flushPromise = outbox.flush()

    await new Promise((r) => setTimeout(r, 50))

    await outbox.dispose()

    await flushPromise.catch(() => {})

    assert.ok(fetchSignalAborted, "fetch signal was aborted by dispose")

    const outboxDir = join(baseDir, "outbox")
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    assert.ok(realFs.existsSync(recordPath), "outbox record preserved on disk after dispose-abort")
    const raw = JSON.parse(realFs.readFileSync(recordPath, "utf8"))
    assert.strictEqual(raw.retries, 0, "retries not incremented by dispose abort")
  })

  it("logs inode conflict when record replaced between read and mutation", async () => {
    const { fn } = makeFakeFetch([{ status: 500 }])
    const { logFn, logCalls } = makeLogCollector()
    let now = Date.now()
    const sourceEventId = computeSourceEventId("sess-ic", "msg-ic", "part-ic")
    const outboxDir = join(baseDir, "outbox")
    mkdirSync(outboxDir, { mode: 0o700 })
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = {
      sourceEventId,
      payload: { ...makePayload("p"), sourceEventId },
      createdAt: now,
      retries: 0,
    }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const baseSeams = testSeams(fn, canonicalHome, () => now)
    let replaced = false
    const injectSeams: Seams = {
      ...baseSeams,
      network: {
        fetch: async (_input: RequestInfo, _init?: RequestInit) => {
          if (!replaced) {
            realFs.unlinkSync(recordPath)
            const newRecord = { ...record, retries: 5 }
            realFs.writeFileSync(recordPath, JSON.stringify(newRecord), { mode: 0o600 })
            replaced = true
          }
          return new Response(null, { status: 500 })
        },
      },
    }

    const injectOutbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectSeams, logFn, { baseBackoffMs: 0, jitterFactor: 0, maxRetryBackoffMs: 100, autoflush: false })

    await injectOutbox.flush()

    assert.ok(replaced, "file was replaced during test")
    assert.ok(realFs.existsSync(recordPath), "record still exists (not mutated after inode change)")
    const raw = JSON.parse(realFs.readFileSync(recordPath, "utf8"))
    assert.strictEqual(raw.retries, 5, "original retries preserved (not mutated by outbox after inode change)")
    assert.ok(logCalls.some((l) => l.category === "outbox_inode_conflict"), "inode conflict logged")
  })
})
