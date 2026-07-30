import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdirSync, rmSync, writeFileSync, symlinkSync, chmodSync, existsSync, readFileSync, openSync, closeSync, readSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { randomBytes, createHash } from "node:crypto"
import { createPendingStore } from "../pending.js"
import { createRealSeams } from "../seams-real.js"
import type { PendingStep } from "../types.js"
import type { Seams } from "../seams.js"

function makeCanonicalHome(): { home: string; cleanup: () => void } {
  const home = join(tmpdir(), `ul-test-chome-${randomBytes(8).toString("hex")}`)
  mkdirSync(home, { mode: 0o700, recursive: true })
  return { home: resolve(home), cleanup: () => { try { rmSync(home, { recursive: true, force: true }) } catch {} } }
}

function makeBaseDir(canonicalHome: string): string {
  const dir = join(canonicalHome, `test-${randomBytes(8).toString("hex")}`)
  mkdirSync(dir, { mode: 0o700 })
  return dir
}

function makeStep(overrides: Partial<PendingStep> = {}): PendingStep {
  return {
    sessionID: "sess1",
    messageID: "msg1",
    partID: "part1",
    cost: 0.01,
    tokens: {
      input: 100,
      output: 50,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    createdAt: Date.now(),
    enqueuedAt: Date.now(),
    ...overrides,
  }
}

describe("createPendingStore", () => {
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

  it("persists and loads a pending step", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams)
    const step = makeStep()
    const ok = store.persist(step)
    assert.ok(ok)

    const loaded = store.load()
    assert.strictEqual(loaded.length, 1)
    assert.strictEqual(loaded[0]!.sessionID, step.sessionID)
    assert.strictEqual(loaded[0]!.messageID, step.messageID)
    assert.strictEqual(loaded[0]!.partID, step.partID)
    assert.strictEqual(loaded[0]!.cost, step.cost)
  })

  it("deletes a pending step after delete", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams)
    store.persist(makeStep())
    store.delete("sess1", "msg1", "part1")
    assert.strictEqual(store.load().length, 0)
  })

  it("enforces pending count quota", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams, { maxCount: 2 })
    assert.ok(store.persist(makeStep({ partID: "p1" })))
    assert.ok(store.persist(makeStep({ partID: "p2" })))
    assert.strictEqual(store.persist(makeStep({ partID: "p3" })), false)
    assert.strictEqual(store.load().length, 2)
  })

  it("enforces byte quota", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams, { maxTotalBytes: 256 })
    assert.ok(store.persist(makeStep({ partID: "p1" })))
    assert.strictEqual(store.persist(makeStep({ partID: "p2" })), false)
  })

  it("expires old pending steps on load", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams, { maxAgeMs: 1 })
    store.persist(makeStep({ enqueuedAt: 0, createdAt: 0 }))
    assert.strictEqual(store.load().length, 0)
  })

  it("rejects invalid pending step data on load", () => {
    const seams = createRealSeams()
    const pendingDir = join(baseDir, "pending")
    mkdirSync(pendingDir, { mode: 0o700 })
    writeFileSync(join(pendingDir, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"), "not json", { mode: 0o400 })
    const store = createPendingStore(baseDir, canonicalHome, seams)
    assert.strictEqual(store.load().filter((s: PendingStep) => s.partID === "badfile").length, 0)
  })

  it("does not unlink files when pending dir is a symlink to external location", () => {
    const seams = createRealSeams()
    const externalDir = join(tmpdir(), `ext-pending-${randomBytes(8).toString("hex")}`)
    mkdirSync(externalDir, { mode: 0o700 })
    const externalFile = join(externalDir, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json")
    const validStep = makeStep({ sessionID: "sess1", messageID: "msg1", partID: "part1" })
    writeFileSync(externalFile, JSON.stringify({
      sessionID: "sess1",
      messageID: "msg1",
      partID: "part1",
      cost: 0.01,
      tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
      createdAt: Date.now(),
      enqueuedAt: Date.now(),
    }), { mode: 0o600 })

    const pendingLink = join(baseDir, "pending")
    symlinkSync(externalDir, pendingLink)

    try {
      assert.throws(
        () => createPendingStore(baseDir, canonicalHome, seams),
        { message: "pending_dir_setup_failed" },
      )
      assert.ok(existsSync(externalFile), "external file is NOT deleted")
      const extContent = JSON.parse(readFileSync(externalFile, "utf8"))
      assert.strictEqual(extContent.sessionID, "sess1")
    } finally {
      try { rmSync(externalDir, { recursive: true, force: true }) } catch {}
    }
  })

  it("rejects pending store when base dir has group/other write bits", () => {
    const seams = createRealSeams()
    chmodSync(baseDir, 0o775)
    assert.throws(
      () => createPendingStore(baseDir, canonicalHome, seams),
      { message: "pending_dir_setup_failed" },
    )
  })

  it("rejects pending store when canonical home has group/other write bits", () => {
    const ch2 = makeCanonicalHome()
    try {
      chmodSync(ch2.home, 0o775)
      const dir2 = makeBaseDir(ch2.home)
      const seams = createRealSeams()
      assert.throws(
        () => createPendingStore(dir2, ch2.home, seams),
        { message: "pending_dir_setup_failed" },
      )
    } finally {
      ch2.cleanup()
    }
  })

  it("persist re-validates dir before each write", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams)
    assert.ok(store.persist(makeStep({ partID: "p1" })))

    chmodSync(baseDir, 0o775)
    assert.strictEqual(store.persist(makeStep({ partID: "p2" })), false, "persist fails after base dir becomes group-writable")
    assert.strictEqual(store.load().length, 0, "load returns empty after base dir becomes group-writable")
  })

  it("delete returns false when dir validation fails", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams)
    store.persist(makeStep())
    chmodSync(baseDir, 0o775)
    const result = store.delete("sess1", "msg1", "part1")
    assert.strictEqual(result, false)
  })

  it("delete emits onDeleteFail when secureUnlink fails", () => {
    const deleteFailPaths: string[] = []
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams, {
      onDeleteFail: (path) => { deleteFailPaths.push(path) },
    })
    store.persist(makeStep({ partID: "p-df" }))
    store.delete("sess1", "msg1", "p-df")
    assert.strictEqual(deleteFailPaths.length, 0, "no failure for valid delete")

    const step2 = makeStep({ sessionID: "sess2", messageID: "msg2", partID: "p2" })
    store.persist(step2)

    chmodSync(baseDir, 0o775)
    const result = store.delete("sess2", "msg2", "p2")
    assert.strictEqual(result, false, "delete returns false when dir invalid")
    assert.ok(deleteFailPaths.length >= 1, "onDeleteFail called for failed delete")
  })

  function fakeSeamsWithFsyncFail(home: string): Seams {
    const real = createRealSeams()
    return {
      ...real,
      platform: {
        ...real.platform,
        homedir: () => home,
      },
      fs: {
        ...real.fs,
        fsyncSync: () => { throw new Error("injected fsync failure") },
      },
    }
  }

  it("expired record delete succeeds with zero onDeleteFail callbacks", () => {
    const failPaths: string[] = []
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams, {
      onDeleteFail: (path) => { failPaths.push(path) },
      maxAgeMs: 1,
    })
    const step = makeStep({ enqueuedAt: 0, createdAt: 0 })
    store.persist(step)
    const loaded = store.load()
    assert.strictEqual(loaded.length, 0, "expired record not loaded")
    assert.strictEqual(failPaths.length, 0, "zero onDeleteFail for successful expired delete")
  })

  it("expired record calls onDeleteFail once when secureUnlink fails", () => {
    const failPaths: string[] = []
    const pendingDir = join(baseDir, "pending")
    mkdirSync(pendingDir, { mode: 0o700 })
    const step = makeStep({ enqueuedAt: 0, createdAt: 0 })
    const raw = JSON.stringify({
      sessionID: step.sessionID,
      messageID: step.messageID,
      partID: step.partID,
      cost: step.cost,
      tokens: step.tokens,
      createdAt: step.createdAt,
      enqueuedAt: step.enqueuedAt,
    })
    const sourceEventId = createHash("sha256")
      .update(`opencode:v1\x00${step.sessionID}\x00${step.messageID}\x00${step.partID}`)
      .digest("hex")
      .toLowerCase()
    const filePath = join(pendingDir, `${sourceEventId}.json`)
    writeFileSync(filePath, raw, { mode: 0o600 })

    const real = createRealSeams()
    let fsyncCount = 0
    const failingSeams: Seams = {
      ...real,
      platform: { ...real.platform, homedir: () => canonicalHome },
      fs: {
        ...real.fs,
        fsyncSync: () => {
          fsyncCount++
          if (fsyncCount > 0) throw new Error("injected fsync failure")
        },
      },
    }
    const store = createPendingStore(baseDir, canonicalHome, failingSeams, {
      onDeleteFail: (path) => { failPaths.push(path) },
      maxAgeMs: 1,
    })
    const loaded = store.load()
    assert.strictEqual(loaded.length, 0, "expired record not loaded")
    assert.strictEqual(failPaths.length, 1, "exactly one onDeleteFail for failed expired delete")
  })

  it("rejects pending step persistent load with future createdAt", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams)
    const future = Date.now() + 600_000
    const data = JSON.stringify({
      sessionID: "sess1",
      messageID: "msg1",
      partID: "part1",
      cost: 0.01,
      tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
      createdAt: future,
      enqueuedAt: future,
    })
    const sourceEventId = createHash("sha256")
      .update("opencode:v1\x00sess1\x00msg1\x00part1")
      .digest("hex")
      .toLowerCase()
    const pendingDir = join(baseDir, "pending")
    writeFileSync(join(pendingDir, `${sourceEventId}.json`), data, { mode: 0o600 })
    const loaded = store.load()
    assert.strictEqual(loaded.length, 0, "load rejects future timestamp beyond skew")
  })

  it("rejects pending step with enqueuedAt before createdAt", () => {
    const seams = createRealSeams()
    const store = createPendingStore(baseDir, canonicalHome, seams)
    const step = makeStep({ createdAt: Date.now(), enqueuedAt: 0 })
    const data = JSON.stringify({
      sessionID: step.sessionID,
      messageID: step.messageID,
      partID: step.partID,
      cost: step.cost,
      tokens: step.tokens,
      createdAt: step.createdAt,
      enqueuedAt: step.enqueuedAt,
    })
    const sourceEventId = createHash("sha256")
      .update(`opencode:v1\x00${step.sessionID}\x00${step.messageID}\x00${step.partID}`)
      .digest("hex")
      .toLowerCase()
    const pendingDir = join(baseDir, "pending")
    writeFileSync(join(pendingDir, `${sourceEventId}.json`), data, { mode: 0o600 })
    const loaded = store.load()
    assert.strictEqual(loaded.length, 0, "load rejects enqueuedAt < createdAt")
  })

  it("rejects pending step with fractional token values on validation", () => {
    const seams = createRealSeams()
    const data = JSON.stringify({
      sessionID: "sess1",
      messageID: "msg1",
      partID: "part1",
      cost: 0.01,
      tokens: { input: 1.5, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
      createdAt: Date.now(),
      enqueuedAt: Date.now(),
    })
    const sourceEventId = createHash("sha256")
      .update(`opencode:v1\x00sess1\x00msg1\x00part1`)
      .digest("hex")
      .toLowerCase()
    const pendingDir = join(baseDir, "pending")
    mkdirSync(pendingDir, { mode: 0o700 })
    writeFileSync(join(pendingDir, `${sourceEventId}.json`), data, { mode: 0o600 })
    const store = createPendingStore(baseDir, canonicalHome, seams)
    const loaded = store.load()
    assert.strictEqual(loaded.length, 0, "fractional token input rejected")
  })

  it("rejects pending step with token value exceeding 1e12 domain cap", () => {
    const seams = createRealSeams()
    const data = JSON.stringify({
      sessionID: "sess1",
      messageID: "msg1",
      partID: "part1",
      cost: 0.01,
      tokens: { input: 2e12, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
      createdAt: Date.now(),
      enqueuedAt: Date.now(),
    })
    const sourceEventId = createHash("sha256")
      .update(`opencode:v1\x00sess1\x00msg1\x00part1`)
      .digest("hex")
      .toLowerCase()
    const pendingDir = join(baseDir, "pending")
    mkdirSync(pendingDir, { mode: 0o700 })
    writeFileSync(join(pendingDir, `${sourceEventId}.json`), data, { mode: 0o600 })
    const store = createPendingStore(baseDir, canonicalHome, seams)
    const loaded = store.load()
    assert.strictEqual(loaded.length, 0, "tokens exceeding 1e12 cap rejected on load")
  })

  it("rejects pending step with huge cost exceeding 1e12 on load", () => {
    const seams = createRealSeams()
    const data = JSON.stringify({
      sessionID: "sess1",
      messageID: "msg1",
      partID: "part1",
      cost: 2e12,
      tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
      createdAt: Date.now(),
      enqueuedAt: Date.now(),
    })
    const sourceEventId = createHash("sha256")
      .update(`opencode:v1\x00sess1\x00msg1\x00part1`)
      .digest("hex")
      .toLowerCase()
    const pendingDir = join(baseDir, "pending")
    mkdirSync(pendingDir, { mode: 0o700 })
    writeFileSync(join(pendingDir, `${sourceEventId}.json`), data, { mode: 0o600 })
    const store = createPendingStore(baseDir, canonicalHome, seams)
    const loaded = store.load()
    assert.strictEqual(loaded.length, 0, "cost exceeding 1e12 cap rejected on load")
  })

  it("load bounds file processing to maxCount plus corrupt allowance", () => {
    const seams = createRealSeams()
    const pendingDir = join(baseDir, "pending")
    mkdirSync(pendingDir, { mode: 0o700 })
    const store = createPendingStore(baseDir, canonicalHome, seams, { maxCount: 5 })
    for (let i = 0; i < 150; i++) {
      const sid = `sess${i}`
      const pid = `part${i}`
      const sourceEventId = createHash("sha256")
        .update(`opencode:v1\x00${sid}\x00msg1\x00${pid}`)
        .digest("hex")
        .toLowerCase()
      writeFileSync(join(pendingDir, `${sourceEventId}.json`), JSON.stringify({
        sessionID: sid, messageID: "msg1", partID: pid,
        cost: 0.01, tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
        createdAt: Date.now(), enqueuedAt: Date.now(),
      }), { mode: 0o600 })
    }
    const loaded = store.load()
    assert.ok(loaded.length <= 105, "load bounded to maxCount + corrupt allowance (5 + 100)")
  })

  it("rejects oversized files before parsing on load", () => {
    const seams = createRealSeams()
    const pendingDir = join(baseDir, "pending")
    mkdirSync(pendingDir, { mode: 0o700 })
    const sourceEventId = createHash("sha256")
      .update(`opencode:v1\x00sess1\x00msg1\x00bigpart`)
      .digest("hex")
      .toLowerCase()
    writeFileSync(join(pendingDir, `${sourceEventId}.json`), "x".repeat(100_000), { mode: 0o600 })
    const store = createPendingStore(baseDir, canonicalHome, seams)
    const loaded = store.load()
    assert.strictEqual(loaded.filter((s: PendingStep) => s.partID === "bigpart").length, 0, "oversize file rejected before parse")
  })
})
