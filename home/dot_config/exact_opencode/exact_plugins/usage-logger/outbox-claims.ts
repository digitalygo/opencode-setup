import { randomBytes } from "node:crypto"
import { dirname } from "node:path"
import {
  secureEnsureDir,
  captureParentIdentity,
  parentIdentityMatches,
  secureReadFile,
  secureUnlink,
} from "./secure-fs.js"
import type { Seams } from "./seams.js"
import { isContained } from "./outbox-validation.js"

export interface ClaimMeta {
  pid: number
  createdAt: number
  nonce: string
}

export interface InodeRef {
  dev: number
  ino: number
}

export interface ClaimHandle {
  sourceEventId: string
  dev: number
  ino: number
  nonce: string
}

export interface ClaimContext {
  claimsDir: string
  canonicalHome: string
  claimStaleMs: number
  publicationGraceMs: number
}

export function captureInode(filePath: string, seams: Seams): InodeRef | null {
  try {
    const st = seams.fs.lstatSync(filePath)
    if (st.isSymbolicLink()) return null
    return { dev: st.dev, ino: st.ino }
  } catch {
    return null
  }
}

export function inodeMatches(filePath: string, ref: InodeRef, seams: Seams): boolean {
  const current = captureInode(filePath, seams)
  if (!current) return false
  return current.dev === ref.dev && current.ino === ref.ino
}

export function safeClaimCleanup(
  path: string,
  canonicalHome: string,
  seams: Seams,
  expectedInode?: InodeRef,
): void {
  secureUnlink(path, canonicalHome, seams, expectedInode)
}

export function tryCreateClaimFile(
  path: string,
  meta: ClaimMeta,
  canonicalHome: string,
  seams: Seams,
): InodeRef | null {
  const { fs } = seams
  const parentDir = dirname(path)
  if (!parentDir) return null
  if (!isContained(path, canonicalHome)) return null
  if (!secureEnsureDir(parentDir, canonicalHome, seams)) return null

  const parentId = captureParentIdentity(parentDir, canonicalHome, seams)
  if (!parentId) return null

  const fcntl = fs.fcntlConstants()
  const flags = fcntl.O_CREAT | fcntl.O_EXCL | fcntl.O_WRONLY
  const finalFlags = fcntl.O_NOFOLLOW !== undefined
    ? flags | fcntl.O_NOFOLLOW
    : flags

  let fd: number
  try {
    fd = fs.openSync(path, finalFlags, 0o600)
  } catch {
    return null
  }

  let claimInode: InodeRef
  try {
    const fst = fs.fstatSync(fd)
    claimInode = { dev: fst.dev, ino: fst.ino }
  } catch {
    try { fs.closeSync(fd) } catch {}
    return null
  }

  let ok = false
  try {
    const data = JSON.stringify(meta)
    const buf = Buffer.from(data, "utf8")
    let offset = 0
    while (offset < buf.length) {
      const written = fs.writeSync(fd, buf.slice(offset))
      if (written <= 0) {
        try { fs.closeSync(fd) } catch {}
        safeClaimCleanup(path, canonicalHome, seams, claimInode)
        return null
      }
      offset += written
    }
    if (fs.fsyncSync) {
      try { fs.fsyncSync(fd) } catch {
        try { fs.closeSync(fd) } catch {}
        safeClaimCleanup(path, canonicalHome, seams, claimInode)
        return null
      }
    }
    ok = true
  } catch {
    try { fs.closeSync(fd) } catch {}
    safeClaimCleanup(path, canonicalHome, seams, claimInode)
    return null
  }

  try { fs.closeSync(fd) } catch {
    safeClaimCleanup(path, canonicalHome, seams, claimInode)
    return null
  }

  if (!ok) {
    safeClaimCleanup(path, canonicalHome, seams, claimInode)
    return null
  }

  if (!parentIdentityMatches(parentDir, parentId, seams)) {
    safeClaimCleanup(path, canonicalHome, seams, claimInode)
    return null
  }

  if (fs.fsyncSync) {
    try {
      const parentFd = fs.openSync(parentDir, fcntl.O_RDONLY)
      try { fs.fsyncSync(parentFd) } finally { try { fs.closeSync(parentFd) } catch {} }
    } catch {
      safeClaimCleanup(path, canonicalHome, seams, claimInode)
      return null
    }
    if (!parentIdentityMatches(parentDir, parentId, seams)) {
      safeClaimCleanup(path, canonicalHome, seams, claimInode)
      return null
    }
  }

  return claimInode
}

export function readClaimMeta(
  path: string,
  canonicalHome: string,
  seams: Seams,
): ClaimMeta | null {
  const raw = secureReadFile(path, canonicalHome, seams)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (
      typeof parsed.pid === "number" &&
      Number.isFinite(parsed.pid) &&
      Number.isInteger(parsed.pid) &&
      parsed.pid > 0 &&
      typeof parsed.createdAt === "number" &&
      Number.isFinite(parsed.createdAt) &&
      parsed.createdAt > 0 &&
      typeof parsed.nonce === "string" &&
      parsed.nonce.length > 0
    ) {
      return { pid: parsed.pid, createdAt: parsed.createdAt, nonce: parsed.nonce }
    }
    return null
  } catch {
    return null
  }
}

export function isClaimStale(
  claim: ClaimMeta,
  now: number,
  seams: Seams,
  claimStaleMs: number,
): boolean {
  if (now - claim.createdAt >= claimStaleMs) return true
  if (claim.pid === seams.process.pid()) return false
  if (!seams.process.aliveCheck(claim.pid)) return true
  return false
}

export function withinPublicationGrace(
  claimPath: string,
  now: number,
  graceMs: number,
  seams: Seams,
): boolean {
  try {
    const st = seams.fs.lstatSync(claimPath)
    return (now - st.mtimeMs) < graceMs || (now - st.ctimeMs) < graceMs
  } catch {
    return false
  }
}

export function releaseClaimFile(
  path: string,
  canonicalHome: string,
  seams: Seams,
  expected?: InodeRef,
): boolean {
  const { fs } = seams
  const deleted = secureUnlink(path, canonicalHome, seams, expected)
  if (deleted && fs.fsyncSync) {
    const parentDir = dirname(path)
    try {
      const fcntl = fs.fcntlConstants()
      const parentFd = fs.openSync(parentDir, fcntl.O_RDONLY)
      try { fs.fsyncSync(parentFd) } finally { try { fs.closeSync(parentFd) } catch {} }
    } catch {}
  }
  return deleted
}

export function acquireClaim(
  ctx: ClaimContext,
  sourceEventId: string,
  seams: Seams,
): ClaimHandle | null {
  const cp = claimFilePath(ctx.claimsDir, sourceEventId)
  const now = seams.time.now()
  const nonce = randomBytes(16).toString("hex")

  const ownInode = tryCreateClaimFile(
    cp,
    { pid: seams.process.pid(), createdAt: now, nonce },
    ctx.canonicalHome,
    seams,
  )
  if (ownInode) {
    return { sourceEventId, dev: ownInode.dev, ino: ownInode.ino, nonce }
  }

  const existingInode = captureInode(cp, seams)
  if (!existingInode) {
    const retryInode = tryCreateClaimFile(
      cp,
      { pid: seams.process.pid(), createdAt: now, nonce },
      ctx.canonicalHome,
      seams,
    )
    if (retryInode) return { sourceEventId, dev: retryInode.dev, ino: retryInode.ino, nonce }
    return null
  }

  const existingClaim = readClaimMeta(cp, ctx.canonicalHome, seams)
  if (!existingClaim) {
    if (withinPublicationGrace(cp, now, ctx.publicationGraceMs, seams)) return null
    releaseClaimFile(cp, ctx.canonicalHome, seams, existingInode)
    const retryInode = tryCreateClaimFile(
      cp,
      { pid: seams.process.pid(), createdAt: now, nonce },
      ctx.canonicalHome,
      seams,
    )
    if (retryInode) return { sourceEventId, dev: retryInode.dev, ino: retryInode.ino, nonce }
    return null
  }

  if (!isClaimStale(existingClaim, now, seams, ctx.claimStaleMs)) return null

  const released = releaseClaimFile(cp, ctx.canonicalHome, seams, existingInode)
  if (!released) return null

  const takeoverInode = tryCreateClaimFile(
    cp,
    { pid: seams.process.pid(), createdAt: now, nonce },
    ctx.canonicalHome,
    seams,
  )
  if (takeoverInode) return { sourceEventId, dev: takeoverInode.dev, ino: takeoverInode.ino, nonce }
  return null
}

export function releaseClaim(
  ctx: ClaimContext,
  handle: ClaimHandle | null,
  seams: Seams,
): void {
  if (!handle) return
  const cp = claimFilePath(ctx.claimsDir, handle.sourceEventId)
  const claimMeta = readClaimMeta(cp, ctx.canonicalHome, seams)
  if (!claimMeta || claimMeta.nonce !== handle.nonce) return
  releaseClaimFile(cp, ctx.canonicalHome, seams, { dev: handle.dev, ino: handle.ino })
}

export function claimFilePath(claimsDir: string, id: string): string {
  return `${claimsDir}/${id}.json`
}
