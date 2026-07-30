import { tmpdir, userInfo } from "node:os"
import { resolve, dirname, join } from "node:path"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { mkdtempSync, lstatSync, realpathSync, writeFileSync, rmSync } from "node:fs"

const NAMESPACE_PREFIX = "oc-ul"
const LEASE_FILENAME = ".oc-ul-lease"

function packageRoot() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  return resolve(scriptDir, "..")
}

function namespaceHash() {
  const pkgRoot = packageRoot()
  let uid = ""
  try {
    uid = String(userInfo().uid)
  } catch {}
  return createHash("sha256")
    .update(`${pkgRoot}:${uid}`)
    .digest("hex")
    .slice(0, 12)
}

function validateBuildDir(dir) {
  const st = lstatSync(dir)
  if (st.isSymbolicLink()) throw new Error("build dir is symlink")
  if (!st.isDirectory()) throw new Error("build dir is not a directory")
  if ((st.mode & 0o022) !== 0) throw new Error("build dir has group or other write")
  const real = realpathSync(dir)
  if (real !== resolve(dir)) throw new Error("build dir realpath mismatch")
  let uid
  try {
    uid = userInfo().uid
  } catch {}
  if (uid !== undefined && st.uid !== uid) throw new Error("build dir not owned by current user")
}

function writeOwnerLease(dir) {
  const leasePath = join(dir, LEASE_FILENAME)
  const lease = JSON.stringify({
    pid: process.pid,
    createdAt: new Date().toISOString(),
  })
  writeFileSync(leasePath, lease, { mode: 0o600 })
}

export function getBuildDir(deps) {
  const validateDir = deps?.validateBuildDir ?? validateBuildDir
  const writeLease = deps?.writeOwnerLease ?? writeOwnerLease
  const base = tmpdir()
  const prefix = `${NAMESPACE_PREFIX}-${namespaceHash()}-`
  const dir = mkdtempSync(join(base, prefix))
  try {
    validateDir(dir)
    writeLease(dir)
    return dir
  } catch (e) {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
    throw e
  }
}
