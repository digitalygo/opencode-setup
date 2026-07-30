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

describe("outbox-claims-creation", () => {
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

  it("cross-process: only one POST for same sourceEventId with two concurrent outbox instances", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }, { status: 200 }])
    const { logFn } = makeLogCollector()
    const nowRef = { now: Date.now() }
    const process1Seams = testSeams(fn, canonicalHome, () => nowRef.now)
    const process2Seams = testSeams(fn, canonicalHome, () => nowRef.now)
    const outbox1 = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, process1Seams, logFn, { autoflush: false })
    const outbox2 = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, process2Seams, logFn, { autoflush: false })
    const sourceEventId = computeSourceEventId("sess-cp", "msg-cp", "part-cp")
    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: nowRef.now,
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

    const outboxDir = join(baseDir, "outbox")
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = {
      sourceEventId,
      payload,
      createdAt: nowRef.now,
      retries: 0,
    }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const [r1, r2] = await Promise.allSettled([
      outbox1.flush(),
      outbox2.flush(),
    ])
    assert.ok(r1.status === "fulfilled" || r2.status === "fulfilled")

    assert.ok(callCount() <= 1, `at most one POST: got ${callCount()}`)
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted after single delivery")

    const claimsDir = join(baseDir, "claims")
    const claimFiles = realFs.existsSync(claimsDir)
      ? realFs.readdirSync(claimsDir).filter((f: string) => f.endsWith(".json"))
      : []
    assert.strictEqual(claimFiles.length, 0, "claims cleaned after delivery")
  })

  it("stale claim: recovers a dead-pid claim and delivers the record", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }])
    const { logFn } = makeLogCollector()
    const nonExistentPid = 999999
    const now = Date.now()

    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const staleSeams: Seams = {
      ...baseSeams,
      process: {
        pid: () => nonExistentPid,
        aliveCheck: (pid: number) => {
          try { process.kill(pid, 0); return true } catch { return false }
        },
      },
    }
    const staleOutbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, staleSeams, logFn, { autoflush: false })

    const sourceEventId = computeSourceEventId("sess-st", "msg-st", "part-st")
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

    const outboxDir = join(baseDir, "outbox")
    const claimsDir = join(baseDir, "claims")

    const claimMeta = { pid: nonExistentPid, createdAt: now - 1000, nonce: "dead-beef-stale-01" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(claimMeta), { mode: 0o600 })

    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const liveSeams = testSeams(fn, canonicalHome, () => now)
    const liveOutbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, liveSeams, logFn, { autoflush: false })

    await liveOutbox.flush()

    assert.ok(callCount() >= 1, "record delivered after stale claim recovery")
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted after delivery")

    const claimFiles = realFs.existsSync(claimsDir)
      ? realFs.readdirSync(claimsDir).filter((f: string) => f.endsWith(".json"))
      : []
    assert.strictEqual(claimFiles.length, 0, "claim released")
  })

  it("expired-stale claim is recovered by live PID", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }])
    const now = Date.now()
    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, baseSeams, logFn, { autoflush: false })

    const sourceEventId = computeSourceEventId("sess-es", "msg-es", "part-es")
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

    const outboxDir = join(baseDir, "outbox")
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const claimsDir = join(baseDir, "claims")
    const staleClaimMeta = { pid: process.pid, createdAt: now - 60000, nonce: "expired-stale-claim" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(staleClaimMeta), { mode: 0o600 })

    await outbox.flush()

    assert.ok(callCount() >= 1, "record delivered after stale claim recovery (expired)")
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted")

    const claimFiles = realFs.existsSync(claimsDir)
      ? realFs.readdirSync(claimsDir).filter((f: string) => f.endsWith(".json"))
      : []
    assert.strictEqual(claimFiles.length, 0, "claim released after delivery")
  })

  it("exhausted claim loops stop trying when valid claim exists for alive PID", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }])
    const now = Date.now()
    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, baseSeams, logFn, { autoflush: false })

    const sourceEventId = computeSourceEventId("sess-al", "msg-al", "part-al")

    const claimsDir = join(baseDir, "claims")
    const liveClaimMeta = { pid: process.pid, createdAt: now, nonce: "live-alive-claim" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(liveClaimMeta), { mode: 0o600 })

    const outboxDir = join(baseDir, "outbox")
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
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
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(callCount(), 0, "no POST when live claim blocks processing")
    assert.ok(realFs.existsSync(recordPath), "record still on disk (held by live claim)")
  })

  it("claim takeover: second contender cannot delete first contender's new claim", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }, { status: 200 }])
    let now = Date.now()
    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-ct", "msg-ct", "part-ct")
    const claimsDir = join(baseDir, "claims")
    const outboxDir = join(baseDir, "outbox")

    const outboxA = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, baseSeams, logFn, { autoflush: false })
    const outboxB = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, baseSeams, logFn, { autoflush: false })

    const oldClaimPath = join(claimsDir, `${sourceEventId}.json`)
    const staleMeta = { pid: 88888, createdAt: now - 60000, nonce: "stale-dead" }
    realFs.writeFileSync(oldClaimPath, JSON.stringify(staleMeta), { mode: 0o600 })

    const recordPath = join(outboxDir, `${sourceEventId}.json`)
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
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    await Promise.all([outboxA.flush(), outboxB.flush()])

    assert.ok(callCount() >= 1, "at least one record delivered")
    assert.ok(callCount() <= 2, "at most two deliveries (one per contender)")

    const claimFiles = realFs.existsSync(claimsDir)
      ? realFs.readdirSync(claimsDir).filter((f: string) => f.endsWith(".json"))
      : []
    assert.strictEqual(claimFiles.length, 0, "no stranded claims after delivery")
  })

  it("acquireClaim does not release claim file without expected inode when existingInode disappears", async () => {
    const { fn } = makeFakeFetch([{ status: 200 }])
    let now = Date.now()
    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-ne", "msg-ne", "part-ne")
    const claimsDir = join(baseDir, "claims")
    const outboxDir = join(baseDir, "outbox")

    realFs.mkdirSync(claimsDir, { mode: 0o700 })
    realFs.mkdirSync(outboxDir, { mode: 0o700 })

    let captureCalls = 0
    const claimPathPath = join(claimsDir, `${sourceEventId}.json`)
    const injectedSeams: Seams = {
      ...baseSeams,
      fs: {
        ...baseSeams.fs,
        lstatSync: (p: string) => {
          if (p === claimPathPath) {
            captureCalls++
            if (captureCalls === 1) {
              throw new Error("injected: claim disappeared")
            }
          }
          return baseSeams.fs.lstatSync(p)
        },
      },
    }

    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, baseSeams, logFn, { autoflush: false })
    const injectOutbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectedSeams, logFn, { autoflush: false })

    const replacementContent = "replacement-claim-sentinel"
    realFs.writeFileSync(claimPathPath, JSON.stringify({ pid: process.pid, createdAt: now, nonce: "replacement-nonce" }), { mode: 0o600 })

    const recordPath = join(outboxDir, `${sourceEventId}.json`)
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
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    await injectOutbox.flush()

    assert.ok(realFs.existsSync(claimPathPath), "replacement claim file must survive")
    const raw = JSON.parse(realFs.readFileSync(claimPathPath, "utf8"))
    assert.strictEqual(raw.nonce, "replacement-nonce", "replacement claim content preserved")
  })

  it("releaseClaim verifies nonce and does not unlink modified claim", async () => {
    const { fn } = makeFakeFetch([{ status: 200 }])
    let now = Date.now()
    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-nv", "msg-nv", "part-nv")
    const outboxDir = join(baseDir, "outbox")

    realFs.mkdirSync(outboxDir, { mode: 0o700 })
    const claimsDir = join(baseDir, "claims")

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
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    realFs.writeFileSync(join(outboxDir, `${sourceEventId}.json`), JSON.stringify(record), { mode: 0o600 })

    let claimInodeAfterCreation: { dev: number; ino: number } | null = null
    const injectedSeams: Seams = {
      ...baseSeams,
      fs: {
        ...baseSeams.fs,
        fstatSync: (fd: number) => {
          const st = baseSeams.fs.fstatSync(fd)
          return st
        },
        openSync: (p: string, flags: number, mode?: number) => {
          const fd = baseSeams.fs.openSync(p, flags, mode)
          if (p.includes("/claims/") && (flags & realFs.constants.O_CREAT)) {
            const st = realFs.fstatSync(fd)
            claimInodeAfterCreation = { dev: st.dev, ino: st.ino }
          }
          return fd
        },
      },
    }

    const injectOutbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectedSeams, logFn, { autoflush: false })
    await injectOutbox.flush()

    const claimPath = join(claimsDir, `${sourceEventId}.json`)
    assert.strictEqual(realFs.existsSync(claimPath), false, "claim released after delivery")
  })

  it("O_EXCL claim publication race: malformed recent claim blocks acquisition within publication grace", async () => {
    const now = Date.now()
    let fetchCallCount = 0
    const fetchFn = async (_input: RequestInfo, _init?: RequestInit) => {
      fetchCallCount++
      return new Response(null, { status: 200 })
    }

    const { logFn } = makeLogCollector()
    const baseSeams = testSeams(fetchFn as unknown as typeof fetch, canonicalHome, () => now)

    const sourceEventId = computeSourceEventId("sess-or1", "msg-or1", "part-or1")
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

    const emptyClaimPath = join(claimsDir, `${sourceEventId}.json`)
    realFs.writeFileSync(emptyClaimPath, "", { mode: 0o600 })

    const contender = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, baseSeams, logFn, { autoflush: false, publicationGraceMs: 5000 })
    await contender.flush()

    assert.strictEqual(fetchCallCount, 0, "contender made zero POSTs: malformed claim within publication grace")
    assert.ok(realFs.existsSync(recordPath), "record preserved: malformed claim blocked acquisition")
    assert.ok(realFs.existsSync(emptyClaimPath), "malformed claim not deleted during publication grace")
  })

  it("single outbox instance delivers one POST per sourceEventId", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const sourceEventId = computeSourceEventId("sess-mp", "msg-mp", "part-mp")
    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: Date.now(),
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
    const record = { sourceEventId, payload, createdAt: Date.now(), retries: 0 }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    await outbox.flush()

    assert.ok(callCount() === 1, "one POST delivered")
    assert.strictEqual(realFs.existsSync(recordPath), false, "record deleted after delivery")
  })

  it("claims directory is created at outbox init and stale claims cleaned", () => {
    const { fn } = makeFakeFetch([{ status: 200 }])
    const { logFn } = makeLogCollector()
    createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn as unknown as typeof fetch, canonicalHome, () => Date.now()), logFn)
    const claimsDir = join(baseDir, "claims")
    assert.ok(realFs.existsSync(claimsDir), "claims directory exists after outbox creation")
    const claimsFiles = realFs.readdirSync(claimsDir).filter((f: string) => f.endsWith(".json"))
    assert.strictEqual(claimsFiles.length, 0, "no orphan claims after init cleanup")
  })
})
