import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdirSync, rmSync, writeFileSync, symlinkSync, statSync, openSync, closeSync, readSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { randomBytes } from "node:crypto"
import { createRealSeams } from "../seams-real.js"
import type { Seams } from "../seams.js"
import {
  secureEnsureDir,
  secureAtomicWrite,
  secureValidateFile,
  secureScanDir,
  secureReadFile,
  secureUnlink,
  containsSymlinkDescendant,
  captureParentIdentity,
  parentIdentityMatches,
  readdirBounded,
} from "../secure-fs.js"

function makeCanonicalHome(): { home: string; seams: Seams; cleanup: () => void } {
  const home = join(tmpdir(), `ul-test-chome-${randomBytes(8).toString("hex")}`)
  mkdirSync(home, { mode: 0o700, recursive: true })
  return { home: resolve(home), seams: createRealSeams(), cleanup: () => { try { rmSync(home, { recursive: true, force: true }) } catch {} } }
}

function makeBaseDir(canonicalHome: string): string {
  const dir = join(canonicalHome, `test-${randomBytes(8).toString("hex")}`)
  mkdirSync(dir, { mode: 0o700 })
  return dir
}

function seamsWithWrongOwner(seams: Seams): Seams {
  return {
    ...seams,
    platform: {
      ...seams.platform,
      getuid: () => 99999,
    },
  }
}

describe("secureEnsureDir", () => {
  let baseDir: string
  let canonicalHome: string
  let seams: Seams
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("creates directory with 0700 mode under canonical home", () => {
    const target = join(baseDir, "newdir")
    const ok = secureEnsureDir(target, canonicalHome, seams)
    assert.ok(ok)
    const st = statSync(target)
    assert.strictEqual(st.mode & 0o777, 0o700)
  })

  it("rejects symlink path component", () => {
    const real = join(tmpdir(), `ul-real-${randomBytes(8).toString("hex")}`)
    mkdirSync(real, { mode: 0o700 })
    const linkTarget = join(baseDir, "linkdir")
    try {
      symlinkSync(real, linkTarget)
      const nested = join(linkTarget, "subdir")
      const ok = secureEnsureDir(nested, canonicalHome, seams)
      assert.strictEqual(ok, false)
    } finally {
      try { rmSync(real, { recursive: true, force: true }) } catch {}
    }
  })

  it("rejects existing non-directory path component", () => {
    const filePath = join(baseDir, "afile")
    writeFileSync(filePath, "data", { mode: 0o600 })
    const nested = join(filePath, "subdir")
    const ok = secureEnsureDir(nested, canonicalHome, seams)
    assert.strictEqual(ok, false)
  })

  it("chmods existing directory to 0700", () => {
    const target = join(baseDir, "exists")
    mkdirSync(target, { mode: 0o755 })
    const ok = secureEnsureDir(target, canonicalHome, seams)
    assert.ok(ok)
    const st = statSync(target)
    assert.strictEqual(st.mode & 0o777, 0o700)
  })

  it("rejects dir outside canonical home", () => {
    const extDir = join(tmpdir(), `ext-${randomBytes(8).toString("hex")}`)
    mkdirSync(extDir, { mode: 0o700 })
    try {
      const ok = secureEnsureDir(extDir, canonicalHome, seams)
      assert.strictEqual(ok, false)
    } finally {
      try { rmSync(extDir, { recursive: true, force: true }) } catch {}
    }
  })

  it("rejects when canonical home does not exist", () => {
    const badHome = join(tmpdir(), `bad-home-${randomBytes(8).toString("hex")}`)
    const ok = secureEnsureDir(badHome, badHome, seams)
    assert.strictEqual(ok, false)
  })
})

describe("secureAtomicWrite", () => {
  let canonicalHome: string
  let seams: Seams
  let baseDir: string
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("writes file and sets mode 0600", () => {
    const filePath = join(baseDir, "test.json")
    const ok = secureAtomicWrite(filePath, "hello", canonicalHome, seams)
    assert.ok(ok)
    const st = statSync(filePath)
    assert.strictEqual(st.mode & 0o777, 0o600)
    const fd = openSync(filePath, "r")
    const buf = Buffer.alloc(16)
    const bytes = readSync(fd, buf, 0, buf.length, 0)
    closeSync(fd)
    assert.strictEqual(Buffer.from(buf.slice(0, bytes)).toString("utf8"), "hello")
  })

  it("fails when parent is symlink", () => {
    const realDir = join(tmpdir(), `ul-real-${randomBytes(8).toString("hex")}`)
    mkdirSync(realDir, { mode: 0o700 })
    const linkPath = join(baseDir, "linkparent")
    try {
      symlinkSync(realDir, linkPath)
      const filePath = join(linkPath, "test.json")
      const ok = secureAtomicWrite(filePath, "data", canonicalHome, seams)
      assert.strictEqual(ok, false)
    } finally {
      try { rmSync(realDir, { recursive: true, force: true }) } catch {}
    }
  })

  it("fails for path outside canonical home", () => {
    const extDir = join(tmpdir(), `ext-${randomBytes(8).toString("hex")}`)
    mkdirSync(extDir, { mode: 0o700 })
    try {
      const extFile = join(extDir, "test.json")
      const ok = secureAtomicWrite(extFile, "data", canonicalHome, seams)
      assert.strictEqual(ok, false)
    } finally {
      try { rmSync(extDir, { recursive: true, force: true }) } catch {}
    }
  })

  it("cleans up temp file on write failure", () => {
    const seamsWithBadWrite = {
      ...seams,
      fs: {
        ...seams.fs,
        writeSync: () => { throw new Error("disk full") },
      },
    }
    const filePath = join(baseDir, "fail.json")
    const ok = secureAtomicWrite(filePath, "test", canonicalHome, seamsWithBadWrite)
    assert.strictEqual(ok, false)
  })

  it("fsyncs parent directory after atomic rename", () => {
    const fsyncCalls: string[] = []
    const seamsWithFsyncTracking: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        fsyncSync: (fd: number) => {
          fsyncCalls.push(`fsync:fd-${fd}`)
        },
      },
    }
    const filePath = join(baseDir, "test.json")
    const ok = secureAtomicWrite(filePath, "data", canonicalHome, seamsWithFsyncTracking)
    assert.ok(ok)
    assert.ok(fsyncCalls.length >= 2, `parent dir fsync called, got ${fsyncCalls.length} calls`)
  })

  it("returns false when parent dir fsync fails after rename", () => {
    let fsyncCount = 0
    const seamsWithPartialFsync: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        fsyncSync: (fd: number) => {
          fsyncCount++
          if (fsyncCount > 1) throw new Error("fsync failed on parent dir")
        },
      },
    }
    const filePath = join(baseDir, "nofsync.json")
    const ok = secureAtomicWrite(filePath, "data", canonicalHome, seamsWithPartialFsync)
    assert.strictEqual(ok, false, "fails when parent dir fsync fails")
  })

  it("fails when parent directory dev+ino change between capture and rename", () => {
    const filePath = join(baseDir, "race-pre.json")
    const parentDir = baseDir
    const realFs = seams.fs
    let parentLstatCount = 0

    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        lstatSync: (p: string) => {
          const st = realFs.lstatSync(p)
          if (p === parentDir) {
            parentLstatCount++
            if (parentLstatCount >= 4) {
              return { ...st, dev: st.dev + 1, ino: st.ino + 1 }
            }
          }
          return st
        },
      },
    }

    const ok = secureAtomicWrite(filePath, "race", canonicalHome, injectedSeams)
    assert.strictEqual(ok, false, "fails when parent swaps before rename")
  })

  it("fails when parent directory identity changes between rename and fsync", () => {
    const filePath = join(baseDir, "race-post.json")
    const parentDir = baseDir
    const realFs = seams.fs
    let parentLstatCount = 0

    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        lstatSync: (p: string) => {
          const st = realFs.lstatSync(p)
          if (p === parentDir) {
            parentLstatCount++
            if (parentLstatCount >= 5) {
              return { ...st, dev: st.dev + 1, ino: st.ino + 1 }
            }
          }
          return st
        },
      },
    }

    const ok = secureAtomicWrite(filePath, "race", canonicalHome, injectedSeams)
    assert.strictEqual(ok, false, "fails when parent swaps after rename")
  })

  it("never deletes replacement sentinel file on parent identity mismatch", () => {
    const sentinelName = "sentinel-must-survive.txt"
    const sentinelPath = join(baseDir, sentinelName)
    const sentinelContent = "sentinel-do-not-delete"
    writeFileSync(sentinelPath, sentinelContent, { mode: 0o600 })

    const filePath = join(baseDir, "race-sentinel.json")
    const parentDir = baseDir
    const realFs = seams.fs
    let parentLstatCount = 0

    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        lstatSync: (p: string) => {
          const st = realFs.lstatSync(p)
          if (p === parentDir) {
            parentLstatCount++
            if (parentLstatCount >= 3) {
              return { ...st, dev: st.dev + 1, ino: st.ino + 1 }
            }
          }
          return st
        },
      },
    }

    const ok = secureAtomicWrite(filePath, "race", canonicalHome, injectedSeams)
    assert.strictEqual(ok, false, "fails when parent swaps")

    assert.ok(statSync(sentinelPath), "external sentinel must not be deleted by race cleanup")
    const fd = openSync(sentinelPath, "r")
    const buf = Buffer.alloc(256)
    const bytes = readSync(fd, buf, 0, buf.length, 0)
    closeSync(fd)
    assert.strictEqual(Buffer.from(buf.slice(0, bytes)).toString("utf8"), sentinelContent)
  })

  it("temp cleanup uses captured inode and preserves replacement temp file on parent swap", () => {
    const sentinelPath = join(baseDir, "sentinel-orphan.txt")
    const sentinelContent = "orphan-test-sentinel"
    writeFileSync(sentinelPath, sentinelContent, { mode: 0o600 })

    const filePath = join(baseDir, "race-orphan.json")
    const parentDir = baseDir
    const realFs = seams.fs
    let parentLstatCount = 0
    let writeCallCount = 0

    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        writeSync: (fd: number, data: Uint8Array | string) => {
          writeCallCount++
          if (writeCallCount === 1) {
            throw new Error("injected write failure")
          }
          return realFs.writeSync(fd, data)
        },
        lstatSync: (p: string) => {
          const st = realFs.lstatSync(p)
          if (p === parentDir && parentLstatCount >= 2) {
            parentLstatCount++
            return { ...st, dev: st.dev + 1, ino: st.ino + 1 }
          }
          if (p === parentDir) parentLstatCount++
          return st
        },
      },
    }

    const ok = secureAtomicWrite(filePath, "race", canonicalHome, injectedSeams)
    assert.strictEqual(ok, false, "fails on write error")

    assert.ok(statSync(sentinelPath), "sentinel must not be deleted by temp cleanup race")
    const fd = openSync(sentinelPath, "r")
    const buf = Buffer.alloc(256)
    const bytes = readSync(fd, buf, 0, buf.length, 0)
    closeSync(fd)
    assert.strictEqual(Buffer.from(buf.slice(0, bytes)).toString("utf8"), sentinelContent)
  })

  it("parent fsync failure after rename makes secureAtomicWrite return false", () => {
    const filePath = join(baseDir, "fsyncfail.json")
    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        openSync: (p: string, flags: number, mode?: number) => {
          if (p === baseDir) {
            throw new Error("injected parent open failure")
          }
          return seams.fs.openSync(p, flags, mode)
        },
      },
    }

    const ok = secureAtomicWrite(filePath, "data", canonicalHome, injectedSeams)
    assert.strictEqual(ok, false, "fails when parent dir open for fsync fails")
  })

  it("temp cleanup leaves orphan when parent identity is uncertain after rename failure", () => {
    const sentinelPath = join(baseDir, "sentinel-rename-orphan.txt")
    const sentinelContent = "rename-orphan-sentinel"
    writeFileSync(sentinelPath, sentinelContent, { mode: 0o600 })

    const filePath = join(baseDir, "race-rename.json")
    const parentDir = baseDir
    const realFs = seams.fs
    let parentLstatCount = 0

    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        renameSync: (_old: string, _new: string) => {
          throw new Error("injected rename failure")
        },
        lstatSync: (p: string) => {
          const st = realFs.lstatSync(p)
          if (p === parentDir) {
            parentLstatCount++
            if (parentLstatCount >= 4) {
              return { ...st, dev: st.dev + 1, ino: st.ino + 1 }
            }
          }
          return st
        },
      },
    }

    const ok = secureAtomicWrite(filePath, "race", canonicalHome, injectedSeams)
    assert.strictEqual(ok, false, "fails on rename error with parent swap")

    assert.ok(statSync(sentinelPath), "sentinel must survive rename-failure temp cleanup")
    const fd = openSync(sentinelPath, "r")
    const buf = Buffer.alloc(256)
    const bytes = readSync(fd, buf, 0, buf.length, 0)
    closeSync(fd)
    assert.strictEqual(Buffer.from(buf.slice(0, bytes)).toString("utf8"), sentinelContent)
  })
})

describe("secureValidateFile", () => {
  let canonicalHome: string
  let seams: Seams
  let baseDir: string
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("accepts a regular file with mode 0600", () => {
    const fp = join(baseDir, "good.json")
    writeFileSync(fp, "data", { mode: 0o600 })
    assert.ok(secureValidateFile(fp, canonicalHome, seams))
  })

  it("rejects a symlink file", () => {
    const real = join(tmpdir(), `ul-real-${randomBytes(8).toString("hex")}`)
    mkdirSync(real, { mode: 0o700 })
    const realFile = join(real, "real.json")
    writeFileSync(realFile, "data", { mode: 0o600 })
    const linkFile = join(baseDir, "link.json")
    try {
      symlinkSync(realFile, linkFile)
      assert.strictEqual(secureValidateFile(linkFile, canonicalHome, seams), false)
    } finally {
      try { rmSync(real, { recursive: true, force: true }) } catch {}
    }
  })

  it("rejects file with wrong mode", () => {
    const fp = join(baseDir, "bad.json")
    writeFileSync(fp, "data", { mode: 0o644 })
    assert.strictEqual(secureValidateFile(fp, canonicalHome, seams), false)
  })

  it("rejects file outside canonical home", () => {
    const extDir = join(tmpdir(), `ext-${randomBytes(8).toString("hex")}`)
    mkdirSync(extDir, { mode: 0o700 })
    try {
      const fp = join(extDir, "ext.json")
      writeFileSync(fp, "data", { mode: 0o600 })
      assert.strictEqual(secureValidateFile(fp, canonicalHome, seams), false)
    } finally {
      try { rmSync(extDir, { recursive: true, force: true }) } catch {}
    }
  })
})

describe("secureScanDir", () => {
  let canonicalHome: string
  let seams: Seams
  let baseDir: string
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("scans files without following symlinks", () => {
    const datadir = join(baseDir, "datadir")
    mkdirSync(datadir, { mode: 0o700 })
    writeFileSync(join(datadir, "a.json"), "a", { mode: 0o600 })
    writeFileSync(join(datadir, "b.json"), "bb", { mode: 0o600 })
    const result = secureScanDir(datadir, canonicalHome, seams)
    assert.ok(result.count >= 1)
    assert.ok(result.totalBytes >= 1)
  })

  it("returns empty for dir outside canonical home", () => {
    const extDir = join(tmpdir(), `ext-${randomBytes(8).toString("hex")}`)
    mkdirSync(extDir, { mode: 0o700 })
    try {
      const result = secureScanDir(extDir, canonicalHome, seams)
      assert.strictEqual(result.count, 0)
      assert.strictEqual(result.totalBytes, 0)
    } finally {
      try { rmSync(extDir, { recursive: true, force: true }) } catch {}
    }
  })

  it("ignores files with wrong mode", () => {
    const datadir = join(baseDir, "datadir")
    mkdirSync(datadir, { mode: 0o700 })
    writeFileSync(join(datadir, "good.json"), "good", { mode: 0o600 })
    writeFileSync(join(datadir, "bad.json"), "bad", { mode: 0o644 })
    const result = secureScanDir(datadir, canonicalHome, seams)
    assert.strictEqual(result.count, 1)
  })

  it("ignores files owned by wrong user via seam", () => {
    const datadir = join(baseDir, "datadir")
    mkdirSync(datadir, { mode: 0o700 })
    writeFileSync(join(datadir, "a.json"), "good", { mode: 0o600 })
    const wrongSeams = seamsWithWrongOwner(seams)
    const result = secureScanDir(datadir, canonicalHome, wrongSeams)
    assert.strictEqual(result.count, 0)
    assert.strictEqual(result.totalBytes, 0)
  })
})

describe("secureReadFile", () => {
  let canonicalHome: string
  let seams: Seams
  let baseDir: string
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("reads a valid 0600 file", () => {
    const fp = join(baseDir, "valid.json")
    writeFileSync(fp, "hello world", { mode: 0o600 })
    const result = secureReadFile(fp, canonicalHome, seams)
    assert.strictEqual(result, "hello world")
  })

  it("returns null for file with wrong mode", () => {
    const fp = join(baseDir, "bad.json")
    writeFileSync(fp, "data", { mode: 0o644 })
    assert.strictEqual(secureReadFile(fp, canonicalHome, seams), null)
  })

  it("returns null for file owned by wrong user on lstat", () => {
    const fp = join(baseDir, "owned.json")
    writeFileSync(fp, "data", { mode: 0o600 })
    const wrongSeams = seamsWithWrongOwner(seams)
    assert.strictEqual(secureReadFile(fp, canonicalHome, wrongSeams), null)
  })

  it("rejects fstat inode mismatch via seam injection", () => {
    const fp = join(baseDir, "trap.json")
    writeFileSync(fp, "trap", { mode: 0o600 })
    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        fstatSync: (fd: number) => {
          const st = seams.fs.fstatSync(fd)
          return { ...st, dev: st.dev + 1, ino: st.ino + 1 }
        },
      },
    }
    assert.strictEqual(secureReadFile(fp, canonicalHome, injectedSeams), null)
  })

  it("returns null for symlink", () => {
    const real = join(tmpdir(), `ul-real-${randomBytes(8).toString("hex")}`)
    mkdirSync(real, { mode: 0o700 })
    const realFile = join(real, "real.json")
    writeFileSync(realFile, "data", { mode: 0o600 })
    const linkFile = join(baseDir, "link.json")
    try {
      symlinkSync(realFile, linkFile)
      assert.strictEqual(secureReadFile(linkFile, canonicalHome, seams), null)
    } finally {
      try { rmSync(real, { recursive: true, force: true }) } catch {}
    }
  })

  it("returns null for file outside canonical home", () => {
    const extDir = join(tmpdir(), `ext-${randomBytes(8).toString("hex")}`)
    mkdirSync(extDir, { mode: 0o700 })
    try {
      const fp = join(extDir, "ext.json")
      writeFileSync(fp, "data", { mode: 0o600 })
      assert.strictEqual(secureReadFile(fp, canonicalHome, seams), null)
    } finally {
      try { rmSync(extDir, { recursive: true, force: true }) } catch {}
    }
  })
})

describe("secureUnlink", () => {
  let canonicalHome: string
  let seams: Seams
  let baseDir: string
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("unlinks a file and fsyncs parent directory", () => {
    const fp = join(baseDir, "todelete.json")
    writeFileSync(fp, "data", { mode: 0o600 })
    assert.strictEqual(secureUnlink(fp, canonicalHome, seams), true)
  })

  it("returns false for path outside canonical home", () => {
    const extDir = join(tmpdir(), `ext-${randomBytes(8).toString("hex")}`)
    mkdirSync(extDir, { mode: 0o700 })
    try {
      const fp = join(extDir, "ext.json")
      writeFileSync(fp, "data", { mode: 0o600 })
      assert.strictEqual(secureUnlink(fp, canonicalHome, seams), false)
    } finally {
      try { rmSync(extDir, { recursive: true, force: true }) } catch {}
    }
  })

  it("removes dangling symlink via lstat", () => {
    const target = join(baseDir, "dangling-target.json")
    const linkPath = join(baseDir, "dangling-link.json")
    writeFileSync(target, "data", { mode: 0o600 })
    symlinkSync(target, linkPath)
    unlinkSync(target)

    assert.strictEqual(secureUnlink(linkPath, canonicalHome, seams), true)
    try {
      statSync(linkPath)
      assert.fail("symlink should be removed")
    } catch {
    }
  })

  it("returns false when parent dir fsync fails after unlink", () => {
    let fsyncCount = 0
    const seamsWithFsyncFail: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        fsyncSync: (fd: number) => {
          fsyncCount++
          throw new Error("fsync failed on parent")
        },
      },
    }
    const fp = join(baseDir, "fsyncfail.json")
    writeFileSync(fp, "data", { mode: 0o600 })
    assert.strictEqual(secureUnlink(fp, canonicalHome, seamsWithFsyncFail), false)
  })

  it("fails when parent directory identity changes before unlink", () => {
    const fp = join(baseDir, "race-unlink.json")
    writeFileSync(fp, "race-data", { mode: 0o600 })
    const parentDir = baseDir
    const realFs = seams.fs
    let parentLstatCount = 0

    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        lstatSync: (p: string) => {
          const st = realFs.lstatSync(p)
          if (p === parentDir) {
            parentLstatCount++
            if (parentLstatCount >= 3) {
              return { ...st, dev: st.dev + 1, ino: st.ino + 1 }
            }
          }
          return st
        },
      },
    }

    const ok = secureUnlink(fp, canonicalHome, injectedSeams)
    assert.strictEqual(ok, false, "fails when parent swaps before unlink")
  })

  it("validates expected dev+ino when provided", () => {
    const fp = join(baseDir, "expected.json")
    writeFileSync(fp, "data", { mode: 0o600 })
    const st = statSync(fp)

    assert.strictEqual(secureUnlink(fp, canonicalHome, seams, { dev: st.dev, ino: st.ino }), true)
  })

  it("rejects wrong expected dev", () => {
    const fp = join(baseDir, "wrong-dev.json")
    writeFileSync(fp, "data", { mode: 0o600 })

    const ok = secureUnlink(fp, canonicalHome, seams, { dev: 99999, ino: 99999 })
    assert.strictEqual(ok, false)

    assert.ok(statSync(fp), "file must not be deleted on identity mismatch")
  })

  it("does not delete replacement file on dev+ino mismatch", () => {
    const fp = join(baseDir, "race-replace.json")
    const originalContent = "original-data-for-inode-check"
    writeFileSync(fp, originalContent, { mode: 0o600 })
    const oldSt = statSync(fp)

    unlinkSync(fp)
    const replacementContent = "replacement-must-survive"
    writeFileSync(fp, replacementContent, { mode: 0o600 })

    const ok = secureUnlink(fp, canonicalHome, seams, { dev: oldSt.dev, ino: oldSt.ino })
    assert.strictEqual(ok, false, "must reject when inode mismatches expected")

    assert.ok(statSync(fp), "replacement file must still exist")
    const fd = openSync(fp, "r")
    const buf = Buffer.alloc(256)
    const bytes = readSync(fd, buf, 0, buf.length, 0)
    closeSync(fd)
    const actual = Buffer.from(buf.slice(0, bytes)).toString("utf8")
    assert.strictEqual(actual, replacementContent, "replacement content must be intact byte-for-byte")
  })
})

describe("captureParentIdentity", () => {
  let canonicalHome: string
  let seams: Seams
  let baseDir: string
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("captures identity of a valid directory", () => {
    const id = captureParentIdentity(baseDir, canonicalHome, seams)
    assert.ok(id)
    assert.strictEqual(typeof id.dev, "number")
    assert.strictEqual(typeof id.ino, "number")
    assert.strictEqual(typeof id.uid, "number")
    assert.strictEqual(typeof id.mode, "number")
    assert.ok(id.realPath.startsWith("/"))
  })

  it("returns null for symlink parent", () => {
    const real = join(tmpdir(), `ul-real-${randomBytes(8).toString("hex")}`)
    mkdirSync(real, { mode: 0o700 })
    const link = join(baseDir, "link")
    try {
      symlinkSync(real, link)
      const id = captureParentIdentity(link, canonicalHome, seams)
      assert.strictEqual(id, null)
    } finally {
      try { rmSync(real, { recursive: true, force: true }) } catch {}
    }
  })

  it("returns null for path outside canonical home", () => {
    const extDir = join(tmpdir(), `ext-${randomBytes(8).toString("hex")}`)
    mkdirSync(extDir, { mode: 0o700 })
    try {
      const id = captureParentIdentity(extDir, canonicalHome, seams)
      assert.strictEqual(id, null)
    } finally {
      try { rmSync(extDir, { recursive: true, force: true }) } catch {}
    }
  })

  it("returns null for group-writable directory", () => {
    const dir = join(baseDir, "gw-dir")
    mkdirSync(dir, { mode: 0o770 })
    const id = captureParentIdentity(dir, canonicalHome, seams)
    assert.strictEqual(id, null)
  })

  it("returns null for directory owned by wrong user via seam", () => {
    const wrongSeams = seamsWithWrongOwner(seams)
    const id = captureParentIdentity(baseDir, canonicalHome, wrongSeams)
    assert.strictEqual(id, null)
  })
})

describe("parentIdentityMatches", () => {
  let canonicalHome: string
  let seams: Seams
  let baseDir: string
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("returns true for matching identity", () => {
    const id = captureParentIdentity(baseDir, canonicalHome, seams)
    assert.ok(id)
    assert.ok(parentIdentityMatches(baseDir, id, seams))
  })

  it("returns false for mismatched dev", () => {
    const id = captureParentIdentity(baseDir, canonicalHome, seams)
    assert.ok(id)
    const fake: typeof id = { ...id, dev: id.dev + 1 }
    assert.strictEqual(parentIdentityMatches(baseDir, fake, seams), false)
  })

  it("returns false for mismatched ino", () => {
    const id = captureParentIdentity(baseDir, canonicalHome, seams)
    assert.ok(id)
    const fake: typeof id = { ...id, ino: id.ino + 1 }
    assert.strictEqual(parentIdentityMatches(baseDir, fake, seams), false)
  })

  it("returns false for mismatched realPath", () => {
    const id = captureParentIdentity(baseDir, canonicalHome, seams)
    assert.ok(id)
    const fake: typeof id = { ...id, realPath: "/nonexistent/path" }
    assert.strictEqual(parentIdentityMatches(baseDir, fake, seams), false)
  })
})

describe("containsSymlinkDescendant", () => {
  let canonicalHome: string
  let seams: Seams
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
  })

  afterEach(() => {
    cleanupHome()
  })

  it("detects a symlink descendant of canonical home", () => {
    const dir = join(canonicalHome, "dir")
    mkdirSync(dir, { mode: 0o700 })
    const real = join(tmpdir(), `ul-real-${randomBytes(8).toString("hex")}`)
    mkdirSync(real, { mode: 0o700 })
    const link = join(dir, "symlink")
    symlinkSync(real, link)
    try {
      const target = join(link, "child", "deep")
      assert.ok(containsSymlinkDescendant(target, canonicalHome, seams))
    } finally {
      try { rmSync(real, { recursive: true, force: true }) } catch {}
    }
  })

  it("returns false for path with no symlink descendants", () => {
    mkdirSync(join(canonicalHome, "a"), { mode: 0o700 })
    mkdirSync(join(canonicalHome, "a", "b"), { mode: 0o700 })
    assert.strictEqual(containsSymlinkDescendant(join(canonicalHome, "a", "b", "c"), canonicalHome, seams), false)
  })

  it("does not flag pre-canonical-home ancestor symlink", () => {
    const realInner = join(tmpdir(), `ul-inner-${randomBytes(8).toString("hex")}`)
    mkdirSync(realInner, { mode: 0o700, recursive: true })
    const outerLink = join(tmpdir(), `ul-link-${randomBytes(8).toString("hex")}`)
    try {
      symlinkSync(realInner, outerLink)
      const ch = resolve(realInner)
      const target = join(outerLink, "child")
      assert.strictEqual(containsSymlinkDescendant(target, ch, seams), false)
    } finally {
    try { rmSync(realInner, { recursive: true, force: true }) } catch {}
    try { rmSync(outerLink, { recursive: true, force: true }) } catch {}
    }
  })
})

describe("readdirBounded", () => {
  let canonicalHome: string
  let seams: Seams
  let baseDir: string
  let cleanupHome: () => void

  beforeEach(() => {
    const ch = makeCanonicalHome()
    canonicalHome = ch.home
    seams = ch.seams
    cleanupHome = ch.cleanup
    baseDir = makeBaseDir(canonicalHome)
  })

  afterEach(() => {
    cleanupHome()
  })

  it("returns up to limit entries", () => {
    const dir = join(baseDir, "bounded-dir")
    mkdirSync(dir, { mode: 0o700 })
    for (let i = 0; i < 20; i++) {
      writeFileSync(join(dir, `${String(i).padStart(4, "0")}.json`), "x", { mode: 0o600 })
    }
    const names = readdirBounded(dir, 5, seams)
    assert.ok(names.length <= 5, `got ${names.length}, expected <= 5`)
  })

  it("does not exhaust iterator when limit exceeded", () => {
    const dir = join(baseDir, "iterator-dir")
    mkdirSync(dir, { mode: 0o700 })
    for (let i = 0; i < 10; i++) {
      writeFileSync(join(dir, `${String(i).padStart(4, "0")}.json`), "x", { mode: 0o600 })
    }
    let exhausted = false
    const injectedSeams: Seams = {
      ...seams,
      fs: {
        ...seams.fs,
        opendirSync: (p: string) => {
          if (p === dir) {
            let count = 0
            const realDir = seams.fs.opendirSync(p)
            return {
              readSync: () => {
                if (count >= 3) {
                  exhausted = true
                  throw new Error("iterator exceeded limit")
                }
                count++
                return realDir.readSync()
              },
              closeSync: () => realDir.closeSync(),
            }
          }
          return seams.fs.opendirSync(p)
        },
      },
    }
    const names = readdirBounded(dir, 3, injectedSeams)
    assert.strictEqual(names.length, 3, "bounded to 3 entries")
    assert.strictEqual(exhausted, false, "iterator must not be read past limit")
  })
})
