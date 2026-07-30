import type { Seams } from "./seams.js"

const CTL_RE = /[\x00-\x1f\x7f]/
const REJECTED_PREFIXES = ["file:", "ext::"]
const SCP_HOST_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/
const SCP_PATH_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]+$/

export function normalizeGitRemote(remoteUrl: string): string {
  if (!remoteUrl) return ""
  if (CTL_RE.test(remoteUrl)) return ""
  for (const prefix of REJECTED_PREFIXES) {
    if (remoteUrl.startsWith(prefix)) return ""
  }
  const scp = normalizeScpRemote(remoteUrl)
  if (scp) return scp
  const url = normalizeUrlRemote(remoteUrl)
  if (url) return url
  return ""
}

function normalizeUrlRemote(remoteUrl: string): string | null {
  let url: URL
  try {
    url = new URL(remoteUrl)
  } catch {
    return null
  }
  if (url.protocol !== "https:") return null
  if (url.search || url.hash) return null
  if (url.password) return null
  if (!url.hostname || url.hostname.length === 0) return null
  if (CTL_RE.test(url.hostname)) return null
  const pathParts = url.pathname.split("/").filter(Boolean)
  if (pathParts.length < 2) return null
  for (const part of pathParts) {
    if (part.length === 0) return null
    if (part === "." || part === "..") return null
    if (CTL_RE.test(part)) return null
  }
  let last = pathParts[pathParts.length - 1]!
  if (last.endsWith(".git")) {
    last = last.slice(0, -4)
    pathParts[pathParts.length - 1] = last
  }
  return `${url.hostname.toLowerCase()}/${pathParts.map((p) => p.toLowerCase()).join("/")}`
}

function normalizeScpRemote(remoteUrl: string): string | null {
  const colonIdx = remoteUrl.indexOf(":")
  if (colonIdx < 0) return null
  const hostPortion = remoteUrl.slice(0, colonIdx)
  const pathPortion = remoteUrl.slice(colonIdx + 1)
  if (!hostPortion.startsWith("git@")) return null
  const host = hostPortion.slice(4)
  if (!SCP_HOST_RE.test(host)) return null
  let path = pathPortion.replace(/\.git$/, "").replace(/\/$/, "")
  if (!SCP_PATH_RE.test(path)) return null
  const parts = path.split("/")
  if (parts.length < 2) return null
  for (const part of parts) {
    if (part.length === 0 || part === "." || part === "..") return null
  }
  return `${host.toLowerCase()}/${parts.map((p) => p.toLowerCase()).join("/")}`
}

function isGitRepo(dir: string, seams: Seams): boolean {
  const result = seams.git.execGit(
    ["rev-parse", "--is-inside-work-tree"],
    dir,
  )
  return result === "true"
}

function getRemoteOrigin(dir: string, seams: Seams): string {
  const result = seams.git.execGit(["remote", "get-url", "origin"], dir)
  if (result === null) return ""
  return result.trim()
}

export function detectProject(
  input: { directory: string; worktree: string },
  seams: Seams,
): string {
  const worktree = input.worktree
  const directory = input.directory

  const primaryDir = isGitRepo(worktree, seams) ? worktree : directory
  if (!isGitRepo(primaryDir, seams)) return ""

  const remoteUrl = getRemoteOrigin(primaryDir, seams)
  return normalizeGitRemote(remoteUrl)
}
