import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes, createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import * as realFs from "node:fs"
import * as realOs from "node:os"
import plugin from "../../usage-logger.js"
import type { Seams } from "../seams.js"
import type { Stats } from "node:fs"

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
  execFileSync("git", ["remote", "add", "origin", "https://github.com/user/repo.git"], { cwd: dir })
}

interface CapturedFetch {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  redirect: string
}

function makePluginSeams(fakeHome: string, capturedFetches: CapturedFetch[]): Seams {
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined
  return {
    fs: {
      existsSync: (p: string) => realFs.existsSync(p),
      lstatSync: (p: string) => realFs.lstatSync(p) as Stats,
      statSync: (p: string) => realFs.statSync(p) as Stats,
      fstatSync: (fd: number) => realFs.fstatSync(fd) as Stats,
      mkdirSync: (p: string, opts?: { mode?: number }) => realFs.mkdirSync(p, opts),
      openSync: (p: string, flags: number, mode?: number) => realFs.openSync(p, flags, mode),
      closeSync: (fd: number) => realFs.closeSync(fd),
      writeSync: (fd: number, data: string) => realFs.writeSync(fd, data),
      readSync: (fd: number, buf: Uint8Array, off: number, len: number, pos: number | null) => realFs.readSync(fd, buf, off, len, pos),
      readdirSync: (p: string) => realFs.readdirSync(p),
      opendirSync: (p: string) => {
        const d = realFs.opendirSync(p)
        return { readSync: () => { const e = d.readSync(); return e === null ? { done: true } : { done: false, name: e.name } }, closeSync: () => d.closeSync() }
      },
      unlinkSync: (p: string) => realFs.unlinkSync(p),
      renameSync: (o: string, n: string) => realFs.renameSync(o, n),
      chmodSync: (p: string, m: number) => realFs.chmodSync(p, m),
      realpathSync: (p: string) => realFs.realpathSync(p),
      fsyncSync: (fd: number) => { try { realFs.fsyncSync(fd) } catch {} },
      fcntlConstants: () => ({
        O_NOFOLLOW: realFs.constants.O_NOFOLLOW as number | undefined,
        O_RDONLY: realFs.constants.O_RDONLY,
        O_WRONLY: realFs.constants.O_WRONLY,
        O_CREAT: realFs.constants.O_CREAT,
        O_EXCL: realFs.constants.O_EXCL,
        O_APPEND: realFs.constants.O_APPEND,
      }),
    },
    git: {
      execGit: (args: string[], cwd: string) => {
        try {
          return execFileSync("git", args, {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "ignore"],
            timeout: 5000,
            cwd,
          }).trim()
        } catch {
          return null
        }
      },
    },
    network: {
      fetch: (async (input: RequestInfo, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url
        const headers: Record<string, string> = {}
        if (init?.headers) {
          const h = init.headers as Record<string, string>
          for (const key of Object.keys(h)) headers[key] = h[key]!
        }
        capturedFetches.push({
          url,
          method: init?.method ?? "GET",
          headers,
          body: (init?.body as string) ?? "",
          redirect: (init as Record<string, string>)?.redirect ?? "",
        })
        return new Response(null, { status: 200 })
      }) as Seams["network"]["fetch"],
    },
    time: {
      now: () => Date.now(),
    },
    platform: {
      homedir: () => fakeHome,
      tmpdir: () => realOs.tmpdir(),
      getuid: uid !== undefined ? () => uid : undefined,
      platform: () => process.platform,
    },
    crypto: {
      sha256: (d: string) => createHash("sha256").update(d).digest("hex").toLowerCase(),
    },
    process: { pid: () => process.pid, aliveCheck: () => true },
  }
}

function computeExpectedId(sessionID: string, messageID: string, partID: string): string {
  const raw = `opencode:v1\x00${sessionID}\x00${messageID}\x00${partID}`
  return createHash("sha256").update(raw).digest("hex").toLowerCase()
}

describe("usage-logger plugin", () => {
  let gitDir: string
  let fakeHome: string

  beforeEach(() => {
    gitDir = tempDir()
    initGitRepo(gitDir)
    fakeHome = tempDir()
    const secretsDir = join(fakeHome, "Documents", ".secrets")
    mkdirSync(join(fakeHome, "Documents"), { mode: 0o700, recursive: true })
    mkdirSync(secretsDir, { mode: 0o700, recursive: true })
    writeFileSync(join(secretsDir, "usage-log-api-base"), "https://api.example.com", { mode: 0o400 })
    writeFileSync(join(secretsDir, "usage-log-api-key"), "sk-test123", { mode: 0o400 })
  })

  afterEach(() => {
    try { rmSync(gitDir, { recursive: true, force: true }) } catch {}
    try { rmSync(fakeHome, { recursive: true, force: true }) } catch {}
  })

  it("default-export happy path sends message.updated then message.part.updated with correct payload", async () => {
    const capturedFetches: CapturedFetch[] = []

    const fakeClient = {
      session: {
        message: async (opts: { path: { id: string; messageID: string } }) => ({
          data: {
            info: {
              role: "assistant",
              providerID: "openai",
              modelID: "gpt-4",
              mode: "chat",
              id: opts.path.messageID,
            },
          },
        }),
      },
      app: {
        log: async () => {},
      },
    }

    const hooks = await plugin({
      client: fakeClient as unknown as Parameters<typeof plugin>[0]["client"],
      project: { id: "test" } as Parameters<typeof plugin>[0]["project"],
      directory: gitDir,
      worktree: gitDir,
      serverUrl: new URL("http://localhost"),
      experimental_workspace: { register: () => {} },
      $: {} as unknown as Parameters<typeof plugin>[0]["$"],
    }, { seams: makePluginSeams(fakeHome, capturedFetches) })

    assert.ok(typeof hooks.event === "function")

    await hooks.event!({
      event: {
        type: "message.updated",
        properties: { info: { role: "assistant", providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" } },
      },
    } as unknown as Parameters<NonNullable<typeof hooks.event>>[0])

    await hooks.event!({
      event: {
        type: "message.part.updated",
        properties: {
          part: {
            id: "part1", sessionID: "sess1", messageID: "msg1", type: "step-finish",
            reason: "stop", cost: 0.01,
            tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 3 } },
          },
        },
      },
    } as unknown as Parameters<NonNullable<typeof hooks.event>>[0])

    for (let attempt = 0; attempt < 50 && capturedFetches.length === 0; attempt++) {
      await new Promise((r) => setTimeout(r, 100))
    }

    assert.ok(capturedFetches.length >= 1, "at least one fetch captured")
    const req = capturedFetches[0]!

    assert.strictEqual(req.url, "https://api.example.com/api/v2/usage-logs")
    assert.strictEqual(req.method, "POST")
    assert.strictEqual(req.headers["Authorization"], "Bearer sk-test123")
    assert.strictEqual(req.headers["Content-Type"], "application/json")
    assert.strictEqual(req.redirect, "error")

    const payload = JSON.parse(req.body)
    assert.strictEqual(payload.schemaVersion, 2)
    assert.strictEqual(payload.event, "llm.step.completed")
    assert.strictEqual(typeof payload.createdAt, "number")
    assert.ok(payload.createdAt > 0)
    assert.strictEqual(payload.providerId, "openai")
    assert.strictEqual(payload.modelId, "gpt-4")
    assert.strictEqual(payload.mode, "chat")
    assert.strictEqual(payload.usage, 0.01)
    assert.strictEqual(payload.input, 100)
    assert.strictEqual(payload.output, 50)
    assert.strictEqual(payload.reasoning, 10)
    assert.strictEqual(payload.cacheRead, 5)
    assert.strictEqual(payload.cacheWrite, 3)
    assert.strictEqual(payload.projectCode, "github.com/user/repo")

    const expectedId = computeExpectedId("sess1", "msg1", "part1")
    assert.strictEqual(payload.sourceEventId, expectedId)
  })

  it("does not read secrets or write state for non-git directory with fsCallCount === 0", async () => {
    const nonGit = tempDir()
    try {
      let fsCallCount = 0
      let fetchCallCount = 0
      let logCallCount = 0
      let stateDirCreated = false

      const probeSeams: Seams = {
        fs: {
          existsSync: (p: string) => { fsCallCount += 1; return realFs.existsSync(p) },
          lstatSync: (p: string) => { fsCallCount += 1; return realFs.lstatSync(p) as Stats },
          statSync: (p: string) => { fsCallCount += 1; return realFs.statSync(p) as Stats },
          fstatSync: (fd: number) => { fsCallCount += 1; return realFs.fstatSync(fd) as Stats },
          mkdirSync: (p: string, opts?: { mode?: number }) => {
            fsCallCount += 1
            if (p.includes("opencode-usage-logger")) stateDirCreated = true
            return realFs.mkdirSync(p, opts)
          },
          openSync: (p: string, flags: number, mode?: number) => { fsCallCount += 1; return realFs.openSync(p, flags, mode) },
          closeSync: (fd: number) => { fsCallCount += 1; realFs.closeSync(fd) },
          writeSync: (fd: number, data: string) => { fsCallCount += 1; return realFs.writeSync(fd, data) },
          readSync: (fd: number, buf: Uint8Array, off: number, len: number, pos: number | null) => { fsCallCount += 1; return realFs.readSync(fd, buf, off, len, pos) },
          readdirSync: (p: string) => { fsCallCount += 1; return realFs.readdirSync(p) },
          opendirSync: (p: string) => { fsCallCount += 1; const d = realFs.opendirSync(p); return { readSync: () => { const e = d.readSync(); return e === null ? { done: true } : { done: false, name: e.name } }, closeSync: () => d.closeSync() } },
          unlinkSync: (p: string) => { fsCallCount += 1; realFs.unlinkSync(p) },
          renameSync: (o: string, n: string) => { fsCallCount += 1; realFs.renameSync(o, n) },
          chmodSync: (p: string, m: number) => { fsCallCount += 1; realFs.chmodSync(p, m) },
          realpathSync: (p: string) => { fsCallCount += 1; return realFs.realpathSync(p) },
          fsyncSync: (fd: number) => { try { realFs.fsyncSync(fd) } catch {} },
          fcntlConstants: () => ({
            O_NOFOLLOW: realFs.constants.O_NOFOLLOW as number | undefined,
            O_RDONLY: realFs.constants.O_RDONLY,
            O_WRONLY: realFs.constants.O_WRONLY,
            O_CREAT: realFs.constants.O_CREAT,
            O_EXCL: realFs.constants.O_EXCL,
            O_APPEND: realFs.constants.O_APPEND,
          }),
        },
        git: {
          execGit: (args: string[], cwd: string) => {
            try {
              return execFileSync("git", args, {
                encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 5000, cwd,
              }).trim()
            } catch {
              return null
            }
          },
        },
        network: {
          fetch: (async (input: RequestInfo, init?: RequestInit) => {
            fetchCallCount += 1
            return new Response(null, { status: 200 })
          }) as Seams["network"]["fetch"],
        },
        time: { now: () => Date.now() },
        platform: {
          homedir: () => fakeHome,
          tmpdir: () => realOs.tmpdir(),
          getuid: typeof process.getuid === "function" ? () => process.getuid!() : undefined,
          platform: () => process.platform,
        },
        crypto: {
          sha256: (d: string) => createHash("sha256").update(d).digest("hex").toLowerCase(),
        },
        process: { pid: () => process.pid, aliveCheck: () => true },
      }

      const fakeClient = {
        session: { message: async () => ({ data: null }) },
        app: { log: async () => { logCallCount += 1 } },
      }

      const hooks = await plugin({
        client: fakeClient as unknown as Parameters<typeof plugin>[0]["client"],
        project: { id: "test" } as Parameters<typeof plugin>[0]["project"],
        directory: nonGit,
        worktree: nonGit,
        serverUrl: new URL("http://localhost"),
        experimental_workspace: { register: () => {} },
        $: {} as unknown as Parameters<typeof plugin>[0]["$"],
      }, { seams: probeSeams })

      assert.ok(typeof hooks.event === "function")
      assert.strictEqual(fetchCallCount, 0, "no network calls for non-git")
      assert.strictEqual(logCallCount, 0, "no client.app.log calls for non-git")
      assert.strictEqual(stateDirCreated, false, "no state dir created for non-git")
      assert.strictEqual(fsCallCount, 0, "no fs calls for non-git project")

      const stateDir = join(fakeHome, ".local", "state", "opencode-usage-logger")
      assert.strictEqual(existsSync(stateDir), false, "no state dir exists for non-git")
    } finally {
      try { rmSync(nonGit, { recursive: true, force: true }) } catch {}
    }
  })
})
