import { computeSourceEventId } from "./id.js"
import type { AssistantMessageInfo, UsageLogPayload, PendingStep } from "./types.js"

export function buildPayload(
  sessionID: string,
  messageID: string,
  partID: string,
  meta: AssistantMessageInfo,
  createdAt: number,
  projectCode: string,
  tokens: PendingStep["tokens"],
  cost: number,
): UsageLogPayload {
  return {
    schemaVersion: 2,
    sourceEventId: computeSourceEventId(sessionID, messageID, partID),
    event: "llm.step.completed",
    createdAt,
    providerId: meta.providerID,
    modelId: meta.modelID,
    mode: meta.mode,
    usage: cost,
    input: tokens.input,
    output: tokens.output,
    reasoning: tokens.reasoning,
    cacheRead: tokens.cache.read,
    cacheWrite: tokens.cache.write,
    projectCode,
  }
}

export function evictOldest(map: Map<string, unknown>, maxSize: number): void {
  while (map.size > maxSize) {
    const first = map.keys().next().value
    if (first !== undefined) map.delete(first)
  }
}

export function computeStepSize(step: PendingStep): number {
  const data = JSON.stringify({
    sessionID: step.sessionID,
    messageID: step.messageID,
    partID: step.partID,
    cost: step.cost,
    tokens: step.tokens,
    createdAt: step.createdAt,
    enqueuedAt: step.enqueuedAt,
  })
  return Buffer.byteLength(data, "utf8")
}
