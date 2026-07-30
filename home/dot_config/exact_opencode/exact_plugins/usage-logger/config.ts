import { relative as pathRelative, isAbsolute } from "node:path"
import type { Seams } from "./seams.js"
import type { ResolvedConfig } from "./types.js"

function isContained(child: string, parent: string): boolean {
  const rel = pathRelative(parent, child)
  if (rel === "") return true
  if (rel.startsWith("..")) return false
  return !isAbsolute(rel)
}

export function validateBaseUrl(base: string): string {
  let url: URL
  try {
    url = new URL(base)
  } catch {
    throw new Error("usage-log-api-base is not a valid URL")
  }
  if (url.username || url.password) {
    throw new Error("usage-log-api-base must not contain credentials")
  }
  if (url.search) {
    throw new Error("usage-log-api-base must not contain query parameters")
  }
  if (url.hash) {
    throw new Error("usage-log-api-base must not contain a fragment")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      "usage-log-api-base must use HTTP or HTTPS",
    )
  }
  const isLocalhost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname === "[::1]"
  if (url.protocol !== "https:" && !isLocalhost) {
    throw new Error(
      "usage-log-api-base must use HTTPS (or HTTP for localhost)",
    )
  }
  return base.replace(/\/$/, "")
}

function containsSymlinkDescendant(
  targetPath: string,
  canonicalHome: string,
  seams: Seams,
): boolean {
  const { fs } = seams
  const parts = targetPath.split("/").filter(Boolean)
  let prefix = ""
  let started = false
  for (const part of parts) {
    prefix += "/" + part
    if (!fs.existsSync(prefix)) break
    if (!started && prefix === canonicalHome) {
      started = true
      continue
    }
    if (!started) continue
    try {
      const st = fs.lstatSync(prefix)
      if (st.isSymbolicLink()) return true
    } catch {
      break
    }
  }
  return false
}

function validateSecureDir(
  dirPath: string,
  canonicalHome: string,
  label: string,
  seams: Seams,
): void {
  const { fs, platform } = seams
  if (!isContained(dirPath, canonicalHome)) {
    throw new Error(`${label} not contained under canonical home`)
  }
  if (containsSymlinkDescendant(dirPath, canonicalHome, seams)) {
    throw new Error(`${label} contains symlink path component`)
  }
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${label} not found`)
  }
  const st = fs.lstatSync(dirPath)
  if (st.isSymbolicLink()) {
    throw new Error(`${label} is a symbolic link`)
  }
  if (!st.isDirectory()) {
    throw new Error(`${label} is not a directory`)
  }
  const uid = platform.getuid?.()
  if (uid !== undefined && st.uid !== uid) {
    throw new Error(`${label} not owned by current user`)
  }
  if ((st.mode & 0o022) !== 0) {
    throw new Error(`${label} has group/other write permission`)
  }
}

function readSecret(
  filePath: string,
  canonicalHome: string,
  label: string,
  seams: Seams,
): string {
  const { fs } = seams

  if (!isContained(filePath, canonicalHome)) {
    throw new Error(`${label} not contained under canonical home`)
  }
  if (containsSymlinkDescendant(filePath, canonicalHome, seams)) {
    throw new Error(`${label} contains symlink path component`)
  }

  const beforeStat = fs.lstatSync(filePath)
  if (beforeStat.isSymbolicLink()) {
    throw new Error(`${label} is a symbolic link`)
  }
  if (!beforeStat.isFile()) {
    throw new Error(`${label} is not a regular file`)
  }
  const uid = seams.platform.getuid?.()
  if (uid !== undefined && beforeStat.uid !== uid) {
    throw new Error(`${label} not owned by current user`)
  }

  const fcntl = fs.fcntlConstants()
  const flags =
    fcntl.O_NOFOLLOW !== undefined
      ? fcntl.O_NOFOLLOW | fcntl.O_RDONLY
      : fcntl.O_RDONLY

  let fd: number
  try {
    fd = fs.openSync(filePath, flags)
  } catch {
    throw new Error(`${label} not found or not readable`)
  }
  try {
    const afterStat = fs.fstatSync(fd)
    if (afterStat.dev !== beforeStat.dev || afterStat.ino !== beforeStat.ino) {
      throw new Error(`${label} not found or not readable`)
    }
    if (!afterStat.isFile()) {
      throw new Error(`${label} is not a regular file`)
    }
    if (uid !== undefined && afterStat.uid !== uid) {
      throw new Error(`${label} not owned by current user`)
    }
    if ((afterStat.mode & 0o077) !== 0) {
      throw new Error(`${label} has overly permissive mode`)
    }
    const buf = Buffer.alloc(4096)
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0)
    const afterReadStat = fs.fstatSync(fd)
    if (afterReadStat.dev !== beforeStat.dev || afterReadStat.ino !== beforeStat.ino) {
      throw new Error(`${label} not found or not readable`)
    }
    const raw = Buffer.from(buf.slice(0, bytes)).toString("utf8").trim()
    if (!raw) {
      throw new Error(`${label} is empty`)
    }
    return raw
  } finally {
    try {
      fs.closeSync(fd)
    } catch {
    }
  }
}

export function resolveConfig(
  secretsDir: string,
  canonicalHome: string,
  seams: Seams,
): ResolvedConfig {
  validateSecureDir(secretsDir, canonicalHome, "usage-log secrets directory", seams)
  const base = readSecret(
    `${secretsDir}/usage-log-api-base`,
    canonicalHome,
    "usage-log-api-base",
    seams,
  )
  const key = readSecret(
    `${secretsDir}/usage-log-api-key`,
    canonicalHome,
    "usage-log-api-key",
    seams,
  )
  const validatedBase = validateBaseUrl(base)
  return { base: validatedBase, key }
}
