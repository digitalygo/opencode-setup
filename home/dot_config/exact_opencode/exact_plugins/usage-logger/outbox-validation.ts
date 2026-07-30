import { relative } from "node:path"
import type { UsageLogPayload, OutboxRecord } from "./types.js"

export const DEFAULT_PUBLICATION_GRACE_MS = 5000

export const FETCH_TIMEOUT_MS = 15000
export const OUTBOX_MAX_RETRIES = 10
export const MAX_DEAD_LETTER_COUNT = 100
export const MAX_DEAD_LETTER_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const OUTBOX_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export const DEFAULT_MAX_COUNT = 10000
export const DEFAULT_MAX_TOTAL_BYTES = 64 * 1024 * 1024

const MAX_ID_LEN = 256
const MAX_MODE_LEN = 64
const MAX_PROJECT_CODE_LEN = 512

export const SOURCE_EVENT_ID_RE = /^[0-9a-f]{64}$/

export const DEFAULT_CLAIM_STALE_MS = 30000
export const DEFAULT_CONTENTION_JITTER_MS = 1000
export const FLUSH_FILE_OVERSCAN = 100
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024
const FUTURE_SKEW_MS = 60_000
const MAX_FUTURE_ATTEMPT_MS = 30 * 24 * 60 * 60 * 1000
export const DIR_SCAN_LIMIT = 20000

export const SAFE_FILENAME_RE = /^[0-9a-f]{64}\.json$/

export function isContained(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  if (rel === "") return true
  if (rel.startsWith("..")) return false
  return true
}

function validateNonemptyBoundedStr(v: unknown, maxLen: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= maxLen
}

export function validatePayload(payload: UsageLogPayload): boolean {
  if (!payload || typeof payload !== "object") return false
  const p = payload as unknown as Record<string, unknown>
  if (p.schemaVersion !== 2) return false
  if (typeof p.sourceEventId !== "string" || !SOURCE_EVENT_ID_RE.test(p.sourceEventId)) return false
  if (p.event !== "llm.step.completed") return false
  if (!validateNonemptyBoundedStr(p.providerId, MAX_ID_LEN)) return false
  if (!validateNonemptyBoundedStr(p.modelId, MAX_ID_LEN)) return false
  if (!validateNonemptyBoundedStr(p.mode, MAX_MODE_LEN)) return false
  if (typeof p.usage !== "number" || !Number.isFinite(p.usage) || p.usage < 0) return false
  if (typeof p.input !== "number" || !Number.isFinite(p.input) || p.input < 0) return false
  if (typeof p.output !== "number" || !Number.isFinite(p.output) || p.output < 0) return false
  if (typeof p.reasoning !== "number" || !Number.isFinite(p.reasoning) || p.reasoning < 0) return false
  if (typeof p.cacheRead !== "number" || !Number.isFinite(p.cacheRead) || p.cacheRead < 0) return false
  if (typeof p.cacheWrite !== "number" || !Number.isFinite(p.cacheWrite) || p.cacheWrite < 0) return false
  if (typeof p.createdAt !== "number" || !Number.isFinite(p.createdAt) || p.createdAt <= 0) return false
  if (!validateNonemptyBoundedStr(p.projectCode, MAX_PROJECT_CODE_LEN)) return false
  return true
}

export function validateOutboxRecord(record: OutboxRecord, fp: string, now: number): boolean {
  if (!record || typeof record !== "object") return false
  const r = record as unknown as Record<string, unknown>
  if (typeof r.sourceEventId !== "string" || !SOURCE_EVENT_ID_RE.test(r.sourceEventId)) return false
  if (!r.payload || typeof r.payload !== "object") return false
  const p = r.payload as Record<string, unknown>
  if (p.schemaVersion !== 2) return false
  if (typeof p.sourceEventId !== "string" || !SOURCE_EVENT_ID_RE.test(p.sourceEventId)) return false
  if (p.sourceEventId !== r.sourceEventId) return false
  if (p.event !== "llm.step.completed") return false
  if (!validateNonemptyBoundedStr(p.providerId, MAX_ID_LEN)) return false
  if (!validateNonemptyBoundedStr(p.modelId, MAX_ID_LEN)) return false
  if (!validateNonemptyBoundedStr(p.mode, MAX_MODE_LEN)) return false
  if (typeof p.usage !== "number" || !Number.isFinite(p.usage) || p.usage < 0) return false
  if (typeof p.input !== "number" || !Number.isFinite(p.input) || p.input < 0) return false
  if (typeof p.output !== "number" || !Number.isFinite(p.output) || p.output < 0) return false
  if (typeof p.reasoning !== "number" || !Number.isFinite(p.reasoning) || p.reasoning < 0) return false
  if (typeof p.cacheRead !== "number" || !Number.isFinite(p.cacheRead) || p.cacheRead < 0) return false
  if (typeof p.cacheWrite !== "number" || !Number.isFinite(p.cacheWrite) || p.cacheWrite < 0) return false
  if (typeof p.createdAt !== "number" || !Number.isFinite(p.createdAt) || p.createdAt <= 0) return false
  if (!validateNonemptyBoundedStr(p.projectCode, MAX_PROJECT_CODE_LEN)) return false
  if (typeof r.createdAt !== "number" || !Number.isFinite(r.createdAt) || r.createdAt <= 0) return false
  if (typeof r.retries !== "number" || !Number.isFinite(r.retries) || r.retries < 0 || !Number.isInteger(r.retries)) return false
  if (r.lastAttempt !== undefined && (typeof r.lastAttempt !== "number" || !Number.isFinite(r.lastAttempt))) return false
  if (r.nextAttemptAt !== undefined && (typeof r.nextAttemptAt !== "number" || !Number.isFinite(r.nextAttemptAt))) return false
  if (r.createdAt > now + FUTURE_SKEW_MS) return false
  if (p.createdAt > now + FUTURE_SKEW_MS) return false
  if (r.lastAttempt !== undefined) {
    if (r.lastAttempt < 0) return false
    if (r.lastAttempt > now + MAX_FUTURE_ATTEMPT_MS) return false
  }
  if (r.nextAttemptAt !== undefined) {
    if (r.nextAttemptAt < 0) return false
    if (r.nextAttemptAt > now + MAX_FUTURE_ATTEMPT_MS) return false
  }
  const basename = fp.split("/").pop() ?? ""
  const expectedFilename = `${r.sourceEventId}.json`
  if (basename !== expectedFilename) return false
  return true
}

export function computeBackoffDelay(
  retries: number,
  maxRetryBackoffMs: number,
  baseBackoffMs: number,
  jitterFactor: number,
): number {
  const baseDelay = Math.min(
    maxRetryBackoffMs,
    baseBackoffMs * Math.pow(2, retries - 1),
  )
  const jitter =
    baseDelay * jitterFactor * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(baseDelay + jitter))
}

export function capNextAttemptAt(
  nextAttemptAt: number,
  now: number,
  maxRetryBackoffMs: number,
): number {
  const horizon = now + maxRetryBackoffMs
  return Math.min(nextAttemptAt, horizon)
}
