import * as fs from "node:fs"
import * as os from "node:os"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import type { Seams } from "./seams.js"

const fcntl = fs.constants

export function createRealSeams(): Seams {
  return {
    fs: {
      existsSync: (path) => fs.existsSync(path),
      lstatSync: (path) => fs.lstatSync(path),
      statSync: (path) => fs.statSync(path),
      fstatSync: (fd) => fs.fstatSync(fd),
      mkdirSync: (path, options) => fs.mkdirSync(path, options),
      openSync: (path, flags, mode) => fs.openSync(path, flags, mode),
      closeSync: (fd) => fs.closeSync(fd),
      writeSync: (fd, data) =>
        fs.writeSync(fd, data as string),
      readSync: (fd, buffer, offset, length, position) =>
        fs.readSync(fd, buffer, offset, length, position),
      readdirSync: (path) => fs.readdirSync(path),
      opendirSync: (path) => {
        const d = fs.opendirSync(path)
        return {
          readSync: () => {
            const entry = d.readSync()
            if (entry === null) return { done: true }
            return { done: false, name: entry.name }
          },
          closeSync: () => d.closeSync(),
        }
      },
      unlinkSync: (path) => fs.unlinkSync(path),
      renameSync: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
      chmodSync: (path, mode) => fs.chmodSync(path, mode),
      realpathSync: (path) => fs.realpathSync(path),
      fsyncSync: (fd) => fs.fsyncSync(fd),
      fcntlConstants: () => ({
        O_NOFOLLOW:
          typeof fcntl.O_NOFOLLOW === "number"
            ? fcntl.O_NOFOLLOW
            : undefined,
        O_RDONLY: fcntl.O_RDONLY,
        O_WRONLY: fcntl.O_WRONLY,
        O_CREAT: fcntl.O_CREAT,
        O_EXCL: fcntl.O_EXCL,
        O_APPEND: fcntl.O_APPEND,
      }),
    },
    git: {
      execGit: (args, cwd) => {
        try {
          const result = execFileSync("git", args, {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "ignore"],
            timeout: 5000,
            cwd,
          })
          return result.trim()
        } catch {
          return null
        }
      },
    },
    network: {
      fetch: (input, init) => fetch(input, init),
    },
    time: {
      now: () => Date.now(),
    },
    platform: {
      homedir: () => os.homedir(),
      tmpdir: () => os.tmpdir(),
      getuid: typeof process.getuid === "function" ? () => process.getuid!() : undefined,
      platform: () => process.platform,
    },
    crypto: {
      sha256: (data) =>
        createHash("sha256").update(data).digest("hex").toLowerCase(),
    },
    process: {
      pid: () => process.pid,
      aliveCheck: (pid: number) => {
        try {
          process.kill(pid, 0)
          return true
        } catch {
          return false
        }
      },
    },
  }
}
