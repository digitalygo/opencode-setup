export const MAX_ID_LEN = 256
export const MAX_MODE_LEN = 64
const RE_SAFE_STRING = /^[\x20-\x7E]+$/

export const TOKEN_CAP = 1e12
export const COST_CAP = 1e12

export function validateNonemptyBounded(v: unknown, maxLen: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= maxLen && RE_SAFE_STRING.test(v)
}

export function validateMessageUpdatedProps(properties: Record<string, unknown>): properties is { info: { role: string; providerID: string; modelID: string; mode: string; id: string } } {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return false
  const info = (properties as Record<string, unknown>).info as Record<string, unknown> | undefined
  if (!info || typeof info !== "object" || Array.isArray(info)) return false
  if (info.role !== "assistant") return false
  return (
    validateNonemptyBounded(info.providerID, MAX_ID_LEN) &&
    validateNonemptyBounded(info.modelID, MAX_ID_LEN) &&
    validateNonemptyBounded(info.mode, MAX_MODE_LEN) &&
    validateNonemptyBounded(info.id, MAX_ID_LEN)
  )
}

export function validateStepFinishTokens(t: unknown): t is { input: number; output: number; reasoning: number; cache: { read: number; write: number } } {
  if (!t || typeof t !== "object") return false
  const tokens = t as Record<string, unknown>
  const input = tokens.input
  const output = tokens.output
  const reasoning = tokens.reasoning
  const cache = tokens.cache as Record<string, unknown> | undefined
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0 || !Number.isSafeInteger(input) || input > TOKEN_CAP) return false
  if (typeof output !== "number" || !Number.isFinite(output) || output < 0 || !Number.isSafeInteger(output) || output > TOKEN_CAP) return false
  if (typeof reasoning !== "number" || !Number.isFinite(reasoning) || reasoning < 0 || !Number.isSafeInteger(reasoning) || reasoning > TOKEN_CAP) return false
  if (!cache || typeof cache !== "object") return false
  if (typeof cache.read !== "number" || !Number.isFinite(cache.read) || cache.read < 0 || !Number.isSafeInteger(cache.read) || cache.read > TOKEN_CAP) return false
  if (typeof cache.write !== "number" || !Number.isFinite(cache.write) || cache.write < 0 || !Number.isSafeInteger(cache.write) || cache.write > TOKEN_CAP) return false
  return true
}

export function validateStepFinishPart(part: unknown): part is { id: string; sessionID: string; messageID: string; type: "step-finish"; cost: number; tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } } } {
  if (!part || typeof part !== "object" || Array.isArray(part)) return false
  const p = part as Record<string, unknown>
  if (p.type !== "step-finish") return false
  if (typeof p.id !== "string" || p.id.length === 0 || p.id.length > MAX_ID_LEN) return false
  if (typeof p.sessionID !== "string" || p.sessionID.length === 0 || p.sessionID.length > MAX_ID_LEN) return false
  if (typeof p.messageID !== "string" || p.messageID.length === 0 || p.messageID.length > MAX_ID_LEN) return false
  if (typeof p.cost !== "number" || !Number.isFinite(p.cost) || p.cost < 0 || p.cost > COST_CAP) return false
  if (!validateStepFinishTokens(p.tokens)) return false
  return true
}
