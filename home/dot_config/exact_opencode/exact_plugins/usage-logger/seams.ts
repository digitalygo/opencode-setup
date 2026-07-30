import type { Stats } from "node:fs"

export interface DirOps {
  readSync(): { done: boolean; name?: string }
  closeSync(): void
}

export interface FileSystemOps {
  existsSync(path: string): boolean
  lstatSync(path: string): Stats
  statSync(path: string): Stats
  fstatSync(fd: number): Stats
  mkdirSync(path: string, options?: { mode?: number }): void
  openSync(path: string, flags: number, mode?: number): number
  closeSync(fd: number): void
  writeSync(fd: number, data: Uint8Array | string): number
  readSync(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): number
  readdirSync(path: string): string[]
  opendirSync(path: string): DirOps
  unlinkSync(path: string): void
  renameSync(oldPath: string, newPath: string): void
  chmodSync(path: string, mode: number): void
  realpathSync(path: string): string
  fsyncSync?(fd: number): void
  fcntlConstants(): {
    O_NOFOLLOW: number | undefined
    O_RDONLY: number
    O_WRONLY: number
    O_CREAT: number
    O_EXCL: number
    O_APPEND: number
  }
}

export interface GitOps {
  execGit(args: string[], cwd: string): string | null
}

export interface NetworkOps {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>
}

export interface TimeOps {
  now: () => number
}

export interface PlatformOps {
  homedir: () => string
  tmpdir: () => string
  getuid: (() => number) | undefined
  platform: () => string
}

export interface CryptoOps {
  sha256(data: string): string
}

export interface ProcessOps {
  pid(): number
  aliveCheck(pid: number): boolean
}

export interface Seams {
  fs: FileSystemOps
  git: GitOps
  network: NetworkOps
  time: TimeOps
  platform: PlatformOps
  crypto: CryptoOps
  process: ProcessOps
}
