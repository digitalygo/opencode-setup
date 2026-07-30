import { rmSync, readdirSync, lstatSync, realpathSync, readFileSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { tmpdir, userInfo } from "node:os"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

const NAMESPACE_PREFIX = "oc-ul"
const LEASE_FILENAME = ".oc-ul-lease"
const LEASE_AGE_MS = 24 * 60 * 60 * 1000
const MTIME_THRESHOLD_MS = 60 * 60 * 1000

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(scriptDir, "..")

function namespaceHash() {
  let uid = ""
  try {
    uid = String(userInfo().uid)
  } catch {}
  return createHash("sha256")
    .update(`${pkgRoot}:${uid}`)
    .digest("hex")
    .slice(0, 12)
}

const matchingPrefix = `${NAMESPACE_PREFIX}-${namespaceHash()}-`

function currentUid() {
  let uid
  try {
    uid = userInfo().uid
  } catch {}
  return uid
}

const uid = currentUid()

function pidAlive(pid) {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readLease(dir) {
  try {
    const leasePath = join(dir, LEASE_FILENAME)
    const lst = lstatSync(leasePath)
    if (!lst.isFile() || lst.isSymbolicLink()) return null
    const raw = readFileSync(leasePath, "utf8")
    const lease = JSON.parse(raw)
    if (typeof lease.pid !== "number" || typeof lease.createdAt !== "string") return null
    return { pid: lease.pid, createdAt: Date.parse(lease.createdAt) }
  } catch {
    return null
  }
}

function isLeaseHealthy(lease) {
  if (lease === null) return false
  if (Number.isNaN(lease.createdAt)) return false
  const age = Date.now() - lease.createdAt
  if (age > LEASE_AGE_MS) return false
  return pidAlive(lease.pid)
}

function dirMtimeMs(dir) {
  try {
    return lstatSync(dir).mtimeMs
  } catch {
    return Infinity
  }
}

function shouldRemove(fullPath) {
  const lease = readLease(fullPath)
  if (lease !== null) return !isLeaseHealthy(lease)
  const age = Date.now() - dirMtimeMs(fullPath)
  return age > MTIME_THRESHOLD_MS
}

const base = tmpdir()
let entries
try {
  entries = readdirSync(base)
} catch {
  entries = []
}

for (const entry of entries) {
  if (!entry.startsWith(matchingPrefix)) continue
  const fullPath = join(base, entry)
  try {
    const lst = lstatSync(fullPath)
    if (lst.isSymbolicLink()) continue
    if (!lst.isDirectory()) continue
    if ((lst.mode & 0o022) !== 0) continue
    if (uid !== undefined && lst.uid !== uid) continue
    const real = realpathSync(fullPath)
    if (real !== resolve(fullPath)) continue
    if (!shouldRemove(fullPath)) continue
    rmSync(fullPath, { recursive: true, force: true })
  } catch {}
}
