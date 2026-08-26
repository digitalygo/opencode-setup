import { findOutputLoop, type OutputLoopReceipt } from "./detector.js"

const MAX_PENDING_RECEIPTS = 256
const RECEIPT_TTL_MS = 300_000

type UnknownRecord = Record<string, unknown>

interface PendingReceipt {
  receipt: OutputLoopReceipt
  createdAt: number
}

export interface OutputLoopGuard {
  inspect: (messages: unknown) => OutputLoopReceipt | null
  observeUserMessage: (sessionID: string, parts: unknown) => void
  consume: (sessionID: string) => OutputLoopReceipt | null
}

export function createOutputLoopGuard(now: () => number = Date.now): OutputLoopGuard {
  const pending = new Map<string, PendingReceipt>()

  function inspect(messages: unknown): OutputLoopReceipt | null {
    const currentTime = now()
    pruneExpired(pending, currentTime)
    const receipt = findOutputLoop(messages)
    if (!receipt) return null

    if (pending.has(receipt.sessionID) || pending.size < MAX_PENDING_RECEIPTS) {
      pending.delete(receipt.sessionID)
      pending.set(receipt.sessionID, { receipt, createdAt: currentTime })
    }
    return receipt
  }

  function observeUserMessage(sessionID: string, parts: unknown): void {
    pruneExpired(pending, now())
    if (isGenuineUserParts(parts)) pending.delete(sessionID)
  }

  function consume(sessionID: string): OutputLoopReceipt | null {
    pruneExpired(pending, now())
    return pending.get(sessionID)?.receipt ?? null
  }

  return { inspect, observeUserMessage, consume }
}

function isGenuineUserParts(parts: unknown): boolean {
  if (!Array.isArray(parts)) return false
  return parts.some((part) => {
    const record = asRecord(part)
    if (!record || typeof record.type !== "string") return false
    if (record.type === "compaction") return false
    return record.synthetic !== true && record.ignored !== true
  })
}

function pruneExpired(pending: Map<string, PendingReceipt>, now: number): void {
  for (const [sessionID, stored] of pending) {
    if (now - stored.createdAt >= RECEIPT_TTL_MS) pending.delete(sessionID)
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}
