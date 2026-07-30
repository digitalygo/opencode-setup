import { describe, it } from "node:test"
import assert from "node:assert"
import { existsSync, rmSync, readdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDirJs = resolve(__dirname, "..", "__scripts__", "build-dir.js")
const { getBuildDir } = await import(buildDirJs)

describe("getBuildDir", () => {
  it("returns a valid build directory and cleans it up on success", () => {
    const dir = getBuildDir()
    try {
      assert.ok(existsSync(dir), "directory exists")
      assert.ok(readdirSync(dir).includes(".oc-ul-lease"), "lease file written")
    } finally {
      try { rmSync(dir, { recursive: true, force: true }) } catch {}
    }
  })

  it("removes directory when validateBuildDir throws", () => {
    let capturedDir = null
    let thrown = false
    try {
      getBuildDir({
        validateBuildDir: (dir) => {
          capturedDir = dir
          throw new Error("injected validate failure")
        },
      })
    } catch {
      thrown = true
    }
    assert.ok(thrown, "exception propagated")
    assert.ok(capturedDir !== null, "directory was created")
    assert.strictEqual(existsSync(capturedDir), false, "orphan directory was removed")
  })

  it("removes directory when writeOwnerLease throws", () => {
    let capturedDir = null
    let thrown = false
    try {
      getBuildDir({
        writeOwnerLease: (dir) => {
          capturedDir = dir
          throw new Error("injected lease failure")
        },
      })
    } catch {
      thrown = true
    }
    assert.ok(thrown, "exception propagated")
    assert.ok(capturedDir !== null, "directory was created")
    assert.strictEqual(existsSync(capturedDir), false, "orphan directory was removed")
  })
})
