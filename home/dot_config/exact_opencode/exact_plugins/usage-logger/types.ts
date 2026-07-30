export interface StepFinishPart {
  id: string
  sessionID: string
  messageID: string
  type: "step-finish"
  reason: string
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
}

export interface AssistantMessageInfo {
  providerID: string
  modelID: string
  mode: string
}

export interface UsageLogPayload {
  schemaVersion: 2
  sourceEventId: string
  event: "llm.step.completed"
  createdAt: number
  providerId: string
  modelId: string
  mode: string
  usage: number
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  projectCode: string
}

export interface ResolvedConfig {
  base: string
  key: string
}

export interface OutboxRecord {
  sourceEventId: string
  payload: UsageLogPayload
  createdAt: number
  retries: number
  lastAttempt?: number
  nextAttemptAt?: number
}

export interface PendingStep {
  sessionID: string
  messageID: string
  partID: string
  cost: number
  tokens: StepFinishPart["tokens"]
  createdAt: number
  enqueuedAt: number
}

export interface LogEntry {
  ts: string
  sourceEventId: string
  status?: number
  category?: string
}
