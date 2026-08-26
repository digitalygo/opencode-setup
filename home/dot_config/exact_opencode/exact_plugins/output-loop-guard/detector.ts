import { createHash, type Hash } from "node:crypto"

const REPEAT_THRESHOLD = 3
const MAX_VISIBLE_TEXT_CHARACTERS = 262_144
const MAX_CANONICAL_CHARACTERS = 2_097_152
const MAX_SERIALIZED_NODES = 10_000
const MAX_SERIALIZED_DEPTH = 20
const MAX_PARTS_PER_RESULT = 1_024
const MAX_HISTORY_SCAN = 10_000
const IGNORED_PART_TYPES = new Set(["reasoning", "retry", "compaction"])
const PROGRESS_PART_TYPES = new Set(["tool", "file", "patch", "snapshot", "subtask", "agent"])

type UnknownRecord = Record<string, unknown>
type PartProjection = UnknownRecord | null | undefined

export interface OutputLoopReceipt {
  sessionID: string
  userMessageID: string
  providerID: string
  modelID: string
  mode: string
  repeatCount: number
  digest: string
}

interface AssistantResult {
  sessionID: string
  parentID: string
  providerID: string
  modelID: string
  mode: string
  digest: string
}

interface SerializationBudget {
  nodes: number
  characters: number
}

interface VisibleTextAccumulator {
  segments: string[]
  characters: number
}

export function findOutputLoop(messages: unknown): OutputLoopReceipt | null {
  try {
    return inspectOutputLoop(messages)
  } catch {
    return null
  }
}

function inspectOutputLoop(messages: unknown): OutputLoopReceipt | null {
  if (!Array.isArray(messages)) return null
  const userIndex = findLatestUserIndex(messages)
  if (userIndex < 0) return null

  const user = messageInfo(messages[userIndex])
  if (!user) return null
  const userMessageID = stringField(user, "id")
  const sessionID = stringField(user, "sessionID")
  if (!userMessageID || !sessionID) return null

  const tail = messages.slice(userIndex + 1)
  if (tail.length < REPEAT_THRESHOLD) return null
  const candidates = tail.slice(-REPEAT_THRESHOLD).map((message) => assistantResult(message, userMessageID))
  if (candidates.some((candidate) => candidate === null)) return null

  const results = candidates as AssistantResult[]
  const first = results[0]
  if (!first || first.sessionID !== sessionID) return null
  if (!results.every((result) => result.digest === first.digest && sameContext(result, first))) return null

  return {
    sessionID,
    userMessageID,
    providerID: first.providerID,
    modelID: first.modelID,
    mode: first.mode,
    repeatCount: REPEAT_THRESHOLD,
    digest: first.digest,
  }
}

function assistantResult(message: unknown, userMessageID: string): AssistantResult | null {
  const record = asRecord(message)
  const info = record ? asRecord(record.info) : null
  const parts = record?.parts
  if (!info || info.role !== "assistant" || !Array.isArray(parts) || parts.length > MAX_PARTS_PER_RESULT) return null
  if (info.summary === true || info.error !== undefined) return null

  const time = asRecord(info.time)
  if (!time || !Number.isFinite(time.completed)) return null

  const sessionID = stringField(info, "sessionID")
  const parentID = stringField(info, "parentID")
  const providerID = stringField(info, "providerID")
  const modelID = stringField(info, "modelID")
  const mode = stringField(info, "mode")
  if (!sessionID || parentID !== userMessageID || !providerID || !modelID || !mode) return null

  const visible: VisibleTextAccumulator = { segments: [], characters: 0 }
  const progress: UnknownRecord[] = []
  for (const part of parts) {
    const projection = projectPart(part, visible)
    if (projection === undefined) return null
    if (projection) progress.push(projection)
  }

  const normalized = normalizeText(visible.segments.join("\n"))
  if (normalized.length > MAX_VISIBLE_TEXT_CHARACTERS) return null
  if (normalized.length === 0 && progress.length === 0) return null

  const digest = canonicalDigest({ providerID, modelID, mode, text: normalized, progress })
  if (!digest) return null
  return { sessionID, parentID, providerID, modelID, mode, digest }
}

function projectPart(part: unknown, visible: VisibleTextAccumulator): PartProjection {
  const record = asRecord(part)
  if (!record || typeof record.type !== "string" || record.type.length > 32) return undefined

  if (record.type === "text") {
    if (record.synthetic === true || record.ignored === true) return null
    if (typeof record.text !== "string") return undefined
    visible.characters += record.text.length + (visible.segments.length > 0 ? 1 : 0)
    if (visible.characters > MAX_VISIBLE_TEXT_CHARACTERS) return undefined
    visible.segments.push(record.text)
    return null
  }

  if (IGNORED_PART_TYPES.has(record.type)) return null
  if (record.type === "step-start" || record.type === "step-finish") return projectStepPart(record)
  if (!PROGRESS_PART_TYPES.has(record.type)) return undefined
  if (record.type === "tool") return projectToolPart(record)
  return projectGenericProgressPart(record)
}

function projectStepPart(part: UnknownRecord): PartProjection {
  if (part.snapshot !== undefined && typeof part.snapshot !== "string") return undefined
  return {
    type: part.type,
    snapshot: part.snapshot ?? null,
  }
}

function projectToolPart(part: UnknownRecord): PartProjection {
  const tool = stringField(part, "tool")
  const state = asRecord(part.state)
  if (!tool || !state || typeof state.status !== "string") return undefined
  const projectedState = copyWithoutKeys(state, new Set(["time", "metadata"]))
  if (state.attachments !== undefined) {
    if (!Array.isArray(state.attachments)) return undefined
    const attachments: UnknownRecord[] = []
    for (const attachment of state.attachments) {
      const attachmentRecord = asRecord(attachment)
      if (!attachmentRecord || attachmentRecord.type !== "file") return undefined
      attachments.push(projectGenericProgressPart(attachmentRecord))
    }
    projectedState.attachments = attachments
  }
  return {
    type: "tool",
    tool,
    state: projectedState,
  }
}

function projectGenericProgressPart(part: UnknownRecord): UnknownRecord {
  return copyWithoutKeys(part, new Set(["id", "sessionID", "messageID", "callID"]))
}

function copyWithoutKeys(record: UnknownRecord, excluded: Set<string>): UnknownRecord {
  const result: UnknownRecord = {}
  for (const key of Object.keys(record)) {
    if (!excluded.has(key)) result[key] = record[key]
  }
  return result
}

function canonicalDigest(value: unknown): string | null {
  const hash = createHash("sha256")
  const budget: SerializationBudget = { nodes: 0, characters: 0 }
  const ancestors = new Set<object>()
  return hashCanonicalValue(value, hash, budget, ancestors, 0) ? hash.digest("hex") : null
}

function hashCanonicalValue(
  value: unknown,
  hash: Hash,
  budget: SerializationBudget,
  ancestors: Set<object>,
  depth: number,
): boolean {
  budget.nodes += 1
  if (budget.nodes > MAX_SERIALIZED_NODES || depth > MAX_SERIALIZED_DEPTH) return false

  if (value === null) return writeCanonical(hash, budget, "null")
  if (typeof value === "string") {
    if (value.length > MAX_CANONICAL_CHARACTERS - budget.characters) return false
    return writeCanonical(hash, budget, JSON.stringify(value))
  }
  if (typeof value === "boolean") return writeCanonical(hash, budget, value ? "true" : "false")
  if (typeof value === "number") return Number.isFinite(value) && writeCanonical(hash, budget, String(value))
  if (typeof value !== "object" || ancestors.has(value)) return false

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_SERIALIZED_NODES - budget.nodes || !writeCanonical(hash, budget, "[")) return false
      for (let index = 0; index < value.length; index += 1) {
        if (index > 0 && !writeCanonical(hash, budget, ",")) return false
        if (!hashCanonicalValue(value[index], hash, budget, ancestors, depth + 1)) return false
      }
      return writeCanonical(hash, budget, "]")
    }

    const record = asRecord(value)
    if (!record) return false
    const keys: string[] = []
    for (const key in record) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue
      if (keys.length >= MAX_SERIALIZED_NODES - budget.nodes) return false
      keys.push(key)
    }
    keys.sort()
    if (!writeCanonical(hash, budget, "{")) return false
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      if (!key) return false
      if (index > 0 && !writeCanonical(hash, budget, ",")) return false
      if (!writeCanonical(hash, budget, JSON.stringify(key)) || !writeCanonical(hash, budget, ":")) return false
      if (!hashCanonicalValue(record[key], hash, budget, ancestors, depth + 1)) return false
    }
    return writeCanonical(hash, budget, "}")
  } finally {
    ancestors.delete(value)
  }
}

function writeCanonical(hash: Hash, budget: SerializationBudget, value: string): boolean {
  budget.characters += value.length
  if (budget.characters > MAX_CANONICAL_CHARACTERS) return false
  hash.update(value)
  return true
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim()
}

function sameContext(left: AssistantResult, right: AssistantResult): boolean {
  return left.sessionID === right.sessionID &&
    left.parentID === right.parentID &&
    left.providerID === right.providerID &&
    left.modelID === right.modelID &&
    left.mode === right.mode
}

function findLatestUserIndex(messages: unknown[]): number {
  const minimumIndex = Math.max(0, messages.length - MAX_HISTORY_SCAN)
  for (let index = messages.length - 1; index >= minimumIndex; index -= 1) {
    if (messageRole(messages[index]) === "user") return index
  }
  return -1
}

function messageRole(message: unknown): unknown {
  return messageInfo(message)?.role
}

function messageInfo(message: unknown): UnknownRecord | null {
  const record = asRecord(message)
  return record ? asRecord(record.info) : null
}

function stringField(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}
