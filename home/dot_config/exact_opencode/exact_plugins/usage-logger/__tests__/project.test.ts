import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { detectProject, normalizeGitRemote } from "../project.js"
import { createRealSeams } from "../seams-real.js"

function tempDir(): string {
  const dir = join(tmpdir(), `ul-test-${randomBytes(8).toString("hex")}`)
  mkdirSync(dir, { mode: 0o700 })
  return dir
}

function initGitRepo(dir: string): void {
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: dir })
  execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: dir })
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir })
  writeFileSync(join(dir, "test.txt"), "hello")
  execFileSync("git", ["add", "test.txt"], { cwd: dir })
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir })
}

describe("normalizeGitRemote", () => {
  it("normalizes HTTPS remote", () => {
    const result = normalizeGitRemote("https://github.com/user/repo.git")
    assert.strictEqual(result, "github.com/user/repo")
  })

  it("normalizes HTTPS remote without .git", () => {
    const result = normalizeGitRemote("https://github.com/user/repo")
    assert.strictEqual(result, "github.com/user/repo")
  })

  it("normalizes git@ SCP remote", () => {
    const result = normalizeGitRemote("git@github.com:user/repo.git")
    assert.strictEqual(result, "github.com/user/repo")
  })

  it("lowercases hostname and path", () => {
    const result = normalizeGitRemote("https://GitHub.com/User/Repo.git")
    assert.strictEqual(result, "github.com/user/repo")
  })

  it("returns empty for empty input", () => {
    assert.strictEqual(normalizeGitRemote(""), "")
  })

  it("rejects file:// remotes", () => {
    assert.strictEqual(normalizeGitRemote("file:///tmp/repo"), "")
  })

  it("rejects control characters in remote", () => {
    assert.strictEqual(normalizeGitRemote("https://evil\n.com/repo"), "")
  })
})

describe("detectProject", () => {
  let gitDir: string
  let seams: ReturnType<typeof createRealSeams>

  beforeEach(() => {
    gitDir = tempDir()
    initGitRepo(gitDir)
    seams = createRealSeams()
  })

  afterEach(() => {
    try { rmSync(gitDir, { recursive: true, force: true }) } catch {}
  })

  it("detects project from worktree when worktree is a valid git repo", () => {
    execFileSync("git", ["remote", "add", "origin", "https://github.com/user/repo.git"], { cwd: gitDir })
    const code = detectProject(
      { directory: "/some/other/path", worktree: gitDir } as Parameters<typeof detectProject>[0],
      seams,
    )
    assert.strictEqual(code, "github.com/user/repo")
  })

  it("falls back to directory when worktree is not a git repo", () => {
    execFileSync("git", ["remote", "add", "origin", "https://github.com/user/repo.git"], { cwd: gitDir })
    const nonGit = tempDir()
    try {
      const code = detectProject(
        { directory: gitDir, worktree: nonGit } as Parameters<typeof detectProject>[0],
        seams,
      )
      assert.strictEqual(code, "github.com/user/repo")
    } finally {
      try { rmSync(nonGit, { recursive: true, force: true }) } catch {}
    }
  })

  it("attributes repo when PluginInput points inside git but process CWD is outside", () => {
    execFileSync("git", ["remote", "add", "origin", "https://github.com/user/repo.git"], { cwd: gitDir })
    const code = detectProject(
      { directory: gitDir, worktree: gitDir } as Parameters<typeof detectProject>[0],
      seams,
    )
    assert.strictEqual(code, "github.com/user/repo")
  })

  it("returns empty for non-git directory", () => {
    const nonGit = tempDir()
    try {
      const code = detectProject(
        { directory: nonGit, worktree: nonGit } as Parameters<typeof detectProject>[0],
        seams,
      )
      assert.strictEqual(code, "")
    } finally {
      try { rmSync(nonGit, { recursive: true, force: true }) } catch {}
    }
  })
})
