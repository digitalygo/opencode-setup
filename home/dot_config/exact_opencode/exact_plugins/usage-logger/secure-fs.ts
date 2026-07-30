import { relative as pathRelative } from "node:path"
import type { Seams } from "./seams.js"
import type { Stats } from "node:fs"

export interface ParentIdentity {
  dev: number
  ino: number
  uid: number
  mode: number
  realPath: string
}

export function readdirBounded(
  dir: string,
  limit: number,
  seams: Seams,
): string[] {
  const names: string[] = []
  let d = null
  try {
    d = seams.fs.opendirSync(dir)
  } catch {
    return names
  }
  try {
    while (names.length < limit) {
      const entry = d.readSync()
      if (entry.done) break
      if (entry.name) names.push(entry.name)
    }
  } finally {
    try { d.closeSync() } catch {}
  }
  return names
}

export function containsSymlinkDescendant(
  targetPath: string,
  canonicalHome: string,
  seams: Seams,
): boolean {
  const { fs } = seams
  const parts = targetPath.split("/").filter(Boolean)
  let prefix = ""
  let started = false
  for (const part of parts) {
    prefix += "/" + part
    if (!fs.existsSync(prefix)) break
    if (!started && prefix === canonicalHome) {
      started = true
      continue
    }
    if (!started) continue
    try {
      const st = fs.lstatSync(prefix)
      if (st.isSymbolicLink()) return true
    } catch {
      break
    }
  }
  return false
}

function isContained(child: string, parent: string): boolean {
  const rel = pathRelative(parent, child)
  if (rel === "") return true
  if (rel.startsWith("..")) return false
  return true
}

function isOwnedByCurrentUser(
  st: Pick<Stats, "uid" | "mode">,
  seams: Seams,
): boolean {
  const uid = seams.platform.getuid?.()
  if (uid === undefined) return true
  return st.uid === uid
}

function isRegularDir(st: Stats): boolean {
  return st.isDirectory() && !st.isSymbolicLink()
}

function hasGroupOrOtherWrite(st: Stats): boolean {
  return (st.mode & 0o022) !== 0
}

export function captureParentIdentity(
  parentDir: string,
  canonicalHome: string,
  seams: Seams,
): ParentIdentity | null {
  const { fs } = seams
  try {
    const st = fs.lstatSync(parentDir)
    if (!st.isDirectory()) return null
    if (st.isSymbolicLink()) return null
    if (!isOwnedByCurrentUser(st, seams)) return null
    if (hasGroupOrOtherWrite(st)) return null
    const realPath = fs.realpathSync(parentDir)
    if (!isContained(realPath, canonicalHome)) return null
    return {
      dev: st.dev,
      ino: st.ino,
      uid: st.uid,
      mode: st.mode,
      realPath,
    }
  } catch {
    return null
  }
}

export function parentIdentityMatches(
  parentDir: string,
  expected: ParentIdentity,
  seams: Seams,
): boolean {
  const { fs } = seams
  try {
    const st = fs.lstatSync(parentDir)
    if (st.dev !== expected.dev) return false
    if (st.ino !== expected.ino) return false
    if (st.uid !== expected.uid) return false
    if (st.mode !== expected.mode) return false
    if (!st.isDirectory()) return false
    if (st.isSymbolicLink()) return false
    const realPath = fs.realpathSync(parentDir)
    if (realPath !== expected.realPath) return false
    return true
  } catch {
    return false
  }
}

export function secureEnsureDir(
  dir: string,
  canonicalHome: string,
  seams: Seams,
): boolean {
  const { fs } = seams

  if (!isContained(dir, canonicalHome)) return false

  if (!fs.existsSync(canonicalHome)) return false
  try {
    const homeSt = fs.lstatSync(canonicalHome)
    if (!isRegularDir(homeSt)) return false
    if (!isOwnedByCurrentUser(homeSt, seams)) return false
    if (hasGroupOrOtherWrite(homeSt)) return false
  } catch {
    return false
  }

  if (dir === canonicalHome) return true

  const parts = dir.split("/").filter(Boolean)
  let current = ""
  let aboveCanonical = true

  for (let i = 0; i < parts.length; i++) {
    current += "/" + parts[i]

    if (aboveCanonical) {
      if (current === canonicalHome) {
        aboveCanonical = false
      }
      continue
    }

    if (fs.existsSync(current)) {
      try {
        const st = fs.lstatSync(current)
        if (st.isSymbolicLink()) return false
        if (!st.isDirectory()) return false
        if (!isOwnedByCurrentUser(st, seams)) return false
        if (hasGroupOrOtherWrite(st)) return false
      } catch {
        return false
      }
      continue
    }

    try {
      fs.mkdirSync(current, { mode: 0o700 })
    } catch {
      return false
    }
  }

  try {
    fs.chmodSync(dir, 0o700)
  } catch {
    return false
  }
  return true
}

function trySecureTempCleanup(
  tmpPath: string,
  parentDir: string,
  parentId: ParentIdentity,
  tempInode: { dev: number; ino: number },
  canonicalHome: string,
  seams: Seams,
): void {
  if (!parentIdentityMatches(parentDir, parentId, seams)) return
  secureUnlink(tmpPath, canonicalHome, seams, { dev: tempInode.dev, ino: tempInode.ino })
}

export function secureAtomicWrite(
  filePath: string,
  data: string,
  canonicalHome: string,
  seams: Seams,
): boolean {
  const { fs } = seams
  const parentDir = filePath.split("/").slice(0, -1).join("/")
  if (!parentDir) return false
  if (!isContained(filePath, canonicalHome)) return false

  if (!secureEnsureDir(parentDir, canonicalHome, seams)) return false
  if (containsSymlinkDescendant(parentDir, canonicalHome, seams)) return false

  const parentId = captureParentIdentity(parentDir, canonicalHome, seams)
  if (!parentId) return false

  const tmpPath = `${filePath}.tmp.${seams.time.now()}.${Math.random().toString(36).slice(2)}`
  const fcntl = fs.fcntlConstants()

  const flags = fcntl.O_CREAT | fcntl.O_EXCL | fcntl.O_WRONLY
  const finalFlags = fcntl.O_NOFOLLOW !== undefined
    ? flags | fcntl.O_NOFOLLOW
    : flags

  let fd: number
  try {
    fd = fs.openSync(tmpPath, finalFlags, 0o600)
  } catch {
    return false
  }

  let tempInode: { dev: number; ino: number }
  try {
    const fst = fs.fstatSync(fd)
    tempInode = { dev: fst.dev, ino: fst.ino }
  } catch {
    try { fs.closeSync(fd) } catch {}
    return false
  }

  let succeeded = false
  try {
    const toWrite = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data)
    let offset = 0
    while (offset < toWrite.length) {
      const written = fs.writeSync(fd, toWrite.slice(offset))
      if (written <= 0) {
        try { fs.closeSync(fd) } catch {}
        trySecureTempCleanup(tmpPath, parentDir, parentId, tempInode, canonicalHome, seams)
        return false
      }
      offset += written
    }
    if (fs.fsyncSync) {
      try {
        fs.fsyncSync(fd)
      } catch {
        try { fs.closeSync(fd) } catch {}
        trySecureTempCleanup(tmpPath, parentDir, parentId, tempInode, canonicalHome, seams)
        return false
      }
    }
    succeeded = true
  } catch {
    try { fs.closeSync(fd) } catch {}
    trySecureTempCleanup(tmpPath, parentDir, parentId, tempInode, canonicalHome, seams)
    return false
  }

  try {
    fs.closeSync(fd)
  } catch {
    trySecureTempCleanup(tmpPath, parentDir, parentId, tempInode, canonicalHome, seams)
    return false
  }

  if (!succeeded) {
    trySecureTempCleanup(tmpPath, parentDir, parentId, tempInode, canonicalHome, seams)
    return false
  }

  if (!parentIdentityMatches(parentDir, parentId, seams)) {
    trySecureTempCleanup(tmpPath, parentDir, parentId, tempInode, canonicalHome, seams)
    return false
  }

  try {
    fs.renameSync(tmpPath, filePath)
  } catch {
    trySecureTempCleanup(tmpPath, parentDir, parentId, tempInode, canonicalHome, seams)
    return false
  }

  if (!parentIdentityMatches(parentDir, parentId, seams)) {
    return false
  }

  if (fs.fsyncSync) {
    try {
      if (!parentIdentityMatches(parentDir, parentId, seams)) {
        return false
      }
      const parentFd = fs.openSync(parentDir, fcntl.O_RDONLY)
      try {
        fs.fsyncSync(parentFd)
      } finally {
        try { fs.closeSync(parentFd) } catch {}
      }
      if (!parentIdentityMatches(parentDir, parentId, seams)) {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

export function secureUnlink(
  path: string,
  canonicalHome: string,
  seams: Seams,
  expected?: { dev: number; ino: number },
): boolean {
  const { fs } = seams
  if (!isContained(path, canonicalHome)) return false
  const parentDir = path.split("/").slice(0, -1).join("/")
  if (!parentDir) return false

  const parentId = captureParentIdentity(parentDir, canonicalHome, seams)
  if (!parentId) return false

  if (expected) {
    try {
      const targetSt = fs.lstatSync(path)
      if (targetSt.dev !== expected.dev) return false
      if (targetSt.ino !== expected.ino) return false
    } catch {
      return true
    }
  }

  try {
    try {
      fs.lstatSync(path)
    } catch {
      return true
    }

    if (!parentIdentityMatches(parentDir, parentId, seams)) return false
    fs.unlinkSync(path)
    if (!parentIdentityMatches(parentDir, parentId, seams)) return false
  } catch {
    return false
  }

  if (fs.fsyncSync) {
    try {
      if (!parentIdentityMatches(parentDir, parentId, seams)) return false
      const fc = fs.fcntlConstants()
      const parentFd = fs.openSync(parentDir, fc.O_RDONLY)
      try {
        fs.fsyncSync(parentFd)
      } finally {
        try { fs.closeSync(parentFd) } catch {}
      }
      if (!parentIdentityMatches(parentDir, parentId, seams)) return false
    } catch {
      return false
    }
  }

  return true
}

export function secureValidateFile(
  path: string,
  canonicalHome: string,
  seams: Seams,
): boolean {
  const { fs } = seams
  if (!isContained(path, canonicalHome)) return false
  if (!fs.existsSync(path)) return false
  try {
    const lstat = fs.lstatSync(path)
    if (lstat.isSymbolicLink()) return false
    if (!lstat.isFile()) return false
    if (!isOwnedByCurrentUser(lstat, seams)) return false
    if ((lstat.mode & 0o777) !== 0o600) return false
    return true
  } catch {
    return false
  }
}

export function secureScanDir(
  dir: string,
  canonicalHome: string,
  seams: Seams,
  limit: number = 100000,
): { count: number; totalBytes: number } {
  let count = 0
  let totalBytes = 0
  const { fs } = seams
  if (!isContained(dir, canonicalHome)) return { count: 0, totalBytes: 0 }
  try {
    const files = readdirBounded(dir, limit, seams).filter((f: string) => f.endsWith(".json"))
    for (const file of files) {
      const fp = `${dir}/${file}`
      try {
        const st = fs.lstatSync(fp)
        if (st.isSymbolicLink()) continue
        if (!st.isFile()) continue
        if (!isOwnedByCurrentUser(st, seams)) continue
        if ((st.mode & 0o777) !== 0o600) continue
        count++
        totalBytes += st.size
      } catch {}
    }
  } catch {}
  return { count, totalBytes }
}

export function secureReadFile(
  filePath: string,
  canonicalHome: string,
  seams: Seams,
): string | null {
  const { fs } = seams
  if (!isContained(filePath, canonicalHome)) return null
  if (!fs.existsSync(filePath)) return null
  try {
    const lstat = fs.lstatSync(filePath)
    if (lstat.isSymbolicLink()) return null
    if (!lstat.isFile()) return null
    if (!isOwnedByCurrentUser(lstat, seams)) return null
  } catch {
    return null
  }

  const fcntl = fs.fcntlConstants()
  const flags =
    fcntl.O_NOFOLLOW !== undefined
      ? fcntl.O_NOFOLLOW | fcntl.O_RDONLY
      : fcntl.O_RDONLY

  const beforeFd = fs.lstatSync(filePath)
  let fd: number
  try {
    fd = fs.openSync(filePath, flags)
  } catch {
    return null
  }

  try {
    const afterStat = fs.fstatSync(fd)
    if (afterStat.dev !== beforeFd.dev || afterStat.ino !== beforeFd.ino) {
      return null
    }
    if (!afterStat.isFile()) {
      return null
    }
    if (!isOwnedByCurrentUser(afterStat, seams)) {
      return null
    }
    if ((afterStat.mode & 0o777) !== 0o600) {
      return null
    }

    const buf = Buffer.alloc(64 * 1024)
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0)

    const afterReadStat = fs.fstatSync(fd)
    if (afterReadStat.dev !== beforeFd.dev || afterReadStat.ino !== beforeFd.ino) {
      return null
    }

    return Buffer.from(buf.slice(0, bytes)).toString("utf8")
  } catch {
    return null
  } finally {
    try {
      fs.closeSync(fd)
    } catch {}
  }
}
