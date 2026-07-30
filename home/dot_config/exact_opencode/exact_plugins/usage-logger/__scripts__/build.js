import { rmSync, readdirSync, existsSync, lstatSync, realpathSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve, dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { getBuildDir } from "./build-dir.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, "..", "..", "..")
const tscPath = resolve(rootDir, "node_modules", "typescript", "bin", "tsc")

function validateTscPath() {
  const tscStat = lstatSync(tscPath)
  if (!tscStat.isFile()) {
    process.stderr.write("tsc is not a regular file\n")
    process.exit(1)
  }
  if (tscStat.isSymbolicLink()) {
    process.stderr.write("tsc is a symlink\n")
    process.exit(1)
  }
  const tscReal = realpathSync(tscPath)
  const tscRelative = relative(rootDir, tscReal)
  if (tscRelative.startsWith("..") || tscRelative.startsWith("/")) {
    process.stderr.write("tsc resolves outside package root\n")
    process.exit(1)
  }
}

function checkEmittedJs(outDir) {
  const walkRoot = resolve(outDir, "exact_plugins", "usage-logger")
  const topLevelFile = resolve(outDir, "exact_plugins", "usage-logger.js")
  if (existsSync(topLevelFile)) {
    const check = spawnSync(process.execPath, ["--check", topLevelFile], {
      stdio: "inherit",
    })
    if (check.status !== 0) {
      process.stderr.write(`node --check failed: ${topLevelFile}\n`)
      return 1
    }
  }
  if (existsSync(walkRoot)) {
    function checkJsDir(dir) {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          const inner = checkJsDir(full)
          if (inner !== 0) return inner
        } else if (entry.name.endsWith(".js")) {
          const check = spawnSync(process.execPath, ["--check", full], {
            stdio: "inherit",
          })
          if (check.status !== 0) {
            process.stderr.write(`node --check failed: ${full}\n`)
            return 1
          }
        }
      }
      return 0
    }
    return checkJsDir(walkRoot)
  }
  return 0
}

export function runBuild() {
  const outDir = getBuildDir()
  try {
    const buildResult = spawnSync(process.execPath, [
      "--no-warnings",
      tscPath,
      "--noEmit", "false",
      "--outDir", outDir,
    ], {
      cwd: rootDir,
      stdio: "inherit",
    })
    if (buildResult.status !== 0) {
      return buildResult.status ?? 1
    }

    return checkEmittedJs(outDir)
  } finally {
    try {
      rmSync(outDir, { recursive: true, force: true })
    } catch {}
  }
}

validateTscPath()
const status = runBuild()
if (status !== 0) process.exitCode = status
