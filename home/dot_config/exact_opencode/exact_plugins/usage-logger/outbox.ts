import {
  secureEnsureDir,
  secureAtomicWrite,
  readdirBounded,
} from "./secure-fs.js"
import type { Seams } from "./seams.js"
import type { UsageLogPayload, LogEntry } from "./types.js"
import {
  SOURCE_EVENT_ID_RE,
  validatePayload,
  DEFAULT_PUBLICATION_GRACE_MS,
  DEFAULT_MAX_COUNT,
  DEFAULT_MAX_TOTAL_BYTES,
  DEFAULT_CLAIM_STALE_MS,
  DEFAULT_CONTENTION_JITTER_MS,
  FLUSH_FILE_OVERSCAN,
  DIR_SCAN_LIMIT,
} from "./outbox-validation.js"
import {
  acquireClaim,
  releaseClaim,
  readClaimMeta,
  isClaimStale,
  withinPublicationGrace,
  captureInode,
  releaseClaimFile,
  claimFilePath,
} from "./outbox-claims.js"
import type { ClaimContext } from "./outbox-claims.js"
import type { StorageContext } from "./outbox-storage.js"
import {
  enforceQuota,
  expireAgedOutbox,
  outboxFilePath,
} from "./outbox-storage.js"
import {
  processRecord,
  computeNextRetryDelay,
} from "./outbox-flush.js"
import type { FlushMutable } from "./outbox-flush.js"

export { OUTBOX_MAX_RETRIES } from "./outbox-validation.js"

export interface OutboxOptions {
  maxCount?: number
  maxTotalBytes?: number
  maxRetryBackoffMs?: number
  baseBackoffMs?: number
  jitterFactor?: number
  autoflush?: boolean
  claimStaleMs?: number
  contentionJitterMs?: number
  publicationGraceMs?: number
}

interface OutboxState extends FlushMutable {
  flushLock: Promise<void> | null
  flushRequested: boolean
  retryTimer: ReturnType<typeof setTimeout> | null
  options: Required<OutboxOptions>
}

function clearRetryTimer(state: OutboxState): void {
  if (state.retryTimer !== null) {
    clearTimeout(state.retryTimer)
    state.retryTimer = null
  }
}

function cleanupStaleClaims(
  state: OutboxState,
  seams: Seams,
): void {
  const now = seams.time.now()
  const { claimsDir, canonicalHome } = state
  try {
    const files = readdirBounded(claimsDir, DIR_SCAN_LIMIT, seams)
      .filter((f) => f.endsWith(".json"))
    for (const file of files) {
      const fp = `${claimsDir}/${file}`
      const claimInode = captureInode(fp, seams)
      if (!claimInode) continue
      const claim = readClaimMeta(fp, canonicalHome, seams)
      if (!claim) {
        if (withinPublicationGrace(fp, now, state.publicationGraceMs, seams)) continue
        releaseClaimFile(fp, canonicalHome, seams, claimInode)
        continue
      }
      if (isClaimStale(claim, now, seams, state.claimStaleMs)) {
        releaseClaimFile(fp, canonicalHome, seams, claimInode)
      }
    }
  } catch {}
}

export interface Outbox {
  enqueue(sourceEventId: string, payload: UsageLogPayload): boolean
  flush(): Promise<void>
  dispose(): Promise<void>
}

export function createOutbox(
  baseDir: string,
  apiKey: string,
  endpoint: string,
  canonicalHome: string,
  seams: Seams,
  logFn: (entry: LogEntry) => void,
  options: OutboxOptions = {},
): Outbox {
  const resolvedOptions: Required<OutboxOptions> = {
    maxCount: options.maxCount ?? DEFAULT_MAX_COUNT,
    maxTotalBytes: options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
    maxRetryBackoffMs: options.maxRetryBackoffMs ?? 30000,
    baseBackoffMs: options.baseBackoffMs ?? 1000,
    jitterFactor: options.jitterFactor ?? 0.5,
    autoflush: options.autoflush ?? true,
    claimStaleMs: options.claimStaleMs ?? DEFAULT_CLAIM_STALE_MS,
    contentionJitterMs: options.contentionJitterMs ?? DEFAULT_CONTENTION_JITTER_MS,
    publicationGraceMs: options.publicationGraceMs ?? DEFAULT_PUBLICATION_GRACE_MS,
  }

  const outboxDir = `${baseDir}/outbox`
  const deadLetterDir = `${baseDir}/dead-letter`
  const claimsDir = `${baseDir}/claims`

  if (!secureEnsureDir(baseDir, canonicalHome, seams))
    throw new Error("outbox_base_dir_setup_failed")
  if (!secureEnsureDir(outboxDir, canonicalHome, seams))
    throw new Error("outbox_dir_setup_failed")
  if (!secureEnsureDir(deadLetterDir, canonicalHome, seams))
    throw new Error("dead_letter_dir_setup_failed")
  if (!secureEnsureDir(claimsDir, canonicalHome, seams))
    throw new Error("claims_dir_setup_failed")

  const state: OutboxState = {
    endpoint,
    apiKey,
    outboxDir,
    deadLetterDir,
    claimsDir,
    canonicalHome,
    maxRetryBackoffMs: resolvedOptions.maxRetryBackoffMs,
    baseBackoffMs: resolvedOptions.baseBackoffMs,
    jitterFactor: resolvedOptions.jitterFactor,
    claimStaleMs: resolvedOptions.claimStaleMs,
    contentionJitterMs: resolvedOptions.contentionJitterMs,
    publicationGraceMs: resolvedOptions.publicationGraceMs,
    maxCount: resolvedOptions.maxCount,
    log: logFn,
    disposed: false,
    activeController: null,
    fallbackRetryAt: null,
    flushLock: null,
    flushRequested: false,
    retryTimer: null,
    options: resolvedOptions,
  }

  cleanupStaleClaims(state, seams)

  function makeStorageCtx(): StorageContext {
    return {
      outboxDir: state.outboxDir,
      deadLetterDir: state.deadLetterDir,
      claimsDir: state.claimsDir,
      canonicalHome: state.canonicalHome,
      maxCount: state.options.maxCount,
      maxTotalBytes: state.options.maxTotalBytes,
      claimStaleMs: state.options.claimStaleMs,
      publicationGraceMs: state.options.publicationGraceMs,
      log: state.log,
    }
  }

  function makeClaimCtx(): ClaimContext {
    return {
      claimsDir: state.claimsDir,
      canonicalHome: state.canonicalHome,
      claimStaleMs: state.options.claimStaleMs,
      publicationGraceMs: state.options.publicationGraceMs,
    }
  }

  function scheduleRetryFlush(flushFn: () => Promise<void>): void {
    if (state.disposed) return
    clearRetryTimer(state)
    const delay = computeNextRetryDelay(state, seams)
    if (delay === null) return
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null
      state.fallbackRetryAt = null
      flushFn().catch(() => {})
    }, delay)
    try {
      if (state.retryTimer && "unref" in state.retryTimer) {
        ;(state.retryTimer as unknown as { unref(): void }).unref()
      }
    } catch {}
  }

  async function doFlush(): Promise<void> {
    if (state.disposed) return
    const { outboxDir: dir } = state
    let entries: string[]
    try {
      entries = readdirBounded(dir, DIR_SCAN_LIMIT, seams)
        .filter((f: string) => f.endsWith(".json"))
    } catch {
      return
    }
    const now = seams.time.now()
    const storageCtx = makeStorageCtx()
    const claimCtx = makeClaimCtx()
    expireAgedOutbox(storageCtx, seams)

    const processLimit = state.options.maxCount + FLUSH_FILE_OVERSCAN
    let processed = 0

    for (const file of entries) {
      if (processed >= processLimit) break
      processed++

      const fp = `${dir}/${file}`
      const sourceEventId = file.replace(/\.json$/, "")

      await processRecord(
        fp,
        sourceEventId,
        state,
        storageCtx,
        claimCtx,
        seams,
        now,
        () => scheduleRetryFlush(() => flushLocked(() => doFlush())),
      )
    }
    if (state.disposed) return
    scheduleRetryFlush(() =>
      flushLocked(() => doFlush()),
    )
  }

  async function flushLocked(
    flushFn: () => Promise<void>,
  ): Promise<void> {
    while (state.flushLock) {
      state.flushRequested = true
      await state.flushLock
    }
    state.flushLock = (async () => {
      do {
        state.flushRequested = false
        await flushFn()
      } while (state.flushRequested)
    })().finally(() => {
      state.flushLock = null
    })
    await state.flushLock
  }

  function enqueue(
    sourceEventId: string,
    payload: UsageLogPayload,
  ): boolean {
    if (state.disposed) return false
    if (!SOURCE_EVENT_ID_RE.test(sourceEventId)) return false
    if (
      !SOURCE_EVENT_ID_RE.test(payload.sourceEventId) ||
      payload.sourceEventId !== sourceEventId
    ) {
      return false
    }
    if (!validatePayload(payload)) return false

    const claimCtx = makeClaimCtx()

    const claimHandle = acquireClaim(claimCtx, sourceEventId, seams)
    if (!claimHandle) return false

    let enqueued = false
    try {
      const record = {
        sourceEventId,
        payload,
        createdAt: seams.time.now(),
        retries: 0,
      }
      const recordJson = JSON.stringify(record)
      const recordBytes = Buffer.byteLength(recordJson, "utf8")
      const storageCtx = makeStorageCtx()
      if (!enforceQuota(storageCtx, seams, recordBytes)) return false
      if (
        !secureAtomicWrite(
          outboxFilePath(state.outboxDir, sourceEventId),
          recordJson,
          state.canonicalHome,
          seams,
        )
      ) {
        state.log({
          ts: new Date().toISOString(),
          sourceEventId,
          category: "outbox_enqueue_atomic_write_failed",
        })
        return false
      }
      enqueued = true
      return true
    } finally {
      releaseClaim(claimCtx, claimHandle, seams)
      if (enqueued && state.options.autoflush) {
        state.flushRequested = true
        flushLocked(() => doFlush()).catch(() => {})
      }
    }
  }

  async function flush(): Promise<void> {
    await flushLocked(() => doFlush())
  }

  async function dispose(): Promise<void> {
    state.disposed = true
    state.fallbackRetryAt = null
    if (state.activeController) {
      state.activeController.abort()
    }
    clearRetryTimer(state)
    const timeoutMs = 2000
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeout = new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => resolve(), timeoutMs)
      if (timeoutId && "unref" in timeoutId) {
        ;(timeoutId as unknown as { unref(): void }).unref()
      }
    })
    await Promise.race([state.flushLock?.catch(() => {}), timeout])
    if (timeoutId) clearTimeout(timeoutId)
  }

  if (resolvedOptions.autoflush) {
    flushLocked(() => doFlush()).catch(() => {})
  }

  return { enqueue, flush, dispose }
}
