import type { InstallInfo } from '../installInfo.ts'

/** Source profiles do not change the destination: installation uses the current host. */
export function installChoices(targets: InstallInfo['targets']): InstallInfo['targets'] {
  return targets.filter((entry, i) => targets.findIndex(other => other.install === entry.install) === i)
}

/** Keep subpackage paths visible without making the full repository URL a control label. */
export function installLabel(spec: string): string {
  try {
    const url = new URL(spec.replace(/^git\+/, ''))
    const path = url.hash.match(/(?:#|&)path:\/?(.+)$/)?.[1]
    if (path) return path
    return url.pathname.replace(/^\//, '').replace(/\.git$/, '') + url.hash
  } catch { return spec }
}
