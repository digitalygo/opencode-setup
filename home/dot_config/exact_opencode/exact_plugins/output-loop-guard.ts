import type { Plugin } from "@opencode-ai/plugin"
import { createOutputLoopGuard, type OutputLoopGuard } from "./output-loop-guard/guard.js"
import type { OutputLoopReceipt } from "./output-loop-guard/detector.js"

const SERVICE = "output-loop-guard"
const MAX_IDENTIFIER_LENGTH = 128

const OutputLoopGuardPlugin: Plugin = async ({ client }) => {
  const guard = createOutputLoopGuard()

  const block = (receipt: OutputLoopReceipt): never => {
    try {
      void client.app.log({
        body: {
          service: SERVICE,
          level: "warn",
          message: "repeated assistant output blocked",
          extra: {
            category: "output_loop_detected",
            sessionID: safeIdentifier(receipt.sessionID),
            providerID: safeIdentifier(receipt.providerID),
            modelID: safeIdentifier(receipt.modelID),
            mode: safeIdentifier(receipt.mode),
            repeatCount: receipt.repeatCount,
          },
        },
      }).catch(() => {})
    } catch {}

    throw new Error(`Output loop guard stopped the session after identical assistant results repeated ${receipt.repeatCount} times.`)
  }

  return {
    "chat.message": async (input, output) => {
      if (typeof input.sessionID === "string") guard.observeUserMessage(input.sessionID, output.parts)
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      const receipt = guard.inspect(output.messages)
      if (receipt && !guard.consume(receipt.sessionID)) block(receipt)
    },
    "chat.params": async (input) => {
      const receipt = consumeReceipt(guard, input.sessionID)
      if (receipt) block(receipt)
    },
  }
}

function consumeReceipt(
  guard: OutputLoopGuard,
  sessionID: unknown,
): OutputLoopReceipt | null {
  if (typeof sessionID !== "string") return null
  return guard.consume(sessionID)
}

function safeIdentifier(value: string): string {
  return value.slice(0, MAX_IDENTIFIER_LENGTH).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, "?")
}

export default OutputLoopGuardPlugin
