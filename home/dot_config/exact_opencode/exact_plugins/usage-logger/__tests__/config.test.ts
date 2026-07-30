import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import {
  mkdirSync,
  writeFileSync,
  chmodSync,
  rmSync,
  symlinkSync,
  realpathSync,
  readFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { randomBytes } from "node:crypto"
import { resolveConfig, validateBaseUrl } from "../config.js"
import { createRealSeams } from "../seams-real.js"
import type { Seams } from "../seams.js"

function tempDir(): string {
  const dir = join(tmpdir(), `ul-test-${randomBytes(8).toString("hex")}`)
  mkdirSync(dir, { mode: 0o700 })
  return dir
}

function writeSecret(dir: string, name: string, content: string) {
  const p = join(dir, name)
  writeFileSync(p, content, { mode: 0o400 })
}

function seamsWithHome(canonicalHome: string): Seams {
  const real = createRealSeams()
  return {
    ...real,
    platform: {
      ...real.platform,
      homedir: () => canonicalHome,
    },
  }
}

describe("validateBaseUrl", () => {
  it("accepts a valid https URL", () => {
    const result = validateBaseUrl("https://api.example.com")
    assert.strictEqual(result, "https://api.example.com")
  })

  it("strips trailing slash", () => {
    const result = validateBaseUrl("https://api.example.com/")
    assert.strictEqual(result, "https://api.example.com")
  })

  it("rejects URL with credentials", () => {
    assert.throws(
      () => validateBaseUrl("https://user:pass@api.example.com"),
      /credentials/,
    )
  })

  it("rejects URL with query parameters", () => {
    assert.throws(
      () => validateBaseUrl("https://api.example.com?foo=bar"),
      /query/,
    )
  })

  it("rejects URL with fragment", () => {
    assert.throws(
      () => validateBaseUrl("https://api.example.com#section"),
      /fragment/,
    )
  })

  it("accepts HTTP for localhost", () => {
    const result = validateBaseUrl("http://localhost:3000")
    assert.strictEqual(result, "http://localhost:3000")
  })

  it("rejects HTTP for non-localhost", () => {
    assert.throws(
      () => validateBaseUrl("http://api.example.com"),
      /HTTPS/,
    )
  })

  it("rejects ftp://localhost", () => {
    assert.throws(
      () => validateBaseUrl("ftp://localhost"),
      /HTTP/,
    )
  })

  it("rejects ws://localhost", () => {
    assert.throws(
      () => validateBaseUrl("ws://localhost"),
      /HTTP/,
    )
  })

  it("rejects file://localhost", () => {
    assert.throws(
      () => validateBaseUrl("file://localhost"),
      /HTTP/,
    )
  })

  it("rejects invalid URL", () => {
    assert.throws(() => validateBaseUrl("not-a-url"), /valid URL/)
  })
})

describe("resolveConfig", () => {
  let secretsDir: string
  let canonicalHome: string

  beforeEach(() => {
    canonicalHome = tempDir()
    secretsDir = join(canonicalHome, "Documents", ".secrets")
    mkdirSync(join(canonicalHome, "Documents"), { mode: 0o700, recursive: true })
    mkdirSync(secretsDir, { mode: 0o700, recursive: true })
  })

  afterEach(() => {
    rmSync(canonicalHome, { recursive: true, force: true })
  })

  it("resolves valid config", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    writeSecret(secretsDir, "usage-log-api-key", "sk-test123")
    const config = resolveConfig(secretsDir, resolve(canonicalHome), createRealSeams())
    assert.strictEqual(config.base, "https://api.example.com")
    assert.strictEqual(config.key, "sk-test123")
  })

  it("throws when secrets dir does not exist", () => {
    assert.throws(
      () => resolveConfig(join(secretsDir, "nope"), resolve(canonicalHome), createRealSeams()),
      /not found/,
    )
  })

  it("throws when api key file is missing", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    assert.throws(
      () => resolveConfig(secretsDir, resolve(canonicalHome), createRealSeams()),
      /usage-log-api-key/,
    )
  })

  it("throws when api key is empty", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    writeSecret(secretsDir, "usage-log-api-key", "")
    assert.throws(
      () => resolveConfig(secretsDir, resolve(canonicalHome), createRealSeams()),
      /empty/,
    )
  })

  it("rejects world-writable secrets directory", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    writeSecret(secretsDir, "usage-log-api-key", "sk-test123")
    chmodSync(secretsDir, 0o777)
    assert.throws(
      () => resolveConfig(secretsDir, resolve(canonicalHome), createRealSeams()),
      /group.other write/,
    )
  })

  it("rejects a symlink secrets directory", () => {
    const home = tempDir()
    const realDocs = join(home, "real-docs")
    mkdirSync(realDocs, { mode: 0o700 })
    const realSecrets = join(realDocs, ".secrets")
    mkdirSync(realSecrets, { mode: 0o700 })
    writeSecret(realSecrets, "usage-log-api-base", "https://api.example.com")
    writeSecret(realSecrets, "usage-log-api-key", "sk-test123")
    const linkDocs = join(home, "Documents")
    symlinkSync(realDocs, linkDocs)
    try {
      const linkSecrets = join(linkDocs, ".secrets")
      assert.throws(
        () => resolveConfig(linkSecrets, resolve(home), createRealSeams()),
        /symlink path component/,
      )
    } finally {
      try { rmSync(home, { recursive: true, force: true }) } catch {}
    }
  })

  it("rejects secrets dir outside canonical home", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    writeSecret(secretsDir, "usage-log-api-key", "sk-test123")
    const outsideHome = tempDir()
    try {
      assert.throws(
        () => resolveConfig(secretsDir, resolve(outsideHome), createRealSeams()),
        /contained/,
      )
    } finally {
      try { rmSync(outsideHome, { recursive: true, force: true }) } catch {}
    }
  })

  it("rejects secrets dir path containing symlink at or below canonical home", () => {
    const home = tempDir()
    const realSub = join(home, "real-sub")
    mkdirSync(realSub, { mode: 0o700 })
    const realSecrets = join(realSub, ".secrets")
    mkdirSync(realSecrets, { mode: 0o700 })
    writeSecret(realSecrets, "usage-log-api-base", "https://api.example.com")
    writeSecret(realSecrets, "usage-log-api-key", "sk-test123")
    const symSub = join(home, "sym-sub")
    symlinkSync(realSub, symSub)
    try {
      const linkSecrets = join(symSub, ".secrets")
      assert.throws(
        () => resolveConfig(linkSecrets, resolve(home), createRealSeams()),
        /symlink path component/,
      )
    } finally {
      try { rmSync(home, { recursive: true, force: true }) } catch {}
    }
  })

  it("accepts owner-only 0400 secret file", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    const keyPath = join(secretsDir, "usage-log-api-key")
    writeFileSync(keyPath, "sk-0400", { mode: 0o400 })
    const config = resolveConfig(secretsDir, resolve(canonicalHome), createRealSeams())
    assert.strictEqual(config.key, "sk-0400")
  })

  it("accepts owner-only 0600 secret file", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    const keyPath = join(secretsDir, "usage-log-api-key")
    writeFileSync(keyPath, "sk-0600", { mode: 0o600 })
    const config = resolveConfig(secretsDir, resolve(canonicalHome), createRealSeams())
    assert.strictEqual(config.key, "sk-0600")
  })

  it("rejects secret file with group/other permissions", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    const keyPath = join(secretsDir, "usage-log-api-key")
    writeFileSync(keyPath, "sk-644", { mode: 0o644 })
    assert.throws(
      () => resolveConfig(secretsDir, resolve(canonicalHome), createRealSeams()),
      /permissive/,
    )
  })

  it("rejects when fstat inode mismatch", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    writeSecret(secretsDir, "usage-log-api-key", "sk-test123")
    const real = createRealSeams()
    const captiveSeams: Seams = {
      ...real,
      fs: {
        ...real.fs,
        fstatSync: (fd: number) => {
          const st = real.fs.fstatSync(fd)
          return { ...st, dev: st.dev + 1, ino: st.ino + 1 }
        },
      },
    }
    assert.throws(
      () => resolveConfig(secretsDir, resolve(canonicalHome), captiveSeams),
      /not found or not readable/,
    )
  })

  it("rejects symlinked secret file via O_NOFOLLOW", () => {
    writeSecret(secretsDir, "usage-log-api-base", "https://api.example.com")
    const realKeyDir = tempDir()
    const realKeyPath = join(realKeyDir, "real-key")
    writeFileSync(realKeyPath, "sk-test123", { mode: 0o400 })
    const linkPath = join(secretsDir, "usage-log-api-key")
    symlinkSync(realKeyPath, linkPath)
    try {
      assert.throws(
        () => {
          const real = createRealSeams()
          const fcntl = real.fs.fcntlConstants()
          if (fcntl.O_NOFOLLOW === undefined) {
            throw new Error("test skip: O_NOFOLLOW not available")
          }
          resolveConfig(secretsDir, resolve(canonicalHome), real)
        },
        /symlink path component/,
      )
    } finally {
      try { rmSync(realKeyDir, { recursive: true, force: true }) } catch {}
    }
  })
})
