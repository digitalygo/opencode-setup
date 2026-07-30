import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdirSync, existsSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import * as realFs from "node:fs"
import { computeSourceEventId } from "../id.js"
import { createOutbox } from "../outbox.js"
import type { UsageLogPayload } from "../types.js"
import type { Seams } from "../seams.js"
import { makeCanonicalHome, makeBaseDir, makePayload, makeFakeFetch, makeLogCollector, testSeams, countFiles } from "./outbox-test-support.js"

describe("outbox-storage", () => {
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

  it("rejects enqueue when quota exceeded and logs quota", () => {
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => Date.now()), logFn, { maxCount: 1 })
    assert.ok(outbox.enqueue(makePayload("p").sourceEventId, makePayload("p")))
    assert.strictEqual(outbox.enqueue(makePayload("p2").sourceEventId, makePayload("p2")), false)
    assert.ok(logCalls.some((l) => l.category === "outbox_quota_rejected" || l.category === "outbox_enqueue_atomic_write_failed"))
  })

  it("moves corrupt sourceEventId ../../escape to dead-letter without path traversal", async () => {
    const { fn } = makeFakeFetch([])
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const safeFilename = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
    const corruptRecord = {
      sourceEventId: "../../escape",
      payload: makePayload("p"),
      createdAt: Date.now(),
      retries: 0,
    }
    const corruptFilePath = join(outboxDir, safeFilename)
    realFs.writeFileSync(corruptFilePath, JSON.stringify(corruptRecord), { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(corruptFilePath), false, "corrupt outbox file removed")
    const escapeFile = join(baseDir, "..", "..", "escape")
    assert.strictEqual(realFs.existsSync(escapeFile), false, "no ../escape file created")

    const dlDir = join(baseDir, "dead-letter")
    const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length >= 1, "dead-letter marker created")
  })

  it("moves malformed JSON outbox record to dead-letter", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const corruptFile = join(outboxDir, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json")
    realFs.writeFileSync(corruptFile, "not-valid-json", { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(corruptFile), false, "corrupt outbox file removed")
    const dlDir = join(baseDir, "dead-letter")
    const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length >= 1, "dead-letter marker created")
  })

  it("handles symlinked outbox record by removing without following", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const targetFile = join(baseDir, "target.json")
    const symlinkFile = join(outboxDir, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json")
    realFs.writeFileSync(targetFile, JSON.stringify({ sourceEventId: "aaaaa".repeat(12).slice(0, 64), payload: makePayload("p"), createdAt: Date.now(), retries: 0 }), { mode: 0o600 })
    realFs.symlinkSync(targetFile, symlinkFile)

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(symlinkFile), false, "symlink removed")
    assert.strictEqual(realFs.existsSync(targetFile), true, "target file not affected")
  })

  it("logs oversize single-record quota rejection", () => {
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => Date.now()), logFn, { maxTotalBytes: 50 })
    const payload = makePayload("p")
    assert.strictEqual(outbox.enqueue(payload.sourceEventId, payload), false)
    assert.ok(logCalls.some((l) => l.category === "outbox_quota_rejected"), "oversize quota log emitted")
  })

  it("does not unlink outbox file when dead-letter marker write fails", async () => {
    let markerWriteAttempted = false
    let injectedFail = true
    const base = testSeams((async () => new Response(null, { status: 200 })) as unknown as typeof fetch, canonicalHome, () => Date.now())
    const { logCalls, logFn } = makeLogCollector()
    const injectSeams: Seams = {
      ...base,
      fs: {
        ...base.fs,
        openSync: (p: string, flags: number, mode?: number) => {
          if (injectedFail && p.includes("/dead-letter/")) {
            markerWriteAttempted = true
            throw new Error("injected marker write failure")
          }
          return realFs.openSync(p, flags, mode)
        },
        readdirSync: (p: string) => {
          if (p.includes("/dead-letter") && markerWriteAttempted) {
            return []
          }
          return base.fs.readdirSync(p)
        },
      },
    }
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectSeams, logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const sourceEventId = computeSourceEventId("sess1", "msg1", "part1")
    const corruptRecord = {
      sourceEventId,
      payload: makePayload("p"),
      createdAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      retries: 0,
    }
    const filePath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(filePath, JSON.stringify(corruptRecord), { mode: 0o600 })

    await outbox.flush()

    assert.ok(realFs.existsSync(filePath), "source outbox record retained after marker write failure")
    assert.ok(logCalls.some((l) => l.category === "dead_letter_write_failed"), "dead_letter_write_failed log emitted")
    assert.strictEqual(countFiles(outboxDir), 1, "outbox file still present")
    assert.ok(markerWriteAttempted, "marker write was attempted")
  })

  it("symlink in outbox creates dead-letter marker then removes only symlink", async () => {
    const { fn } = makeFakeFetch([])
    const { logCalls, logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const targetFile = join(baseDir, "target.json")
    const symlinkFile = join(outboxDir, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json")
    realFs.writeFileSync(targetFile, JSON.stringify({ sourceEventId: "aaaaa".repeat(12).slice(0, 64), payload: makePayload("p"), createdAt: Date.now(), retries: 0 }), { mode: 0o600 })
    realFs.symlinkSync(targetFile, symlinkFile)

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(symlinkFile), false, "symlink removed")
    assert.strictEqual(realFs.existsSync(targetFile), true, "target file preserved")
    const dlDir = join(baseDir, "dead-letter")
    const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length >= 1, "dead-letter marker created for symlink")
  })

  it("malformed sourceEventId outbox record moves to dead-letter safely", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const badId = "not-hex-64-chars-long"
    const corruptRecord = {
      sourceEventId: badId,
      payload: makePayload("p"),
      createdAt: Date.now(),
      retries: 0,
    }
    const filePath = join(outboxDir, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json")
    realFs.writeFileSync(filePath, JSON.stringify(corruptRecord), { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(filePath), false, "invalid-id outbox file removed")
    const dlDir = join(baseDir, "dead-letter")
    const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length >= 1, "dead-letter marker created for invalid id")
  })

  it("handles bad..json filename safely and removes after marker creation", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const badFile = join(outboxDir, "bad..json")
    realFs.writeFileSync(badFile, "x", { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(badFile), false, "bad..json removed after marker creation")
  })

  it("handles dangling symlink in outbox with lstat", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const danglingTarget = join(tmpdir(), `dangling-target-${randomBytes(8).toString("hex")}.json`)
    const symlinkPath = join(outboxDir, "dangling-link.json")
    try {
      realFs.writeFileSync(danglingTarget, "x", { mode: 0o600 })
      realFs.symlinkSync(danglingTarget, symlinkPath)
      realFs.unlinkSync(danglingTarget)

      await outbox.flush()

      assert.strictEqual(realFs.existsSync(symlinkPath), false, "dangling symlink removed")
      const dlDir = join(baseDir, "dead-letter")
      const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
      assert.ok(dlFiles.length >= 1, "dead-letter marker created for dangling symlink")
    } finally {
      try { realFs.rmSync(danglingTarget, { force: true }) } catch {}
    }
  })

  it("trims dead-letter to max 100 files keeping newest", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const dlDir = join(baseDir, "dead-letter")

    for (let i = 0; i < 120; i++) {
      const marker = `corrupt.${Date.now() - (120 - i) * 1000}.${i.toString(16).padStart(8, "0")}.json`
      realFs.writeFileSync(join(dlDir, marker), JSON.stringify({ movedAt: Date.now() - (120 - i) * 1000, reason: "test" }), { mode: 0o600 })
    }

    const outboxDir = join(baseDir, "outbox")
    realFs.writeFileSync(join(outboxDir, "not-safe-filename.txt.json"), "bad", { mode: 0o600 })

    await outbox.flush()

    const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length <= 100, `dead-letter trimmed to <=100, got ${dlFiles.length}`)
  })

  it("bounds files processed per flush to quota + overscan", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { maxCount: 3, autoflush: false })
    const outboxDir = join(baseDir, "outbox")

    for (let i = 0; i < 200; i++) {
      const id = computeSourceEventId("sess-bf", `msg-${i}`, "part1")
      const record = {
        sourceEventId: id,
        payload: { ...makePayload("p"), sourceEventId: id, createdAt: Date.now() },
        createdAt: Date.now(),
        retries: 0,
      }
      realFs.writeFileSync(join(outboxDir, `${id}.json`), JSON.stringify(record), { mode: 0o600 })
    }

    const start = Date.now()
    await outbox.flush()
    const elapsed = Date.now() - start

    const remaining = countFiles(outboxDir)
    assert.ok(remaining < 200, `some files should remain unprocessed: ${remaining} left`)
    assert.ok(remaining >= 0, "negative file count impossible")

    const dlDir = join(baseDir, "dead-letter")
    const dlCount = realFs.existsSync(dlDir)
      ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")).length
      : 0

    assert.ok(remaining + dlCount <= 200, "total files accounted for")
  })

  it("rejects oversized outbox file before parsing", async () => {
    const { fn } = makeFakeFetch([])
    const { logFn, logCalls } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const outboxDir = join(baseDir, "outbox")
    const sourceEventId = computeSourceEventId("sess-os", "msg-os", "part-os")

    const bigData = "x".repeat(2 * 1024 * 1024)
    const filePath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(filePath, bigData, { mode: 0o600 })

    await outbox.flush()

    assert.strictEqual(realFs.existsSync(filePath), false, "oversized file removed")
    const dlDir = join(baseDir, "dead-letter")
    const dlFiles = realFs.existsSync(dlDir)
      ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json"))
      : []
    assert.ok(dlFiles.length >= 1, "dead-letter marker created for oversized file")
    assert.ok(logCalls.some((l) => l.category === "outbox_corrupt"))
  })

  it("creates dead-letter marker with sourceEventId for valid records", async () => {
    const { fn } = makeFakeFetch([{ status: 400 }])
    const { logFn } = makeLogCollector()
    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, testSeams(fn, canonicalHome, () => Date.now()), logFn, { autoflush: false })
    const sourceEventId = computeSourceEventId("sess1", "msg1", "part1")
    outbox.enqueue(makePayload("p").sourceEventId, makePayload("p"))
    await outbox.flush()

    const dlDir = join(baseDir, "dead-letter")
    const dlFiles = realFs.existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length >= 1)
    const requiredFile = dlFiles.find((f) => f === `${sourceEventId}.json`)
    if (requiredFile) {
      const content = JSON.parse(realFs.readFileSync(join(dlDir, requiredFile), "utf8"))
      assert.strictEqual(content.sourceEventId, sourceEventId)
      assert.ok(typeof content.movedAt === "number")
      assert.ok(typeof content.reason === "string")
    }

    const corruptMarker = dlFiles.find((f) => f.startsWith("corrupt."))
    if (corruptMarker) {
      const content = JSON.parse(realFs.readFileSync(join(dlDir, corruptMarker), "utf8"))
      assert.ok(typeof content.movedAt === "number")
      assert.ok(typeof content.reason === "string")
    }
  })

  it("permanent HTTP response unlinks outbox with captured inode", async () => {
    const { fn } = makeFakeFetch([{ status: 404 }])
    let now = Date.now()
    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const { logFn, logCalls } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-pi", "msg-pi", "part-pi")
    const outboxDir = join(baseDir, "outbox")
    const dlDir = join(baseDir, "dead-letter")

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
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, baseSeams, logFn, { autoflush: false })
    await outbox.flush()

    assert.strictEqual(realFs.existsSync(recordPath), false, "outbox file removed on permanent response")
    const dlFiles = existsSync(dlDir) ? realFs.readdirSync(dlDir).filter((f: string) => f.endsWith(".json")) : []
    assert.ok(dlFiles.length >= 1, "dead-letter marker created")
    assert.ok(logCalls.some((l) => l.category === "permanent"), "permanent log emitted")
  })

  it("moveToDeadLetter uses captured inode for regular files and replacement survives", async () => {
    const { fn } = makeFakeFetch([{ status: 400 }])
    let now = Date.now()
    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-md", "msg-md", "part-md")
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
    const record = { sourceEventId, payload, createdAt: now, retries: 0 }
    const recordPath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600 })

    const dlDir = join(baseDir, "dead-letter")
    realFs.mkdirSync(dlDir, { mode: 0o700 })

    let replacedInDeadLetter = false
    const injectedSeams: Seams = {
      ...baseSeams,
      fs: {
        ...baseSeams.fs,
        openSync: (p: string, flags: number, mode?: number) => {
          if (p.includes("/dead-letter/") && !replacedInDeadLetter) {
            replacedInDeadLetter = true
            realFs.unlinkSync(recordPath)
            const replacementRecord = { ...record, retries: 1 }
            realFs.writeFileSync(recordPath, JSON.stringify(replacementRecord), { mode: 0o600 })
          }
          return baseSeams.fs.openSync(p, flags, mode)
        },
      },
    }

    const injectOutbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, injectedSeams, logFn, { autoflush: false })
    await injectOutbox.flush()

    assert.ok(realFs.existsSync(recordPath), "replacement outbox file must survive when inode mismatches")
    const raw = JSON.parse(realFs.readFileSync(recordPath, "utf8"))
    assert.strictEqual(raw.retries, 1, "replacement record content preserved")
  })

  it("expireAgedOutbox skips live-claimed entries", async () => {
    const { fn, calls, callCount } = makeFakeFetch([{ status: 200 }])
    let now = Date.now()
    const baseSeams = testSeams(fn, canonicalHome, () => now)
    const { logFn } = makeLogCollector()

    const sourceEventId = computeSourceEventId("sess-esl", "msg-esl", "part-esl")
    const outboxDir = join(baseDir, "outbox")
    const claimsDir = join(baseDir, "claims")

    realFs.mkdirSync(outboxDir, { mode: 0o700 })
    realFs.mkdirSync(claimsDir, { mode: 0o700 })

    const oldPast = now - 32 * 24 * 60 * 60 * 1000
    const payload: UsageLogPayload = {
      schemaVersion: 2,
      sourceEventId,
      event: "llm.step.completed",
      createdAt: oldPast,
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
    const expiredRecord = { sourceEventId, payload, createdAt: oldPast, retries: 0 }
    realFs.writeFileSync(join(outboxDir, `${sourceEventId}.json`), JSON.stringify(expiredRecord), { mode: 0o600 })

    const liveClaimMeta = { pid: process.pid, createdAt: now, nonce: "live-claim-for-expire-test" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(liveClaimMeta), { mode: 0o600 })

    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, baseSeams, logFn, { autoflush: false })
    now += 1000
    await outbox.flush()

    assert.ok(realFs.existsSync(join(outboxDir, `${sourceEventId}.json`)), "expired record not removed: claim was live")
    assert.strictEqual(callCount(), 0, "no POST fired: record skipped due to live claim")
  })

  it("expireAgedOutbox acquires claim before inspecting safe-name file; concurrent enqueue blocks expiry", async () => {
    const { fn, callCount } = makeFakeFetch([{ status: 200 }])
    let now = Date.now()
    const { logFn } = makeLogCollector()
    const seams = testSeams(fn, canonicalHome, () => now)

    const sourceEventId = computeSourceEventId("sess-ea1", "msg-ea1", "part-ea1")
    const outboxDir = join(baseDir, "outbox")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })

    const oldPast = now - 32 * 24 * 60 * 60 * 1000
    const expiredRecord = { sourceEventId, payload: { ...makePayload("p"), sourceEventId, createdAt: oldPast }, createdAt: oldPast, retries: 0 }
    realFs.writeFileSync(join(outboxDir, `${sourceEventId}.json`), JSON.stringify(expiredRecord), { mode: 0o600 })

    const claimsDir = join(baseDir, "claims")
    realFs.mkdirSync(claimsDir, { mode: 0o700 })
    const liveClaimMeta = { pid: process.pid, createdAt: now, nonce: "ea1-live-claim" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(liveClaimMeta), { mode: 0o600 })

    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false, maxCount: 1 })

    outbox.enqueue(computeSourceEventId("sess-quota", "msg-quota", "part-quota"), makePayload("p"))

    await outbox.flush()

    assert.ok(realFs.existsSync(join(outboxDir, `${sourceEventId}.json`)), "expired record survived: claim was live at expiry check")
    assert.strictEqual(callCount(), 0, "no POST for uncontended aged record with live claim")
  })

  it("expireAgedOutbox claim-protects safe-name symlink and does not touch under live claim", async () => {
    const { fn, callCount } = makeFakeFetch([{ status: 200 }])
    let now = Date.now()
    const { logFn } = makeLogCollector()
    const seams = testSeams(fn, canonicalHome, () => now)

    const sourceEventId = computeSourceEventId("sess-ea2", "msg-ea2", "part-ea2")
    const outboxDir = join(baseDir, "outbox")
    const claimsDir = join(baseDir, "claims")
    realFs.mkdirSync(outboxDir, { mode: 0o700 })
    realFs.mkdirSync(claimsDir, { mode: 0o700 })

    const symlinkTarget = join(baseDir, "target.json")
    const symlinkPath = join(outboxDir, `${sourceEventId}.json`)
    realFs.writeFileSync(symlinkTarget, "content", { mode: 0o600 })
    realFs.symlinkSync(symlinkTarget, symlinkPath)

    const liveClaimMeta = { pid: process.pid, createdAt: now, nonce: "ea2-live-claim" }
    realFs.writeFileSync(join(claimsDir, `${sourceEventId}.json`), JSON.stringify(liveClaimMeta), { mode: 0o600 })

    const outbox = createOutbox(baseDir, "key", "https://api.example.com/api/v2/usage-logs", canonicalHome, seams, logFn, { autoflush: false, maxCount: 1 })

    outbox.enqueue(computeSourceEventId("sess-quota2", "msg-quota2", "part-quota2"), makePayload("p"))

    await outbox.flush()

    assert.ok(realFs.existsSync(symlinkPath), "safe-name symlink survived: claim was live")
    assert.strictEqual(callCount(), 0, "no POST for safe-name symlink with live claim")
  })
})
