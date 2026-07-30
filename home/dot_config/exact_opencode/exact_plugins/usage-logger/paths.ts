import { join, normalize, relative, resolve, isAbsolute, sep } from "node:path"
import type { Seams } from "./seams.js"

export const STATE_RELATIVE_LINUX = ".local/state/opencode-usage-logger"
export const STATE_RELATIVE_MACOS = "Library/Application Support/opencode-usage-logger"

export interface RuntimePaths {
  stateDir: string
  secretsDir: string
  canonicalHome: string
}

function isContained(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  if (rel === "") return true
  if (rel.startsWith("..")) return false
  return !isAbsolute(rel)
}

function canonicalHomeDir(seams: Seams): string {
  const raw = seams.platform.homedir()

  const parts = raw.split(sep).filter(Boolean)
  if (parts.length === 0) {
    throw new Error("home dir path is empty")
  }

  if (parts.includes("..")) {
    throw new Error(`home dir ${raw} contains traversal`)
  }

  const norm = normalize(raw)

  if (!isAbsolute(norm)) {
    throw new Error(`home dir ${norm} is not absolute`)
  }

  let canonical: string
  try {
    canonical = seams.fs.realpathSync(norm)
  } catch {
    throw new Error(`cannot canonicalize home dir ${norm}`)
  }

  return canonical
}

export function resolveRuntimePaths(opts: {
  seams: Seams
}): RuntimePaths {
  const { seams } = opts
  const canonicalHome = canonicalHomeDir(seams)
  const osType = seams.platform.platform()

  const stateRelative =
    osType === "darwin" ? STATE_RELATIVE_MACOS : STATE_RELATIVE_LINUX

  const stateDir = resolve(canonicalHome, stateRelative)
  const secretsDir = resolve(canonicalHome, "Documents", ".secrets")

  if (!isContained(stateDir, canonicalHome)) {
    throw new Error(`state dir ${stateDir} not contained under home`)
  }
  if (!isContained(secretsDir, canonicalHome)) {
    throw new Error(`secrets dir ${secretsDir} not contained under home`)
  }

  return { stateDir, secretsDir, canonicalHome }
}
