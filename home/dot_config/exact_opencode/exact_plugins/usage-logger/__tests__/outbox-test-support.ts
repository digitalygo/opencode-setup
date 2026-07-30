import { mkdirSync, rmSync, readdirSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { randomBytes } from "node:crypto"
import * as realFs from "node:fs"
import * as realOs from "node:os"
import * as realCrypto from "node:crypto"
import { computeSourceEventId } from "../id.js"
import type { UsageLogPayload, LogEntry } from "../types.js"
import type { Seams } from "../seams.js"

export function makeCanonicalHome(): { home: string; cleanup: () => void } {
  const home = join(tmpdir(), `ul-test-chome-${randomBytes(8).toString("hex")}`)
  mkdirSync(home, { mode: 0o700, recursive: true })
  return { home: resolve(home), cleanup: () => { try { rmSync(home, { recursive: true, force: true }) } catch {} } }
}

export function makeBaseDir(canonicalHome: string): string {
  const dir = join(canonicalHome, `test-${randomBytes(8).toString("hex")}`)
  mkdirSync(dir, { mode: 0o700 })
  return dir
}

export function makePayload(projectCode: string): UsageLogPayload {
  const sourceEventId = computeSourceEventId("sess1", "msg1", "part1")
  return {
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
    projectCode,
  }
}

export function makeFakeFetch(
  responses: Array<{ status: number }>,
): { fn: typeof fetch; calls: Array<{ url: string; headers: Record<string, string>; body: string; status: number }>; callCount(): number } {
  const calls: Array<{ url: string; headers: Record<string, string>; body: string; status: number }> = []
  const fn = async (_input: RequestInfo, _init?: RequestInit) => {
    const resp = responses.shift() ?? { status: 200 }
    const url = typeof _input === "string" ? _input : _input.url
    const info = {
      url,
      headers: {} as Record<string, string>,
      body: "",
      status: resp.status,
    }
    if (_init?.headers) {
      const h = _init.headers as Record<string, string>
      info.headers = h
    }
    if (_init?.body) {
      info.body = _init.body as string
    }
    calls.push(info)
    return new Response(null, { status: resp.status })
  }
  return { fn: fn as unknown as typeof fetch, calls, callCount: () => calls.length }
}

export function makeLogCollector(): { logCalls: LogEntry[]; logFn: (entry: LogEntry) => void } {
  const logCalls: LogEntry[] = []
  return { logCalls, logFn: (e: LogEntry) => logCalls.push(e) }
}

export function testSeams(fetchFn: typeof fetch, home: string, timeNow: () => number): Seams {
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined
  return {
    fs: {
      existsSync: (p: string) => realFs.existsSync(p),
      lstatSync: (p: string) => realFs.lstatSync(p),
      statSync: (p: string) => realFs.statSync(p),
      fstatSync: (fd: number) => realFs.fstatSync(fd),
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
    git: { execGit: () => null },
    network: { fetch: fetchFn },
    time: { now: timeNow },
    platform: {
      homedir: () => home,
      tmpdir: () => realOs.tmpdir(),
      getuid: uid !== undefined ? () => uid : undefined,
      platform: () => "linux",
    },
    crypto: { sha256: (d: string) => realCrypto.createHash("sha256").update(d).digest("hex").toLowerCase() },
    process: {
      pid: () => process.pid,
      aliveCheck: (pid: number) => {
        try { process.kill(pid, 0); return true } catch { return false }
      },
    },
  } as Seams
}

export function countFiles(dir: string): number {
  try { return readdirSync(dir).filter((f) => f.endsWith(".json")).length } catch { return 0 }
}
