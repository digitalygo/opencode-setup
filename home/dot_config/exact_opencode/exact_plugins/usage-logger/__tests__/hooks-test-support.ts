import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { randomBytes } from "node:crypto"
import * as realFs from "node:fs"
import * as realOs from "node:os"
import * as realCrypto from "node:crypto"
import type { ResolvedConfig } from "../types.js"
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

export type FakeClient = {
  session: {
    message: (opts: { path: { id: string; messageID: string } }) => Promise<{
      data: { info: { role: string; providerID: string; modelID: string; mode: string; id: string } } | null
    }>
  }
  app: {
    log: (opts: {
      body: { service: string; level: "debug" | "info" | "warn" | "error"; message: string; extra?: Record<string, unknown> }
    }) => Promise<unknown>
  }
}

export type LogCall = { service: string; level: string; message: string; extra?: Record<string, unknown> }

export function testSeams(home: string): Seams {
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
    network: { fetch: (async () => new Response(null, { status: 200 })) as Seams["network"]["fetch"] },
    time: { now: () => Date.now() },
    platform: {
      homedir: () => home,
      tmpdir: () => realOs.tmpdir(),
      getuid: uid !== undefined ? () => uid : undefined,
      platform: () => "linux",
    },
    crypto: { sha256: (d: string) => realCrypto.createHash("sha256").update(d).digest("hex").toLowerCase() },
    process: { pid: () => process.pid, aliveCheck: () => true },
  }
}

export function makeFakeClient(
  overrides: Partial<{
    messageData: { role: string; providerID: string; modelID: string; mode: string; id: string } | null
  }> = {},
): { client: FakeClient; logCalls: LogCall[] } {
  const logCalls: LogCall[] = []
  const defaultInfo = { role: "assistant" as const, providerID: "openai", modelID: "gpt-4", mode: "chat", id: "msg1" }
  const client: FakeClient = {
    session: {
      message: async () => {
        if (overrides.messageData === null) return { data: null as unknown as { info: never } }
        return { data: { info: overrides.messageData ?? defaultInfo } }
      },
    },
    app: {
      log: async (opts) => {
        logCalls.push({ service: opts.body.service, level: opts.body.level, message: opts.body.message, extra: opts.body.extra })
      },
    },
  }
  return { client, logCalls }
}
