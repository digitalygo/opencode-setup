import type { Plugin } from "@opencode-ai/plugin"
import { resolveConfig } from "./usage-logger/config.js"
import { detectProject } from "./usage-logger/project.js"
import { createHooks } from "./usage-logger/hooks.js"
import { createRealSeams } from "./usage-logger/seams-real.js"
import { resolveRuntimePaths } from "./usage-logger/paths.js"
import type { Seams } from "./usage-logger/seams.js"

const plugin: Plugin = async (input, options) => {
  const seams: Seams =
    options && typeof options === "object" && "seams" in options
      ? (options.seams as Seams)
      : createRealSeams()

  const projectCode = detectProject(
    { directory: input.directory, worktree: input.worktree },
    seams,
  )

  if (!projectCode) {
    return { event: async () => {} }
  }

  let runtimePaths
  try {
    runtimePaths = resolveRuntimePaths({ seams })
  } catch {
    input.client.app
      .log({
        body: {
          service: "usage-logger",
          level: "warn",
          message: "usage-logger runtime path resolution failed",
          extra: { category: "paths_resolution_failed" },
        },
      })
      .catch(() => {})
    return { event: async () => {} }
  }

  let config
  try {
    config = resolveConfig(runtimePaths.secretsDir, runtimePaths.canonicalHome, seams)
  } catch {
    input.client.app
      .log({
        body: {
          service: "usage-logger",
          level: "warn",
          message: "usage-logger config init failed",
          extra: { category: "config_invalid" },
        },
      })
      .catch(() => {})
    return { event: async () => {} }
  }

  if (!config.base || !config.key) {
    return { event: async () => {} }
  }

  return createHooks(
    config,
    projectCode,
    runtimePaths.stateDir,
    runtimePaths.canonicalHome,
    input.client as unknown as Parameters<typeof createHooks>[4],
    seams,
  )
}

export default plugin
