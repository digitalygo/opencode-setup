import type { Seams } from "./seams.js"
import type { UsageLogPayload } from "./types.js"
import { FETCH_TIMEOUT_MS } from "./outbox-validation.js"

export function retryable(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599)
}

export async function postPayload(
  endpoint: string,
  apiKey: string,
  payload: UsageLogPayload,
  seams: Seams,
  abortController: AbortController,
): Promise<{ ok: boolean; status: number }> {
  const t = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await seams.network.fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
      redirect: "error",
    })
    const { ok, status, body } = res
    if (body) {
      try {
        await body.cancel()
      } catch {
        throw new Error("body_drain_failed")
      }
    }
    clearTimeout(t)
    return { ok, status }
  } catch (err) {
    clearTimeout(t)
    throw err
  }
}
