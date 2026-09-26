/** Feed installation metadata is data, never a shell command. */

export function isInstallSpec(value: string): boolean {
  if (value.length > 2048 || /[\s\x00-\x1f`$<>\\]/.test(value)) return false
  if (/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*(?:@[a-zA-Z0-9.*^~+_-][a-zA-Z0-9.*^~+_-]*)?$/.test(value)) return true
  try {
    const url = new URL(value.replace(/^git\+/, ''))
    return url.protocol === 'https:' && !url.username && !url.password && !url.search
      && ['github.com', 'codeload.github.com', 'raw.githubusercontent.com'].includes(url.hostname)
      && /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?$/.test(url.pathname)
      && !url.pathname.split('/').some(p => p === '.' || p === '..')
      && (!url.hash || /^#(?:[A-Za-z0-9_./-]+)?(?:&?path:\/?[A-Za-z0-9_./-]*)?$/.test(url.hash))
  } catch { return false }
}
export interface InstallInfo {
  mode: 'command' | 'manual'
  targets: { install: string; profile: string; note: string }[]
  tasks: string[]
  requirements: string[]
  note: string
  manual: string
}
const text = (v: unknown): string => typeof v === 'string' ? v.slice(0, 2000) : ''
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 30).map(text) : []
export function parseInstallInfo(value: unknown): InstallInfo | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  if (raw.mode !== 'command' && raw.mode !== 'manual') return undefined
  const targets: InstallInfo['targets'] = []
  for (const entry of Array.isArray(raw.targets) ? raw.targets.slice(0, 30) : []) {
    if (!entry || typeof entry !== 'object' || typeof entry.install !== 'string' || !isInstallSpec(entry.install)) continue
    if (targets.some(t => t.install === entry.install && t.profile === text(entry.profile))) continue
    targets.push({ install: entry.install, profile: text(entry.profile), note: text(entry.note) })
  }
  return { mode: raw.mode, targets, tasks: strings(raw.tasks), requirements: strings(raw.requirements), note: text(raw.note), manual: text(raw.manual_instructions) }
}
