import { createOutbox, type Outbox } from "./outbox.js"
import { createPendingStore, type PendingStore } from "./pending.js"
import { createScheduler, type SchedulingHandle, type SchedulingDeps } from "./metadata-scheduler.js"
import {
  validateNonemptyBounded,
  validateMessageUpdatedProps,
  validateStepFinishPart,
  MAX_ID_LEN,
} from "./event-validation.js"
import type { Seams } from "./seams.js"
import type {
  ResolvedConfig,
  PendingStep,
  AssistantMessageInfo,
  LogEntry,
} from "./types.js"

interface HooksResult {
  event: (input: { event: { type: string; properties: Record<string, unknown> } }) => Promise<void>
  dispose?: () => Promise<void>
}

export interface HooksTestOptions {
  metadataRetryBaseMs?: number
  metadataRetryMaxMs?: number
  metadataConcurrency?: number
}

export function createHooks(
  config: ResolvedConfig,
  projectCode: string,
  outboxBaseDir: string,
  canonicalHome: string,
  client: {
    session: {
      message: (opts: {
        path: { id: string; messageID: string }
      }) => Promise<{ data: { info: { providerID: string; modelID: string; mode: string; id: string; role: string } } | null }>
    }
    app: {
      log: (opts: {
        body: {
          service: string
          level: "debug" | "info" | "warn" | "error"
          message: string
          extra?: Record<string, unknown>
        }
      }) => Promise<unknown>
    }
  },
  seams: Seams,
  testOptions: HooksTestOptions = {},
): HooksResult {
  if (!config.base || !config.key) return { event: async () => {} }
  if (!projectCode) return { event: async () => {} }

  const endpoint = `${config.base}/api/v2/usage-logs`

  function emitStructuredLog(opts: {
    level: "debug" | "info" | "warn" | "error"
    message: string
    extra?: Record<string, unknown>
  }): void {
    client.app
      .log({
        body: {
          service: "usage-logger",
          level: opts.level,
          message: opts.message,
          extra: opts.extra,
        },
      })
      .catch(() => {})
  }

  function outboxLogFn(entry: LogEntry): void {
    const category = entry.category ?? "outbox_event"
    emitStructuredLog({
      level: entry.category === "delivered" ? "info" : "warn",
      message: `outbox ${category}`,
      extra: {
        sourceEventId: entry.sourceEventId,
        status: entry.status,
        category,
      },
    })
  }

  let outbox: Outbox
  try {
    outbox = createOutbox(
      outboxBaseDir,
      config.key,
      endpoint,
      canonicalHome,
      seams,
      outboxLogFn,
    )
  } catch {
    emitStructuredLog({
      level: "error",
      message: "outbox setup failed",
      extra: { category: "outbox_setup_failed" },
    })
    return { event: async () => {} }
  }

  let pendingStore: PendingStore
  try {
    pendingStore = createPendingStore(outboxBaseDir, canonicalHome, seams, {
      onDeleteFail: (path) => {
        emitStructuredLog({
          level: "error",
          message: "pending delete failed",
          extra: {
            path,
            category: "pending_delete_failed",
          },
        })
      },
    })
  } catch {
    emitStructuredLog({
      level: "error",
      message: "pending setup failed",
      extra: { category: "pending_setup_failed" },
    })
    outbox.dispose().catch(() => {})
    return {
      event: async () => {},
      dispose: async () => { await outbox.dispose().catch(() => {}) },
    }
  }

  const schedulerDeps: SchedulingDeps = {
    seams,
    outbox,
    pendingStore,
    projectCode,
    client,
    emitStructuredLog,
    retryBaseMs: testOptions.metadataRetryBaseMs,
    retryMaxMs: testOptions.metadataRetryMaxMs,
    metadataConcurrency: testOptions.metadataConcurrency,
  }
  const scheduler = createScheduler(schedulerDeps)

  const persistedCount = scheduler.loadPersisted()

  emitStructuredLog({
    level: "info",
    message: "usage-logger initialized",
    extra: { projectCode, pendingCount: persistedCount },
  })

  let hooksDisposed = false
  let eventInFlight = 0

  return {
    event: async (input) => {
      if (hooksDisposed) return
      eventInFlight++
      try {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
          emitStructuredLog({
            level: "warn",
            message: "event invalid",
            extra: { category: "event_invalid" },
          })
          return
        }
        const rawEvent = (input as Record<string, unknown>).event
        if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) {
          emitStructuredLog({
            level: "warn",
            message: "event invalid",
            extra: { category: "event_invalid" },
          })
          return
        }
        const event = rawEvent as { type: string; properties: Record<string, unknown> }
        if (!validateNonemptyBounded(event.type, MAX_ID_LEN)) {
          emitStructuredLog({
            level: "warn",
            message: "event invalid",
            extra: { category: "event_invalid" },
          })
          return
        }
        const properties = event.properties
        if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
          emitStructuredLog({
            level: "warn",
            message: "event invalid",
            extra: { category: "event_invalid", eventType: event.type },
          })
          return
        }
        const now = seams.time.now()
        scheduler.pruneExpired(now)
        switch (event.type) {
          case "message.updated": {
            if (!validateMessageUpdatedProps(properties)) {
              const rawInfo = (properties as Record<string, unknown>).info
              if (rawInfo === undefined || rawInfo === null || typeof rawInfo !== "object" || Array.isArray(rawInfo)) {
                emitStructuredLog({
                  level: "warn",
                  message: "event invalid",
                  extra: { category: "event_invalid", eventType: event.type },
                })
                return
              }
              const ri = rawInfo as Record<string, unknown>
              if (typeof ri.role === "string" && ri.role.length > 0 && ri.role !== "assistant") return
              emitStructuredLog({
                level: "warn",
                message: "event invalid",
                extra: { category: "event_invalid", eventType: event.type },
              })
              return
            }
            const info = (properties as Record<string, unknown>).info as { providerID: string; modelID: string; mode: string; id: string }
            scheduler.cacheMetadata(
              { providerID: info.providerID, modelID: info.modelID, mode: info.mode },
              info.id,
            )
            scheduler.cancel(info.id)
            await scheduler.drainPending(info.id)
            break
          }
          case "message.part.updated": {
            const rawPart = (properties as Record<string, unknown>).part
            if (!rawPart || typeof rawPart !== "object" || Array.isArray(rawPart)) {
              emitStructuredLog({
                level: "warn",
                message: "event invalid",
                extra: {
                  category: "event_invalid",
                  eventType: event.type,
                },
              })
              return
            }
            const partCheck = rawPart as Record<string, unknown>
            if (typeof partCheck.type !== "string") {
              emitStructuredLog({
                level: "warn",
                message: "event invalid",
                extra: {
                  category: "event_invalid",
                  eventType: event.type,
                },
              })
              return
            }
            if (partCheck.type !== "step-finish") return
            if (!validateStepFinishPart(rawPart)) {
              emitStructuredLog({
                level: "warn",
                message: "event invalid",
                extra: {
                  category: "event_invalid",
                  eventType: event.type,
                },
              })
              return
            }
            const part = rawPart as { id: string; sessionID: string; messageID: string; type: "step-finish"; cost: number; tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } } }
            scheduler.handleStepFinish(part)
            break
          }
        }
      } catch (caught) {
        emitStructuredLog({
          level: "error",
          message: "event handler failed",
          extra: {
            category: "event_handler_failed",
            error: caught instanceof Error ? caught.message : String(caught),
          },
        })
      } finally {
        eventInFlight--
      }
    },
    dispose: async () => {
      hooksDisposed = true
      scheduler.dispose()
      while (eventInFlight > 0) {
        await new Promise((r) => setTimeout(r, 10))
      }
      await outbox.dispose()
    },
  }
}
