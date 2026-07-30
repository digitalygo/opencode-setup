import { computeSourceEventId } from "./id.js"
import {
  secureEnsureDir,
  secureAtomicWrite,
  secureReadFile,
  secureScanDir,
  secureUnlink,
  readdirBounded,
} from "./secure-fs.js"
import type { Seams } from "./seams.js"
import type { PendingStep } from "./types.js"

export const PENDING_MAX_AGE_MS = 2 * 60 * 60 * 1000
export const PENDING_MAX_COUNT = 20000
export const PENDING_MAX_TOTAL_BYTES = 128 * 1024 * 1024

const TOKEN_CAP = 1e12
const COST_CAP = 1e12
const MAX_FUTURE_SKEW_MS = 300_000
const CORRUPT_ALLOWANCE = 100
const MAX_FILE_BYTES = 65536
const DIR_SCAN_LIMIT = 20000

export interface PendingStoreOptions {
  maxAgeMs?: number
  maxCount?: number
  maxTotalBytes?: number
  onDeleteFail?: (path: string) => void
}

function pendingDir(baseDir: string): string {
  return `${baseDir}/pending`
}

function pendingPath(
  baseDir: string,
  sessionID: string,
  messageID: string,
  partID: string,
): string {
  const id = computeSourceEventId(sessionID, messageID, partID)
  return `${pendingDir(baseDir)}/${id}.json`
}

function validatePendingStep(parsed: unknown): parsed is PendingStep {
  if (!parsed || typeof parsed !== "object") return false
  const p = parsed as Record<string, unknown>
  if (typeof p.sessionID !== "string" || p.sessionID.length === 0) return false
  if (typeof p.messageID !== "string" || p.messageID.length === 0) return false
  if (typeof p.partID !== "string" || p.partID.length === 0) return false
  if (typeof p.cost !== "number" || !Number.isFinite(p.cost) || p.cost < 0 || p.cost > COST_CAP)
    return false
  if (
    typeof p.createdAt !== "number" ||
    !Number.isFinite(p.createdAt) ||
    p.createdAt <= 0
  )
    return false
  if (
    typeof p.enqueuedAt !== "number" ||
    !Number.isFinite(p.enqueuedAt) ||
    p.enqueuedAt <= 0
  )
    return false
  if (typeof p.enqueuedAt === "number" && typeof p.createdAt === "number" && p.enqueuedAt < p.createdAt)
    return false
  const t = p.tokens as Record<string, unknown> | undefined
  if (!t || typeof t !== "object") return false
  if (typeof t.input !== "number" || !Number.isFinite(t.input) || t.input < 0 || !Number.isSafeInteger(t.input) || t.input > TOKEN_CAP)
    return false
  if (
    typeof t.output !== "number" ||
    !Number.isFinite(t.output) ||
    t.output < 0 || !Number.isSafeInteger(t.output) || t.output > TOKEN_CAP
  )
    return false
  if (
    typeof t.reasoning !== "number" ||
    !Number.isFinite(t.reasoning) ||
    t.reasoning < 0 || !Number.isSafeInteger(t.reasoning) || t.reasoning > TOKEN_CAP
  )
    return false
  const cache = t.cache as Record<string, unknown> | undefined
  if (!cache || typeof cache !== "object") return false
  if (typeof cache.read !== "number" || !Number.isFinite(cache.read) || cache.read < 0 || !Number.isSafeInteger(cache.read) || cache.read > TOKEN_CAP)
    return false
  if (typeof cache.write !== "number" || !Number.isFinite(cache.write) || cache.write < 0 || !Number.isSafeInteger(cache.write) || cache.write > TOKEN_CAP)
    return false
  return true
}

const SOURCE_EVENT_ID_RE = /^[0-9a-f]{64}$/

export interface PendingStore {
  persist(step: PendingStep): boolean
  load(): PendingStep[]
  delete(sessionID: string, messageID: string, partID: string): boolean
}

export function createPendingStore(
  baseDir: string,
  canonicalHome: string,
  seams: Seams,
  options: PendingStoreOptions = {},
): PendingStore {
  const maxAgeMs = options.maxAgeMs ?? PENDING_MAX_AGE_MS
  const maxCount = options.maxCount ?? PENDING_MAX_COUNT
  const maxTotalBytes = options.maxTotalBytes ?? PENDING_MAX_TOTAL_BYTES
  const dir = pendingDir(baseDir)

  if (!secureEnsureDir(dir, canonicalHome, seams)) {
    throw new Error("pending_dir_setup_failed")
  }

  const { fs } = seams

  let dirValid = true

  function validateDir(): boolean {
    if (!dirValid) return false
    dirValid = secureEnsureDir(dir, canonicalHome, seams)
    return dirValid
  }

  function persist(step: PendingStep): boolean {
    if (!validateDir()) return false
    const data = JSON.stringify({
      sessionID: step.sessionID,
      messageID: step.messageID,
      partID: step.partID,
      cost: step.cost,
      tokens: step.tokens,
      createdAt: step.createdAt,
      enqueuedAt: step.enqueuedAt,
    })
    const dataBytes = Buffer.byteLength(data, "utf8")
    if (dataBytes > maxTotalBytes) return false
    const usage = secureScanDir(dir, canonicalHome, seams)
    if (usage.count >= maxCount) return false
    if (usage.totalBytes + dataBytes > maxTotalBytes) return false
    const sourceEventId = computeSourceEventId(
      step.sessionID,
      step.messageID,
      step.partID,
    )
    return secureAtomicWrite(`${dir}/${sourceEventId}.json`, data, canonicalHome, seams)
  }

  function load(): PendingStep[] {
    if (!validateDir()) return []
    if (!fs.existsSync(dir)) return []
    let files: string[]
    try {
      files = readdirBounded(dir, DIR_SCAN_LIMIT, seams).filter((f) => f.endsWith(".json"))
    } catch {
      return []
    }
    const steps: PendingStep[] = []
    const now = seams.time.now()
    const bounded = files.slice(0, maxCount + CORRUPT_ALLOWANCE)
    for (const file of bounded) {
      const fp = `${dir}/${file}`
      try {
        try {
          const st = seams.fs.lstatSync(fp)
          if (st.isSymbolicLink()) {
            if (!secureUnlink(fp, canonicalHome, seams)) {
              options.onDeleteFail?.(fp)
            }
            continue
          }
          if (st.size > MAX_FILE_BYTES) {
            if (!secureUnlink(fp, canonicalHome, seams)) {
              options.onDeleteFail?.(fp)
            }
            continue
          }
        } catch {
          if (!secureUnlink(fp, canonicalHome, seams)) {
            options.onDeleteFail?.(fp)
          }
          continue
        }
        const raw = secureReadFile(fp, canonicalHome, seams)
        if (raw === null) {
          if (!secureUnlink(fp, canonicalHome, seams)) {
            options.onDeleteFail?.(fp)
          }
          continue
        }
        const parsed: unknown = JSON.parse(raw)
        if (!validatePendingStep(parsed)) {
          if (!secureUnlink(fp, canonicalHome, seams)) {
            options.onDeleteFail?.(fp)
          }
          continue
        }
        if (parsed.enqueuedAt > now + MAX_FUTURE_SKEW_MS || parsed.createdAt > now + MAX_FUTURE_SKEW_MS) {
          if (!secureUnlink(fp, canonicalHome, seams)) {
            options.onDeleteFail?.(fp)
          }
          continue
        }
        const nameWithoutExt = file.slice(0, -5)
        if (!SOURCE_EVENT_ID_RE.test(nameWithoutExt)) {
          if (!secureUnlink(fp, canonicalHome, seams)) {
            options.onDeleteFail?.(fp)
          }
          continue
        }
        const expectedId = computeSourceEventId(
          parsed.sessionID,
          parsed.messageID,
          parsed.partID,
        )
        if (nameWithoutExt !== expectedId) {
          if (!secureUnlink(fp, canonicalHome, seams)) {
            options.onDeleteFail?.(fp)
          }
          continue
        }
        if (now - parsed.enqueuedAt > maxAgeMs) {
          if (!secureUnlink(fp, canonicalHome, seams)) {
            options.onDeleteFail?.(fp)
          }
          continue
        }
        steps.push(parsed)
      } catch {
        if (!secureUnlink(fp, canonicalHome, seams)) {
          options.onDeleteFail?.(fp)
        }
      }
    }
    return steps
  }

  function deleteStep(
    sessionID: string,
    messageID: string,
    partID: string,
  ): boolean {
    const path = pendingPath(baseDir, sessionID, messageID, partID)
    if (!validateDir()) {
      options.onDeleteFail?.(path)
      return false
    }
    if (!secureUnlink(path, canonicalHome, seams)) {
      options.onDeleteFail?.(path)
      return false
    }
    return true
  }

  return { persist, load, delete: deleteStep }
}
