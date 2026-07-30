import { validateNonemptyBounded, MAX_ID_LEN, MAX_MODE_LEN } from "./event-validation.js"
import { buildPayload, computeStepSize, evictOldest } from "./usage-payload.js"
import { computeSourceEventId } from "./id.js"
import type { Outbox } from "./outbox.js"
import type { PendingStore } from "./pending.js"
import type { Seams } from "./seams.js"
import type { AssistantMessageInfo, PendingStep } from "./types.js"

const MAX_MESSAGE_METADATA = 200

const pendingQuota = {
  maxCount: 20000,
  maxTotalBytes: 128 * 1024 * 1024,
  maxAgeMs: 2 * 60 * 60 * 1000,
}

type SchedulerEntry = { sessionID: string; messageID: string; attempt: number; nextRetryAt: number }

export interface SchedulingDeps {
  seams: Seams
  outbox: Outbox
  pendingStore: PendingStore
  projectCode: string
  client: {
    session: {
      message: (opts: { path: { id: string; messageID: string } }) => Promise<{
        data: { info: { providerID: string; modelID: string; mode: string; id: string; role: string } } | null
      }>
    }
  }
  emitStructuredLog: (opts: {
    level: "debug" | "info" | "warn" | "error"
    message: string
    extra?: Record<string, unknown>
  }) => void
  retryBaseMs?: number
  retryMaxMs?: number
  metadataConcurrency?: number
}

export interface SchedulingHandle {
  enroll(sessionID: string, messageID: string): void
  cancel(messageID: string): void
  dispose(): void
  cacheMetadata(info: AssistantMessageInfo, messageId: string): void
  handleStepFinish(step: {
    sessionID: string
    messageID: string
    id: string
    cost: number
    tokens: PendingStep["tokens"]
  }): void
  drainPending(messageID: string): Promise<void>
  loadPersisted(): number
  pruneExpired(now: number): void
  isDisposed(): boolean
}

export function createScheduler(deps: SchedulingDeps): SchedulingHandle {
  const messageMetadata = new Map<string, AssistantMessageInfo>()
  const pendingSteps = new Map<string, PendingStep & { pendingTotalBytes: number }>()
  let pendingTotalBytes = 0

  const retryBaseMs = deps.retryBaseMs ?? 1000
  const retryMaxMs = deps.retryMaxMs ?? 30000
  const metadataConcurrency = deps.metadataConcurrency ?? 10

  const schedulerEntries = new Map<string, SchedulerEntry>()
  let schedulerActiveCount = 0
  let schedulerTimer: ReturnType<typeof setTimeout> | null = null
  let schedulerDisposed = false

  function schedulerClearTimer(): void {
    if (schedulerTimer !== null) {
      clearTimeout(schedulerTimer)
      schedulerTimer = null
    }
  }

  function schedulerComputeDelay(attempt: number): number {
    const raw = Math.min(retryMaxMs, retryBaseMs * Math.pow(2, attempt - 1))
    const jitter = raw * 0.2 * (Math.random() * 2 - 1)
    return Math.max(0, Math.round(raw + jitter))
  }

  function schedulerScheduleNext(): void {
    if (schedulerDisposed) return
    schedulerClearTimer()
    if (schedulerEntries.size === 0) return
    if (schedulerActiveCount >= metadataConcurrency) return
    const now = deps.seams.time.now()
    let nearest = Number.POSITIVE_INFINITY
    for (const entry of schedulerEntries.values()) {
      if (entry.nextRetryAt < nearest) nearest = entry.nextRetryAt
    }
    if (!Number.isFinite(nearest)) return
    const delay = Math.max(0, nearest - now)
    schedulerTimer = setTimeout(() => {
      schedulerTimer = null
      schedulerRunCycle().catch(() => {})
    }, delay)
    try {
      if (schedulerTimer && "unref" in schedulerTimer) {
        ;(schedulerTimer as unknown as { unref(): void }).unref()
      }
    } catch {}
  }

  function pruneExpiredPending(now: number): void {
    const expiredKeys: string[] = []
    for (const [sourceEventId, step] of pendingSteps) {
      if (now - step.enqueuedAt > pendingQuota.maxAgeMs) {
        expiredKeys.push(sourceEventId)
      }
    }
    for (const sourceEventId of expiredKeys) {
      const step = pendingSteps.get(sourceEventId)
      if (!step) continue
      deps.pendingStore.delete(step.sessionID, step.messageID, step.partID)
      pendingTotalBytes -= step.pendingTotalBytes
      pendingSteps.delete(sourceEventId)
      deps.emitStructuredLog({
        level: "warn",
        message: "pending record expired",
        extra: {
          sourceEventId,
          category: "pending_expired",
        },
      })
    }
  }

  function tryEnqueueFromPending(
    stored: PendingStep,
    meta: AssistantMessageInfo,
  ): boolean {
    const sourceEventId = computeSourceEventId(
      stored.sessionID,
      stored.messageID,
      stored.partID,
    )
    const payload = buildPayload(
      stored.sessionID,
      stored.messageID,
      stored.partID,
      meta,
      stored.createdAt,
      deps.projectCode,
      stored.tokens,
      stored.cost,
    )
    if (!deps.outbox.enqueue(payload.sourceEventId, payload)) {
      deps.emitStructuredLog({
        level: "warn",
        message: "outbox enqueue failed",
        extra: {
          sourceEventId: payload.sourceEventId,
          category: "outbox_enqueue_failed",
        },
      })
      return false
    }
    return true
  }

  function removePending(sourceEventId: string): void {
    const entry = pendingSteps.get(sourceEventId)
    if (!entry) return
    pendingTotalBytes -= entry.pendingTotalBytes
    pendingSteps.delete(sourceEventId)
    deps.pendingStore.delete(entry.sessionID, entry.messageID, entry.partID)
  }

  async function drainPending(messageID: string): Promise<void> {
    const meta = messageMetadata.get(messageID)
    if (!meta) return
    let anyRemaining = false
    let remainingSessionID: string | null = null
    for (const [sourceEventId, pending] of pendingSteps) {
      if (pending.messageID === messageID) {
        if (tryEnqueueFromPending(pending, meta)) {
          removePending(sourceEventId)
        } else {
          anyRemaining = true
          remainingSessionID ??= pending.sessionID
        }
      }
    }
    if (
      anyRemaining &&
      remainingSessionID !== null &&
      !schedulerDisposed &&
      !schedulerEntries.has(messageID)
    ) {
      schedulerEnroll(remainingSessionID, messageID)
    }
  }

  async function schedulerRunCycle(): Promise<void> {
    if (schedulerDisposed) return
    const now = deps.seams.time.now()
    schedulerClearTimer()

    pruneExpiredPending(now)

    const expiredEntries: string[] = []
    for (const [msgId] of schedulerEntries) {
      let hasPending = false
      for (const step of pendingSteps.values()) {
        if (step.messageID === msgId) { hasPending = true; break }
      }
      if (!hasPending) expiredEntries.push(msgId)
    }
    for (const msgId of expiredEntries) {
      schedulerEntries.delete(msgId)
    }

    const ready: Array<{ sessionID: string; messageID: string; entry: SchedulerEntry }> = []
    for (const [msgId, entry] of schedulerEntries) {
      if (entry.nextRetryAt <= now) {
        ready.push({ sessionID: entry.sessionID, messageID: msgId, entry })
      }
    }

    if (ready.length === 0) {
      schedulerScheduleNext()
      return
    }

    const available = Math.min(metadataConcurrency - schedulerActiveCount, ready.length)
    const batch = ready.slice(0, available)

    for (const item of batch) {
      schedulerActiveCount++
      schedulerEntries.delete(item.messageID)
      doSchedulerLookup(item.sessionID, item.messageID, item.entry.attempt)
        .finally(() => {
          schedulerActiveCount--
          schedulerScheduleNext()
        })
    }
  }

  async function doSchedulerLookup(
    sessionID: string,
    messageID: string,
    previousAttempt: number,
  ): Promise<void> {
    if (schedulerDisposed) return
    const hasPending = () => {
      for (const step of pendingSteps.values()) {
        if (step.messageID === messageID) return true
      }
      return false
    }
    if (!hasPending()) return
    if (messageMetadata.has(messageID)) {
      const meta = messageMetadata.get(messageID)!
      let anyRemaining = false
      const toRemove: string[] = []
      for (const [sourceEventId, pending] of pendingSteps) {
        if (pending.messageID === messageID) {
          if (tryEnqueueFromPending(pending, meta)) {
            toRemove.push(sourceEventId)
          } else {
            anyRemaining = true
          }
        }
      }
      for (const id of toRemove) {
        removePending(id)
      }
      if (anyRemaining && !schedulerDisposed) {
        const nextAttempt = previousAttempt + 1
        const nextDelay = schedulerComputeDelay(nextAttempt)
        const nextRetryAt = deps.seams.time.now() + nextDelay
        if (nextRetryAt - deps.seams.time.now() > pendingQuota.maxAgeMs) {
          for (const [sourceEventId, step] of pendingSteps) {
            if (step.messageID === messageID) {
              deps.emitStructuredLog({
                level: "warn",
                message: "pending metadata retry exhausted",
                extra: {
                  sourceEventId,
                  category: "pending_metadata_exhausted",
                },
              })
              deps.pendingStore.delete(step.sessionID, step.messageID, step.partID)
              pendingTotalBytes -= step.pendingTotalBytes
              pendingSteps.delete(sourceEventId)
            }
          }
          return
        }
        schedulerEntries.set(messageID, { sessionID, messageID, attempt: nextAttempt, nextRetryAt })
        schedulerScheduleNext()
      }
      return
    }

    let meta: AssistantMessageInfo | null = null
    try {
      const result = await deps.client.session.message({
        path: { id: sessionID, messageID },
      })
      if (result.data) {
        const info = result.data.info
        if (
          info &&
          info.role === "assistant" &&
          info.id === messageID &&
          validateNonemptyBounded(info.providerID, MAX_ID_LEN) &&
          validateNonemptyBounded(info.modelID, MAX_ID_LEN) &&
          validateNonemptyBounded(info.mode, MAX_MODE_LEN)
        ) {
          meta = {
            providerID: info.providerID,
            modelID: info.modelID,
            mode: info.mode,
          }
        }
      }
    } catch {}

    if (schedulerDisposed) return

    if (meta) {
      messageMetadata.set(messageID, meta)
      evictOldest(messageMetadata, MAX_MESSAGE_METADATA)
      let anyRemaining = false
      const toRemove: string[] = []
      for (const [sourceEventId, pending] of pendingSteps) {
        if (pending.messageID === messageID) {
          if (tryEnqueueFromPending(pending, meta!)) {
            toRemove.push(sourceEventId)
          } else {
            anyRemaining = true
          }
        }
      }
      for (const id of toRemove) {
        removePending(id)
      }
      if (anyRemaining && !schedulerDisposed) {
        const entry = schedulerEntries.get(messageID)
        const currentAttempt = entry ? entry.attempt : previousAttempt
        schedulerEntries.set(messageID, {
          sessionID,
          messageID,
          attempt: currentAttempt,
          nextRetryAt: deps.seams.time.now() + schedulerComputeDelay(currentAttempt + 1),
        })
        schedulerScheduleNext()
      }
      return
    }

    if (!hasPending()) return

    const nextAttempt = previousAttempt + 1
    const nextDelay = schedulerComputeDelay(nextAttempt)
    const nextRetryAt = deps.seams.time.now() + nextDelay
    if (nextRetryAt - deps.seams.time.now() > pendingQuota.maxAgeMs) {
      for (const [sourceEventId, step] of pendingSteps) {
        if (step.messageID === messageID) {
          deps.emitStructuredLog({
            level: "warn",
            message: "pending metadata retry exhausted",
            extra: {
              sourceEventId,
              category: "pending_metadata_exhausted",
            },
          })
          deps.pendingStore.delete(step.sessionID, step.messageID, step.partID)
          pendingTotalBytes -= step.pendingTotalBytes
          pendingSteps.delete(sourceEventId)
        }
      }
      return
    }

    schedulerEntries.set(messageID, {
      sessionID,
      messageID,
      attempt: nextAttempt,
      nextRetryAt,
    })
    schedulerScheduleNext()
  }

  function schedulerEnroll(sessionID: string, messageID: string): void {
    if (schedulerDisposed) return
    if (schedulerEntries.has(messageID)) return
    schedulerEntries.set(messageID, {
      sessionID,
      messageID,
      attempt: 0,
      nextRetryAt: deps.seams.time.now(),
    })
    schedulerScheduleNext()
  }

  function schedulerCancel(messageID: string): void {
    schedulerEntries.delete(messageID)
  }

  function schedulerDisposeFn(): void {
    schedulerDisposed = true
    schedulerClearTimer()
    schedulerEntries.clear()
  }

  function cacheMetadata(info: AssistantMessageInfo, messageId: string): void {
    messageMetadata.set(messageId, {
      providerID: info.providerID,
      modelID: info.modelID,
      mode: info.mode,
    })
    evictOldest(messageMetadata, MAX_MESSAGE_METADATA)
  }

  function handleStepFinish(step: {
    sessionID: string
    messageID: string
    id: string
    cost: number
    tokens: PendingStep["tokens"]
  }): void {
    const createdAt = deps.seams.time.now()
    const now = deps.seams.time.now()
    const sourceEventId = computeSourceEventId(step.sessionID, step.messageID, step.id)

    pruneExpiredPending(now)

    const existing = pendingSteps.get(sourceEventId)
    if (existing) {
      pendingTotalBytes -= existing.pendingTotalBytes
      pendingSteps.delete(sourceEventId)
    }

    const pending: PendingStep = {
      sessionID: step.sessionID,
      messageID: step.messageID,
      partID: step.id,
      cost: step.cost,
      tokens: step.tokens,
      createdAt,
      enqueuedAt: now,
    }
    const stepSize = computeStepSize(pending)

    if (
      stepSize > pendingQuota.maxTotalBytes ||
      pendingSteps.size >= pendingQuota.maxCount ||
      pendingTotalBytes + stepSize > pendingQuota.maxTotalBytes
    ) {
      if (existing) {
        pendingSteps.set(sourceEventId, {
          ...pending,
          pendingTotalBytes: existing.pendingTotalBytes,
        })
        pendingTotalBytes += existing.pendingTotalBytes
      }
      return
    }

    const persisted = deps.pendingStore.persist(pending)
    if (!persisted) {
      deps.emitStructuredLog({
        level: "warn",
        message: "pending persist failed",
        extra: {
          sourceEventId,
          category: "pending_persist_failed",
        },
      })
      return
    }

    const storedStep: PendingStep & { pendingTotalBytes: number } = {
      ...pending,
      pendingTotalBytes: stepSize,
    }
    pendingSteps.set(sourceEventId, storedStep)
    pendingTotalBytes += stepSize

    const meta = messageMetadata.get(step.messageID)
    if (meta) {
      if (tryEnqueueFromPending(pending, meta)) {
        removePending(sourceEventId)
        return
      }
    }

    schedulerEnroll(step.sessionID, step.messageID)
  }

  function loadPersisted(): number {
    const persisted = deps.pendingStore.load()
    for (const step of persisted) {
      const stepSize = computeStepSize(step)
      const sourceEventId = computeSourceEventId(
        step.sessionID,
        step.messageID,
        step.partID,
      )
      if (
        stepSize > pendingQuota.maxTotalBytes ||
        pendingSteps.size >= pendingQuota.maxCount ||
        pendingTotalBytes + stepSize > pendingQuota.maxTotalBytes
      ) {
        continue
      }
      pendingSteps.set(sourceEventId, {
        ...step,
        pendingTotalBytes: stepSize,
      })
      pendingTotalBytes += stepSize
      schedulerEnroll(step.sessionID, step.messageID)
    }
    return persisted.length
  }

  function isDisposed(): boolean {
    return schedulerDisposed
  }

  return {
    enroll: schedulerEnroll,
    cancel: schedulerCancel,
    dispose: schedulerDisposeFn,
    cacheMetadata,
    handleStepFinish,
    drainPending,
    loadPersisted,
    pruneExpired: pruneExpiredPending,
    isDisposed,
  }
}
