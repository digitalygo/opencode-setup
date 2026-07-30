import { randomBytes } from "node:crypto"
import { resolve, relative, dirname, basename } from "node:path"
import {
  secureAtomicWrite,
  secureReadFile,
  secureScanDir,
  secureValidateFile,
  secureUnlink,
  readdirBounded,
} from "./secure-fs.js"
import type { Seams } from "./seams.js"
import type { OutboxRecord, LogEntry } from "./types.js"
import {
  SOURCE_EVENT_ID_RE,
  OUTBOX_MAX_AGE_MS,
  MAX_DEAD_LETTER_COUNT,
  MAX_DEAD_LETTER_AGE_MS,
  DIR_SCAN_LIMIT,
  MAX_FILE_SIZE_BYTES,
} from "./outbox-validation.js"
import type { InodeRef } from "./outbox-claims.js"
import {
  acquireClaim,
  releaseClaim,
  readClaimMeta,
  isClaimStale,
  captureInode,
  claimFilePath,
} from "./outbox-claims.js"

export interface StorageContext {
  outboxDir: string
  deadLetterDir: string
  claimsDir: string
  canonicalHome: string
  maxCount: number
  maxTotalBytes: number
  claimStaleMs: number
  publicationGraceMs: number
  log: (entry: LogEntry) => void
}

export function loadOutboxFile(
  path: string,
  canonicalHome: string,
  seams: Seams,
  maxBytes: number = MAX_FILE_SIZE_BYTES,
): OutboxRecord | null {
  if (!secureValidateFile(path, canonicalHome, seams)) return null
  try {
    const st = seams.fs.lstatSync(path)
    if (st.size > maxBytes) return null
  } catch {
    return null
  }
  const raw = secureReadFile(path, canonicalHome, seams)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as OutboxRecord
  } catch {
    return null
  }
}

export function expireAgedOutbox(
  ctx: StorageContext,
  seams: Seams,
): void {
  const now = seams.time.now()
  const { canonicalHome } = ctx
  try {
    const files = readdirBounded(ctx.outboxDir, DIR_SCAN_LIMIT, seams)
      .filter((f) => f.endsWith(".json"))
    for (const file of files) {
      const fp = `${ctx.outboxDir}/${file}`
      const sourceEventId = file.replace(/\.json$/, "")
      const isSafeName = SOURCE_EVENT_ID_RE.test(sourceEventId)
      if (isSafeName) {
        const claimHandle = acquireClaim(
          { claimsDir: ctx.claimsDir, canonicalHome, claimStaleMs: ctx.claimStaleMs, publicationGraceMs: ctx.publicationGraceMs },
          sourceEventId,
          seams,
        )
        if (!claimHandle) continue
        try {
          let isSymlink = false
          let isAged = false
          let inodeRef: InodeRef | null = null
          try {
            const lst = seams.fs.lstatSync(fp)
            if (lst.isSymbolicLink()) {
              isSymlink = true
            } else if (now - lst.mtimeMs > OUTBOX_MAX_AGE_MS) {
              isAged = true
              inodeRef = captureInode(fp, seams)
            }
          } catch {}
          if (isSymlink) {
            moveToDeadLetter(
              ctx,
              fp,
              "outbox_expired",
              seams,
              inodeRef ?? undefined,
            )
          } else if (isAged) {
            moveToDeadLetter(
              ctx,
              fp,
              "outbox_expired",
              seams,
              inodeRef ?? undefined,
            )
          }
        } finally {
          releaseClaim(
            { claimsDir: ctx.claimsDir, canonicalHome, claimStaleMs: ctx.claimStaleMs, publicationGraceMs: ctx.publicationGraceMs },
            claimHandle,
            seams,
          )
        }
      } else {
        try {
          const lst = seams.fs.lstatSync(fp)
          if (lst.isSymbolicLink()) {
            moveToDeadLetter(
              ctx,
              fp,
              "outbox_expired",
              seams,
            )
          } else if (now - lst.mtimeMs > OUTBOX_MAX_AGE_MS) {
            moveToDeadLetter(
              ctx,
              fp,
              "outbox_expired",
              seams,
            )
          }
        } catch {}
      }
    }
  } catch {}
}

export function trimDeadLetter(ctx: StorageContext, seams: Seams): void {
  const { fs } = seams
  const now = seams.time.now()
  try {
    const files = readdirBounded(ctx.deadLetterDir, DIR_SCAN_LIMIT, seams)
      .filter((f) => f.endsWith(".json"))
    for (const file of files) {
      const fp = `${ctx.deadLetterDir}/${file}`
      try {
        const lst = fs.lstatSync(fp)
        if (lst.isSymbolicLink()) {
          try {
            secureUnlink(fp, ctx.canonicalHome, seams)
          } catch {}
          continue
        }
        if (now - lst.mtimeMs > MAX_DEAD_LETTER_AGE_MS) {
          secureUnlink(fp, ctx.canonicalHome, seams)
        }
      } catch {
        try {
          secureUnlink(fp, ctx.canonicalHome, seams)
        } catch {}
      }
    }
    const remaining = readdirBounded(ctx.deadLetterDir, DIR_SCAN_LIMIT, seams)
      .filter((f) => f.endsWith(".json"))
      .map((f) => `${ctx.deadLetterDir}/${f}`)
      .sort((a, b) => {
        try {
          const sa = fs.lstatSync(a)
          const sb = fs.lstatSync(b)
          if (sa.isSymbolicLink() || sb.isSymbolicLink()) return 0
          return sa.mtimeMs - sb.mtimeMs
        } catch {
          return 0
        }
      })
    while (remaining.length > MAX_DEAD_LETTER_COUNT) {
      const old = remaining.shift()
      if (old)
        try {
          secureUnlink(old, ctx.canonicalHome, seams)
        } catch {}
    }
  } catch {}
}

export function moveToDeadLetter(
  ctx: StorageContext,
  sourceFilePath: string,
  reason: string,
  seams: Seams,
  expectedSourceInode?: InodeRef,
): void {
  const { canonicalHome, outboxDir } = ctx

  const resolvedSource = resolve(sourceFilePath)
  const resolvedOutbox = resolve(outboxDir)
  const rel = relative(resolvedOutbox, resolvedSource)
  if (rel.startsWith("..") || rel === "" || rel.includes("/")) {
    return
  }
  const base = basename(rel)
  if (!base.endsWith(".json")) return
  const dirCheck = dirname(rel)
  if (dirCheck !== ".") return

  let markerId: string
  let markerPayload: Record<string, unknown>

  const record = loadOutboxFile(resolvedSource, canonicalHome, seams)
  if (record && SOURCE_EVENT_ID_RE.test(record.sourceEventId)) {
    markerId = record.sourceEventId
    markerPayload = {
      sourceEventId: record.sourceEventId,
      movedAt: seams.time.now(),
      reason,
    }
  } else {
    const randHex = randomBytes(8).toString("hex")
    markerId = `corrupt.${seams.time.now()}.${randHex}`
    markerPayload = {
      movedAt: seams.time.now(),
      reason,
    }
  }

  const dlPath = `${ctx.deadLetterDir}/${markerId}.json`
  const ok = secureAtomicWrite(
    dlPath,
    JSON.stringify(markerPayload),
    ctx.canonicalHome,
    seams,
  )
  if (!ok) {
    ctx.log({
      ts: new Date().toISOString(),
      sourceEventId: markerId,
      category: "dead_letter_write_failed",
    })
    return
  }

  const fs = seams.fs
  try {
    const lst = fs.lstatSync(resolvedSource)
    if (lst.isSymbolicLink()) {
      const removed = secureUnlink(resolvedSource, canonicalHome, seams)
      if (!removed) {
        ctx.log({
          ts: new Date().toISOString(),
          sourceEventId: markerId,
          category: "outbox_remove_failed",
        })
      }
    } else if (lst.isFile()) {
      const sourceInode = expectedSourceInode ?? { dev: lst.dev, ino: lst.ino }
      const removed = secureUnlink(resolvedSource, canonicalHome, seams, sourceInode)
      if (!removed) {
        ctx.log({
          ts: new Date().toISOString(),
          sourceEventId: markerId,
          category: "outbox_remove_failed",
        })
      }
    }
  } catch {
    const removed = expectedSourceInode
      ? secureUnlink(resolvedSource, canonicalHome, seams, expectedSourceInode)
      : secureUnlink(resolvedSource, canonicalHome, seams)
    if (!removed) {
      ctx.log({
        ts: new Date().toISOString(),
        sourceEventId: markerId,
        category: "outbox_remove_failed",
      })
    }
  }
  trimDeadLetter(ctx, seams)
}

export function enforceQuota(
  ctx: StorageContext,
  seams: Seams,
  recordBytes: number,
): boolean {
  if (recordBytes > ctx.maxTotalBytes) {
    ctx.log({
      ts: new Date().toISOString(),
      sourceEventId: "quota",
      category: "outbox_quota_rejected",
    })
    return false
  }
  const { count, totalBytes } = secureScanDir(
    ctx.outboxDir,
    ctx.canonicalHome,
    seams,
  )
  if (count >= ctx.maxCount) {
    expireAgedOutbox(ctx, seams)
    const after = secureScanDir(
      ctx.outboxDir,
      ctx.canonicalHome,
      seams,
    )
    if (after.count >= ctx.maxCount) {
      ctx.log({
        ts: new Date().toISOString(),
        sourceEventId: "quota",
        category: "outbox_quota_rejected",
      })
      return false
    }
  }
  if (totalBytes + recordBytes > ctx.maxTotalBytes) {
    expireAgedOutbox(ctx, seams)
    const after = secureScanDir(
      ctx.outboxDir,
      ctx.canonicalHome,
      seams,
    )
    if (after.totalBytes + recordBytes > ctx.maxTotalBytes) {
      ctx.log({
        ts: new Date().toISOString(),
        sourceEventId: "quota",
        category: "outbox_quota_rejected",
      })
      return false
    }
  }
  return true
}

export function outboxFilePath(outboxDir: string, id: string): string {
  return `${outboxDir}/${id}.json`
}
