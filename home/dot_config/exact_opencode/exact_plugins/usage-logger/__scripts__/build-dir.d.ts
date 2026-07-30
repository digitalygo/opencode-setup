export function getBuildDir(deps?: {
  validateBuildDir?: (dir: string) => void
  writeOwnerLease?: (dir: string) => void
}): string
