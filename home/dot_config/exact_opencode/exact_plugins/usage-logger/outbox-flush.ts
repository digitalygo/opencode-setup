import type { Seams } from "./seams.js"
import type { OutboxRecord, LogEntry } from "./types.js"
import {
  SOURCE_EVENT_ID_RE,
  SAFE_FILENAME_RE,
  DEFAULT_CLAIM_STALE_MS,
  DEFAULT_CONTENTION_JITTER_MS,
  DIR_SCAN_LIMIT,
  OUTBOX_MAX_RETRIES,
  OUTBOX_MAX_AGE_MS,
  MAX_FILE_SIZE_BYTES,
  validateOutboxRecord,
  computeBackoffDelay,
  capNextAttemptAt,
} from "./outbox-validation.js"
import {
  acquireClaim,
  releaseClaim,
  readClaimMeta,
  isClaimStale,
  withinPublicationGrace,
  captureInode,
  inodeMatches,
  claimFilePath,
} from "./outbox-claims.js"
import type { ClaimContext } from "./outbox-claims.js"
import type { StorageContext } from "./outbox-storage.js"
import {
  loadOutboxFile,
  moveToDeadLetter,
} from "./outbox-storage.js"
import {
  secureAtomicWrite,
  secureUnlink,
  readdirBounded,
} from "./secure-fs.js"
import { retryable, postPayload } from "./outbox-delivery.js"

export interface FlushMutable {
  endpoint: string
  apiKey: string
  canonicalHome: string
  outboxDir: string
  deadLetterDir: string
  claimsDir: string
  disposed: boolean
  activeController: AbortController | null
  fallbackRetryAt: number | null
  maxRetryBackoffMs: number
  baseBackoffMs: number
  jitterFactor: number
  claimStaleMs: number
  contentionJitterMs: number
  publicationGraceMs: number
  maxCount: number
  log: (entry: LogEntry) => void
}

export async function processRecord(
  fp: string,
  sourceEventId: string,
  state: FlushMutable,
  storageCtx: StorageContext,
  claimCtx: ClaimContext,
  seams: Seams,
  now: number,
  scheduleRetry: () => void,
): Promise<void> {
  if (!SAFE_FILENAME_RE.test(fp.split("/").pop() ?? "")) {
    moveToDeadLetter(storageCtx, fp, "corrupt_filename", seams)
    return
  }
  if (!SOURCE_EVENT_ID_RE.test(sourceEventId)) {
    moveToDeadLetter(storageCtx, fp, "corrupt_filename", seams)
    return
  }

  const claimHandle = acquireClaim(claimCtx, sourceEventId, seams)
  if (!claimHandle) return

  try {
    let isSymlink = false
    let lstatError = false
    try {
      const lst = seams.fs.lstatSync(fp)
      if (lst.isSymbolicLink()) isSymlink = true
    } catch {
      lstatError = true
    }
    if (isSymlink || lstatError) {
      moveToDeadLetter(storageCtx, fp, "outbox_corrupt", seams)
      state.log({
        ts: new Date().toISOString(),
        sourceEventId: `corrupt_${seams.time.now()}`,
        category: "outbox_corrupt",
      })
      return
    }

    let fileSizeOk = true
    try {
      const st = seams.fs.lstatSync(fp)
      if (st.size > MAX_FILE_SIZE_BYTES) fileSizeOk = false
    } catch {
      fileSizeOk = false
    }
    if (!fileSizeOk) {
      moveToDeadLetter(storageCtx, fp, "file_too_large", seams)
      state.log({
        ts: new Date().toISOString(),
        sourceEventId: `corrupt_${seams.time.now()}`,
        category: "outbox_corrupt",
      })
      return
    }

    const record = loadOutboxFile(fp, state.canonicalHome, seams)
    if (!record) {
      moveToDeadLetter(storageCtx, fp, "corrupt_payload", seams)
      state.log({
        ts: new Date().toISOString(),
        sourceEventId: `corrupt_${seams.time.now()}`,
        category: "outbox_corrupt",
      })
      return
    }
    if (!validateOutboxRecord(record, fp, now)) {
      moveToDeadLetter(storageCtx, fp, "invalid_record", seams)
      state.log({
        ts: new Date().toISOString(),
        sourceEventId: record.sourceEventId,
        category: "outbox_corrupt",
      })
      return
    }
    if (record.nextAttemptAt && now < record.nextAttemptAt) return

    let inodeRef = captureInode(fp, seams)

    if (now - record.createdAt > OUTBOX_MAX_AGE_MS) {
      moveToDeadLetter(
        storageCtx,
        fp,
        "outbox_expired",
        seams,
        inodeRef ?? undefined,
      )
      state.log({
        ts: new Date().toISOString(),
        sourceEventId: record.sourceEventId,
        category: "outbox_expired",
      })
      return
    }
    if (record.retries >= OUTBOX_MAX_RETRIES) {
      moveToDeadLetter(
        storageCtx,
        fp,
        "outbox_retries_exhausted",
        seams,
        inodeRef ?? undefined,
      )
      state.log({
        ts: new Date().toISOString(),
        sourceEventId: record.sourceEventId,
        category: "outbox_retries_exhausted",
      })
      return
    }

    if (!inodeRef) {
      return
    }

    let result: { ok: boolean; status: number }
    state.activeController = new AbortController()
    const currentController = state.activeController
    try {
      result = await postPayload(
        state.endpoint,
        state.apiKey,
        record.payload,
        seams,
        currentController,
      )
    } catch {
      if (state.disposed) return
      if (!inodeMatches(fp, inodeRef, seams)) {
        state.log({
          ts: new Date().toISOString(),
          sourceEventId: record.sourceEventId,
          category: "outbox_inode_conflict",
        })
        return
      }
      record.retries += 1
      record.lastAttempt = now
      record.nextAttemptAt = capNextAttemptAt(
        now + computeBackoffDelay(record.retries, state.maxRetryBackoffMs, state.baseBackoffMs, state.jitterFactor),
        now,
        state.maxRetryBackoffMs,
      )
      const updated = secureAtomicWrite(
        fp,
        JSON.stringify(record),
        state.canonicalHome,
        seams,
      )
      if (!updated) {
        state.log({
          ts: new Date().toISOString(),
          sourceEventId: record.sourceEventId,
          category: "outbox_atomic_write_failed",
        })
        const fallbackDelay = computeBackoffDelay(record.retries, state.maxRetryBackoffMs, state.baseBackoffMs, state.jitterFactor)
        state.fallbackRetryAt = now + fallbackDelay
        scheduleRetry()
      }
      return
    } finally {
      if (state.activeController === currentController) {
        state.activeController = null
      }
    }
    if (state.disposed) return
    if (result.ok) {
      if (!inodeMatches(fp, inodeRef, seams)) {
        state.log({
          ts: new Date().toISOString(),
          sourceEventId: record.sourceEventId,
          category: "outbox_inode_conflict",
        })
        return
      }
      const deleted = secureUnlink(fp, state.canonicalHome, seams, inodeRef)
      if (deleted) {
        state.log({
          ts: new Date().toISOString(),
          sourceEventId: record.sourceEventId,
          status: result.status,
          category: "delivered",
        })
      } else {
        state.log({
          ts: new Date().toISOString(),
          sourceEventId: record.sourceEventId,
          status: result.status,
          category: "delivery_delete_failed",
        })
      }
      return
    }
    if (retryable(result.status)) {
      if (!inodeMatches(fp, inodeRef, seams)) {
        state.log({
          ts: new Date().toISOString(),
          sourceEventId: record.sourceEventId,
          category: "outbox_inode_conflict",
        })
        return
      }
      record.retries += 1
      record.lastAttempt = now
      record.nextAttemptAt = capNextAttemptAt(
        now + computeBackoffDelay(record.retries, state.maxRetryBackoffMs, state.baseBackoffMs, state.jitterFactor),
        now,
        state.maxRetryBackoffMs,
      )
      const updated = secureAtomicWrite(
        fp,
        JSON.stringify(record),
        state.canonicalHome,
        seams,
      )
      if (!updated) {
        state.log({
          ts: new Date().toISOString(),
          sourceEventId: record.sourceEventId,
          category: "outbox_atomic_write_failed",
        })
        const fallbackDelay = computeBackoffDelay(record.retries, state.maxRetryBackoffMs, state.baseBackoffMs, state.jitterFactor)
        state.fallbackRetryAt = now + fallbackDelay
        scheduleRetry()
      }
      state.log({
        ts: new Date().toISOString(),
        sourceEventId: record.sourceEventId,
        status: result.status,
        category: "retryable",
      })
      return
    }
    if (state.disposed) return
    moveToDeadLetter(
      storageCtx,
      fp,
      `permanent_${result.status}`,
      seams,
      inodeRef,
    )
    state.log({
      ts: new Date().toISOString(),
      sourceEventId: record.sourceEventId,
      status: result.status,
      category: "permanent",
    })
  } finally {
    releaseClaim(claimCtx, claimHandle, seams)
  }
}

export function computeNextRetryDelay(
  state: FlushMutable,
  seams: Seams,
): number | null {
  let nearest = Number.POSITIVE_INFINITY
  const now = seams.time.now()
  const { canonicalHome } = state
  try {
    const files = readdirBounded(state.outboxDir, DIR_SCAN_LIMIT, seams)
      .filter((f) => f.endsWith(".json"))
    for (const file of files) {
      const fp = `${state.outboxDir}/${file}`
      try {
        const lst = seams.fs.lstatSync(fp)
        if (lst.isSymbolicLink()) continue
      } catch {
        continue
      }
      const candidateId = file.replace(/\.json$/, "")
      const cp = claimFilePath(state.claimsDir, candidateId)
      const claimInode = captureInode(cp, seams)
      if (claimInode) {
        const claim = readClaimMeta(cp, canonicalHome, seams)
        if (claim && !isClaimStale(claim, now, seams, state.claimStaleMs)) {
          const claimExpiry = claim.createdAt + state.claimStaleMs
          const jitter = Math.floor(Math.random() * state.contentionJitterMs)
          const contentionAt = claimExpiry + 1 + jitter
          if (contentionAt < nearest) {
            nearest = contentionAt
          }
          continue
        }
        if (!claim && withinPublicationGrace(cp, now, state.publicationGraceMs, seams)) {
          let graceExpiry = now + state.publicationGraceMs
          try {
            const st = seams.fs.lstatSync(cp)
            graceExpiry = Math.max(st.mtimeMs, st.ctimeMs) + state.publicationGraceMs
          } catch {}
          const jitter = Math.floor(Math.random() * state.contentionJitterMs)
          const wakeAt = graceExpiry + 1 + jitter
          if (wakeAt < nearest) {
            nearest = wakeAt
          }
          continue
        }
      }
      const record = loadOutboxFile(fp, canonicalHome, seams)
      if (
        record?.nextAttemptAt != null &&
        record.nextAttemptAt < nearest
      ) {
        nearest = record.nextAttemptAt
      }
    }
  } catch {}
  if (state.fallbackRetryAt !== null && state.fallbackRetryAt < nearest) {
    nearest = state.fallbackRetryAt
  }
  if (nearest <= 0 || !Number.isFinite(nearest)) return null
  const delay = Math.max(0, nearest - seams.time.now())
  if (delay > 30 * 24 * 60 * 60 * 1000) return null
  return delay
}
