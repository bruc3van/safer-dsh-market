import { PROFILE_NAME_PATTERN } from './shapes.ts'

/** Launcher-owned identity wins over legacy plugin configuration. */
export function resolveActiveProfile(
  context: { name: string; dir: string; home: string } | undefined,
  configured: string,
): { name: string; dir?: string; home?: string } {
  const name = context?.name ?? configured
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error('Cannot identify the active DSH profile; no default profile will be assumed')
  }
  if (context && (!context.dir || !context.home)) {
    throw new Error('The active DSH profile is missing its directory or home')
  }
  return context ? { name, dir: context.dir, home: context.home } : { name }
}
