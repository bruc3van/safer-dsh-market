/**
 * The skills read: what this deployment can currently resolve, reduced to the
 * wire shape the market renders.
 *
 * The read is addressed by a Session, never by waking its Agent. The registry
 * is host+per-scope layered, and the web deployment disables the host-plane
 * `skill-filesystem` row on purpose — local discovery belongs to whichever
 * agent preset a session runs. A read from the plugin's root context with no
 * scope would therefore see the global layer alone and report "no skills" to
 * a user who has plenty. Like the Host's own `SessionSkillCatalog`, the
 * session's projected working directory and preset select the view: a live
 * Agent is its own scope (and its preset may mount an isolated `skills`
 * service), a cold one borrows its preset's standing scope, so opening the
 * page or refocusing the window never resumes a session.
 *
 * Incompleteness is carried through rather than hidden: a list that silently
 * lost a provider's skills would read as "you have none of those", which is a
 * different and wrong statement.
 */
import { homedir } from 'node:os'
import { posix, win32 } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { MarketSkill, MarketSkillsResult } from './contract.ts'

/** The registry face this module needs — structural, so the plugin body owns the import. */
interface SkillRegistryFace {
  snapshot(options: { cwd?: string; signal?: AbortSignal; scope?: unknown }): Promise<{
    skills: readonly {
      name: string
      description?: string
      whenToUse?: string
      provider: string
      source?: string
      path?: string
      resourceBase?: { kind: 'directory'; path: string } | { kind: 'url'; url: string } | { kind: 'opaque'; description: string }
      invocation: { modelInvocable: boolean; userInvocable: boolean }
    }[]
    complete: boolean
  }>
}

function text(value: unknown, limit: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.replace(/\s+/g, ' ').trim()
  // Cut by code point, not by UTF-16 unit, so a limit landing inside a
  // surrogate pair cannot leave a lone half behind.
  const points = [...trimmed]
  return points.length > limit ? `${points.slice(0, limit - 1).join('')}…` : trimmed
}

/** Show conventional skill roots; abbreviate verified workspace/home ancestors. */
export function skillDirectory(directory: string, cwd?: string, home = homedir()): string {
  const root = directory.match(/^(.*?[\\/](?:\.agents|\.dsh)[\\/]skills)(?:[\\/]|$)/)
  directory = root?.[1] ?? directory
  const paths = win32.isAbsolute(directory) && !posix.isAbsolute(directory) ? win32 : posix
  const inside = (base: string): string | undefined => {
    if (!paths.isAbsolute(base)) return undefined
    const relative = paths.relative(base, directory)
    if (relative === '..' || relative.startsWith(`..${paths.sep}`) || paths.isAbsolute(relative)) return undefined
    return relative.split(paths.sep).join('/')
  }
  if (cwd !== undefined) {
    const relative = inside(cwd)
    if (relative !== undefined) return relative || '.'
  }
  const relative = inside(home)
  return relative !== undefined ? (relative === '' ? '~' : `~/${relative}`) : directory
}

/**
 * The directory as the folder action receives it: carried verbatim (a path
 * may legitimately hold runs of spaces), but only in a shape the wire codec
 * and the Host's opener can take.
 */
function validPath(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && value.length <= 4096 && !/[\u0000-\u001f]/.test(value)
}

/** A live Agent, structurally: its Session header and its own context. */
export interface SkillReadAgent {
  readonly session: { readonly header: { readonly cwd?: string } }
}

/** The Host services a cold read needs — structural, all optional across host versions. */
interface SessionObservationFace extends Disposable {
  readonly header: { readonly cwd?: string }
  readonly projections?: { readonly values: { readonly workingDirectory?: string | null; readonly agentPreset?: string | null } }
}
interface SkillReadHost {
  agents?: { get(sessionId: string): SkillReadAgent | undefined }
  sessionQuery?: { observeSession(sessionId: string): Promise<SessionObservationFace> }
  agentPresets?: {
    serviceFor(agent: SkillReadAgent, name: 'skills'): SkillRegistryFace | undefined
    acquireScope(id?: string): Promise<{ key: unknown } & AsyncDisposable>
  }
  workingDirectory?: { defaultDirectory?: string }
}

/** Where one Session's skill view comes from, read without resuming it. */
interface SkillView {
  readonly registry: SkillRegistryFace
  readonly cwd: string | undefined
  readonly scope: unknown
  readonly release?: () => Promise<void>
}

function optional<T>(ctx: Context, name: string): T | undefined {
  try {
    return (ctx as unknown as { get(name: string): T | undefined }).get(name)
  } catch {
    return undefined
  }
}

async function resolveView(ctx: Context, sessionId: string): Promise<SkillView | string> {
  const host: SkillReadHost = {
    agents: optional(ctx, 'agents'),
    sessionQuery: optional(ctx, 'sessionQuery'),
    agentPresets: optional(ctx, 'agentPresets'),
    workingDirectory: optional(ctx, 'workingDirectory'),
  }
  const root = (ctx as unknown as { skills?: SkillRegistryFace }).skills
  const live = host.agents?.get(sessionId)
  if (live !== undefined) {
    const registry = host.agentPresets?.serviceFor(live, 'skills') ?? root
    if (registry === undefined) return 'the skill registry is not mounted'
    // New hosts separate the execution directory from the original project.
    // Reading the committed value keeps this listing read-only.
    const directory = ctx.reflect?.get('workingDirectory') as { get(session: SkillReadAgent['session']): string } | undefined
    return { registry, cwd: directory ? directory.get(live.session) : live.session.header.cwd, scope: live }
  }
  if (host.sessionQuery === undefined) return 'this host cannot read the skills of an inactive session; open the session first'
  let cwd: string | undefined
  let agentPreset: string | undefined
  let observation: SessionObservationFace
  try {
    observation = await host.sessionQuery.observeSession(sessionId)
  } catch (error) {
    if ((error as { code?: unknown } | null | undefined)?.code === 'SESSION_QUERY_SESSION_NOT_FOUND') return `session "${sessionId}" not found`
    throw error
  }
  try {
    cwd = observation.projections?.values.workingDirectory ?? observation.header.cwd ?? host.workingDirectory?.defaultDirectory
    agentPreset = observation.projections?.values.agentPreset ?? undefined
  } finally {
    observation[Symbol.dispose]()
  }
  if (root === undefined) return 'the skill registry is not mounted'
  // An unknown or unusable recorded preset falls back to the global registry.
  let lease: ({ key: unknown } & AsyncDisposable) | undefined
  try {
    lease = await host.agentPresets?.acquireScope(agentPreset)
  } catch {
    lease = undefined
  }
  const held = lease
  return {
    registry: root, cwd, scope: held?.key,
    ...(held === undefined ? {} : { release: async () => { await held[Symbol.asyncDispose]() } }),
  }
}

/**
 * Read the merged skill list one Session's scope chain selects.
 * @param ctx - the plugin context carrying the skill registry and optional Host services.
 * @param sessionId - the Session from the `sessionId` wire field.
 * @param signal - caller lifetime; discovery races it.
 * @returns the reduced list, whether it is complete, and any failure reason.
 */
export async function readSkills(
  ctx: Context,
  sessionId: string,
  signal: AbortSignal,
): Promise<MarketSkillsResult> {
  let view: SkillView | string
  try {
    view = await resolveView(ctx, sessionId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { skills: [], complete: false, error: message === '' ? 'unknown error' : message }
  }
  if (typeof view === 'string') return { skills: [], complete: false, error: view }
  const { registry, cwd, scope } = view
  try {
    const observation = await registry.snapshot({ cwd, signal, scope })
    const skills: MarketSkill[] = observation.skills.map(entry => ({
      name: text(entry.name, 120),
      description: text(entry.description, 400),
      whenToUse: text(entry.whenToUse, 400),
      provider: text(entry.provider, 60),
      ...(entry.source === undefined ? {} : { source: text(entry.source, 60) }),
      ...(validPath(entry.path) ? { instructionPath: entry.path } : {}),
      ...(entry.resourceBase?.kind === 'directory'
        ? {
            sourceDirectory: skillDirectory(entry.resourceBase.path, cwd),
            ...(validPath(entry.resourceBase.path) ? { sourcePath: entry.resourceBase.path } : {}),
          }
        : {}),
      modelInvocable: entry.invocation.modelInvocable,
      userInvocable: entry.invocation.userInvocable,
    }))
    skills.sort((a, b) => a.name.localeCompare(b.name))
    return { skills, ...(cwd === undefined ? {} : { cwd }), complete: observation.complete, error: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { skills: [], complete: false, error: message === '' ? 'unknown error' : message }
  } finally {
    await view.release?.().catch(() => undefined)
  }
}
