import { rmSync, readdirSync, lstatSync, realpathSync } from "node:fs"
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

export function runTests() {
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

    const testDir = resolve(outDir, "exact_plugins", "usage-logger", "__tests__")
    const testFiles = readdirSync(testDir)
      .filter((f) => f.endsWith(".test.js"))
      .map((f) => resolve(testDir, f))

    const buildDirTestFile = resolve(rootDir, "exact_plugins", "usage-logger", "__tests__", "build-dir.test.js")
    const allTestFiles = [...testFiles, buildDirTestFile]

    const testResult = spawnSync(process.execPath, ["--test", ...allTestFiles], {
      cwd: rootDir,
      stdio: "inherit",
    })
    return testResult.status ?? 1
  } finally {
    try {
      rmSync(outDir, { recursive: true, force: true })
    } catch {}
  }
}

validateTscPath()
const status = runTests()
if (status !== 0) process.exitCode = status
