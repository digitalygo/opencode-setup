import { describe, it } from "node:test"
import assert from "node:assert"
import { resolveRuntimePaths, STATE_RELATIVE_LINUX, STATE_RELATIVE_MACOS } from "../paths.js"
import { createRealSeams } from "../seams-real.js"
import type { Seams } from "../seams.js"
import { join, resolve } from "node:path"
import { mkdirSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"

function makeTempHome(platform?: string): { home: string; seams: Seams; cleanup: () => void } {
  const home = join(tmpdir(), `ul-test-${randomBytes(8).toString("hex")}`)
  mkdirSync(home, { mode: 0o700, recursive: true })
  const seams = {
    ...createRealSeams(),
    platform: {
      ...createRealSeams().platform,
      homedir: () => home,
      platform: () => platform ?? "linux",
    },
  }
  return { home, seams, cleanup: () => { try { rmSync(home, { recursive: true, force: true }) } catch {} } }
}

function seamsWithFailingRealpath(homeDir: string, platformName: string): Seams {
  const real = createRealSeams()
  return {
    ...real,
    platform: {
      ...real.platform,
      homedir: () => homeDir,
      platform: () => platformName,
    },
    fs: {
      ...real.fs,
      realpathSync: () => { throw new Error("ENOENT") },
    },
  }
}

function seamsWithBogusRealpath(homeDir: string, bogusResult: string): Seams {
  const real = createRealSeams()
  return {
    ...real,
    platform: {
      ...real.platform,
      homedir: () => homeDir,
      platform: () => "linux",
    },
    fs: {
      ...real.fs,
      realpathSync: (_p: string) => bogusResult,
    },
  }
}

describe("resolveRuntimePaths", () => {
  it("resolves Linux state under canonical home", () => {
    const { home, seams, cleanup } = makeTempHome()
    try {
      const paths = resolveRuntimePaths({ seams })
      assert.strictEqual(paths.stateDir, join(home, STATE_RELATIVE_LINUX))
      assert.strictEqual(paths.secretsDir, join(home, "Documents", ".secrets"))
      assert.strictEqual(paths.canonicalHome, resolve(home))
    } finally {
      cleanup()
    }
  })

  it("resolves macOS state under canonical home", () => {
    const { home, seams, cleanup } = makeTempHome("darwin")
    try {
      const paths = resolveRuntimePaths({ seams })
      assert.strictEqual(paths.stateDir, join(home, STATE_RELATIVE_MACOS))
      assert.strictEqual(paths.secretsDir, join(home, "Documents", ".secrets"))
      assert.strictEqual(paths.canonicalHome, resolve(home))
    } finally {
      cleanup()
    }
  })

  it("canonicalizes home via injected realpathSync", () => {
    const realDir = join(tmpdir(), `ul-test-real-${randomBytes(8).toString("hex")}`)
    mkdirSync(realDir, { mode: 0o700, recursive: true })
    const linkDir = join(tmpdir(), `ul-test-link-${randomBytes(8).toString("hex")}`)
    try {
      symlinkSync(realDir, linkDir)
      const { seams, cleanup } = makeTempHome()
      try {
        const paths = resolveRuntimePaths({
          seams: {
            ...seams,
            platform: { ...seams.platform, homedir: () => linkDir },
          },
        })
        assert.strictEqual(paths.canonicalHome, resolve(realDir))
      } finally {
        cleanup()
      }
    } finally {
      try { rmSync(realDir, { recursive: true, force: true }) } catch {}
      try { rmSync(linkDir, { recursive: true, force: true }) } catch {}
    }
  })

  it("fails when home cannot be canonicalized", () => {
    const seams = seamsWithFailingRealpath("/nonexistent/home/path/that/does/not/exist", "linux")
    assert.throws(
      () => resolveRuntimePaths({ seams }),
      /cannot canonicalize/,
    )
  })

  it("fails when home contains path traversal", () => {
    const seams = seamsWithFailingRealpath("//opt/../../etc", "linux")
    assert.throws(
      () => resolveRuntimePaths({ seams }),
      /traversal/,
    )
  })

  it("fails when bogus realpath returns something disjoint", () => {
    const { home, seams, cleanup } = makeTempHome()
    try {
      const disjointDir = join(tmpdir(), `ul-disjoint-${randomBytes(8).toString("hex")}`)
      mkdirSync(disjointDir, { mode: 0o700, recursive: true })
      try {
        const bogusSeams: Seams = {
          ...seams,
          fs: {
            ...seams.fs,
            realpathSync: () => disjointDir,
          },
        }
        const paths = resolveRuntimePaths({ seams: bogusSeams })
        assert.notStrictEqual(paths.canonicalHome, resolve(home))
      } finally {
        try { rmSync(disjointDir, { recursive: true, force: true }) } catch {}
      }
    } finally {
      cleanup()
    }
  })

  it("fails with empty home path", () => {
    const seams = seamsWithFailingRealpath("", "linux")
    assert.throws(
      () => resolveRuntimePaths({ seams }),
      /empty/,
    )
  })

  it("fails with non-absolute home path", () => {
    const seams = seamsWithFailingRealpath("relative/home", "linux")
    assert.throws(
      () => resolveRuntimePaths({ seams }),
      /not absolute|empty/,
    )
  })

  it("works with arbitrary valid temp path not under /home or /Users", () => {
    const { seams, cleanup } = makeTempHome()
    try {
      const paths = resolveRuntimePaths({ seams })
      assert.ok(paths.stateDir.length > 0)
    } finally {
      cleanup()
    }
  })
})
