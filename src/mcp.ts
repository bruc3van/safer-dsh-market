/**
 * The Host half of the MCP page: the facts the official `mcpManager` and
 * Settings Remotes cannot answer.
 *
 * - **Which entry the manager is.** Settings names a namespace after the
 *   Loader entry id, so the browser learns that id here instead of guessing.
 * - **Unmanaged servers.** A `dsh-mcp-client` row composed straight into the
 *   profile (a bundle, a tool that edits `cordis.patch.yml`) is invisible to
 *   the manager; listing it here keeps the page from reading "no servers"
 *   on a machine that runs several.
 * - **Live tools.** The global tool view, grouped by server namespace.
 *
 * The scan never writes: it touches neither the profile nor the Loader.
 * Static rows are masked before they leave the Host — only env and header
 * NAMES travel, and a secret-looking argument or URL query value is replaced.
 *
 * The one write is {@link adoptMcp}: it moves a static row under the manager
 * by storing its plaintext secrets in the credential store and writing the
 * templated entry through Settings, both on this side of the wire, so the
 * values still never reach the browser. Switching the static row off stays
 * with the official plugin manager, which the browser calls next.
 * @module dsh-market-pro/mcp
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import type { McpAdoptBlocker, McpAdoptResult, McpHostContext, McpToolGroup, McpUnmanagedServer } from './contract.ts'
import {
  MCP_CLIENT_PACKAGE, MCP_MANAGER_PACKAGE, SERVER_NAME_PATTERN, credentialRefsIn, credentialTemplate, isSecretField,
  isSecretUrl, maskArg, maskUrl, secretArgIndexes, suggestRef,
} from './mcpShapes.ts'

const FIBER_PHASE = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading'] as const

/** The Loader entry fields this scan reads, structurally. */
export interface McpLoaderEntry {
  readonly id: string
  readonly disabled: boolean
  readonly options: { readonly id: string; readonly name: string; readonly config?: unknown }
  readonly fiber?: { readonly state: number }
}

/** The tool registry's global read, structurally. */
interface ToolsFace { definitions(): readonly { readonly name: string; readonly description?: unknown }[] }

/** The credential store, structurally (the subset adoption uses). */
interface CredentialsFace {
  describe(ref: string): Promise<{ readonly configured: boolean }>
  resolve?(ref: string): Promise<{ readonly value: string } | undefined>
  set(ref: string, value: string): Promise<void>
}

/** The manager's own list read, structurally. */
interface ManagerFace { list?(): readonly { readonly name: string }[] }

/** Upper bounds, so one runaway server cannot balloon the wire. */
const MAX_TOOLS = 2000
const MAX_DESCRIPTION = 280

/** A Loader `!!js` node, as the raw entry options keep it. */
const isJsExpr = (value: unknown): value is { readonly __jsExpr: unknown } =>
  value !== null && typeof value === 'object' && '__jsExpr' in value

const str = (value: unknown): string => typeof value === 'string' ? value : ''
const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : String(item)) : []
const record = (value: unknown): Record<string, string> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || isJsExpr(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, str(item)]))
}

/** Reduce one static `dsh-mcp-client` row to its masked, wire-safe view. */
export function unmanagedOf(entry: McpLoaderEntry): McpUnmanagedServer {
  const config = (entry.options.config ?? {}) as Record<string, unknown>
  const transport = config.transport === 'stdio' || config.transport === 'streamable-http' ? config.transport : 'unknown'
  const args = strings(config.args)
  const env = record(config.env)
  const headers = record(config.headers)
  const url = str(config.url)
  const secretArgs = secretArgIndexes(args)
  const plaintext = [
    ...secretArgs.map(index => `args[${index}]`),
    ...Object.entries(env).filter(([key, value]) => isSecretField(key, value)).map(([key]) => `env.${key}`),
    ...Object.entries(headers).filter(([key, value]) => isSecretField(key, value)).map(([key]) => `headers.${key}`),
    ...(isSecretUrl(url) ? ['url'] : []),
  ]
  return {
    entryId: entry.options.id,
    loaderId: entry.id,
    serverName: str(config.serverName),
    transport,
    command: str(config.command),
    args: args.map((arg, index) => secretArgs.includes(index) ? maskArg(arg) : arg),
    envKeys: Object.keys(env),
    url: maskUrl(url),
    headerKeys: Object.keys(headers),
    enabled: !entry.disabled,
    phase: entry.fiber === undefined ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
    plaintextSecrets: plaintext,
    adoptBlocker: adoptBlockerOf(entry.options.config),
  }
}

/** `process.env.NAME` and nothing else: the one expression a credential reference can stand in for. */
const ENV_EXPR = /^\s*process\.env\.([A-Za-z_][A-Za-z0-9_]*)\s*$/

/**
 * One string field of a static row: plain text, or an environment read the
 * local credential provider answers the same way (it falls back to the
 * launch environment). Any other expression cannot be carried over.
 */
function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (isJsExpr(value)) {
    const match = ENV_EXPR.exec(String(value.__jsExpr))
    return match === null ? null : credentialTemplate(match[1]!)
  }
  return null
}

/** One plaintext value the adoption moves into the credential store. */
export interface McpAdoptSecret {
  /** What the credential reference is named after (`api-key`, `GITHUB_TOKEN`, …). */
  readonly label: string
  readonly value: string
}

/** A static row, translated into a manager entry whose secrets await their references. */
export interface McpAdoptPlan {
  readonly name: string
  readonly secrets: readonly McpAdoptSecret[]
  /** Fields the manager does not accept, by config path; they are left behind. */
  readonly dropped: readonly string[]
  /** The entry, with secret `i` replaced by the template of `refs[i]`. */
  build(refs: readonly string[]): Record<string, unknown>
}

const CARRIED_NUMBERS = ['startupTimeoutMs', 'toolCallTimeoutMs', 'closeTimeoutMs'] as const
const RECONNECT_KEYS: readonly string[] = ['enabled', 'initialDelayMs', 'maxDelayMs', 'maxAttempts']
/** Read by the client row itself, never part of a manager entry; dropped without a note. */
const ROW_ONLY = ['serverName', 'expandTemplates']
const KNOWN_FIELDS = new Set([...ROW_ONLY, 'transport', 'command', 'args', 'env', 'cwd', 'url', 'headers', ...CARRIED_NUMBERS, 'reconnect'])
const URL_SECRET = /([?&]([^=&#]*(?:key|token|secret|password|auth)[^=&#]*)=)([^&#]+)/gi
/** Stands in for secret `i` until its reference is known; NUL never appears in a config string. */
const slotOf = (index: number): string => `\u0000${index}\u0000`
const SLOT = /\u0000(\d+)\u0000/g

/**
 * Translate one static `dsh-mcp-client` config into a manager entry.
 *
 * Every plaintext secret the scan would mask becomes a credential slot; a
 * `process.env.NAME` expression becomes `${credential:NAME}`; any other
 * expression, an unknown transport or an illegal server name blocks it.
 */
export function adoptionPlan(config: unknown): McpAdoptPlan | { readonly blocker: Exclude<McpAdoptBlocker, ''> } {
  const raw = config !== null && typeof config === 'object' && !Array.isArray(config) ? config as Record<string, unknown> : {}
  const name = typeof raw.serverName === 'string' ? raw.serverName : ''
  if (!SERVER_NAME_PATTERN.test(name)) return { blocker: 'name' }
  if (raw.transport !== 'stdio' && raw.transport !== 'streamable-http') return { blocker: 'transport' }
  const secrets: McpAdoptSecret[] = []
  const slot = (label: string, value: string): string => {
    secrets.push({ label, value })
    return slotOf(secrets.length - 1)
  }
  let blocked = false
  const text = (value: unknown): string => {
    if (value === undefined || value === null) return ''
    const result = textOf(value)
    if (result === null) blocked = true
    return result ?? ''
  }
  const pairs = (value: unknown): [string, string][] => {
    if (isJsExpr(value)) { blocked = true; return [] }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
    return Object.entries(value as Record<string, unknown>).map(([key, item]): [string, string] => [key, text(item)])
  }
  const secretPair = ([key, value]: [string, string]): [string, string] => {
    if (!isSecretField(key, value)) return [key, value]
    const scheme = /^(Bearer|Basic|token)\s+(.+)$/i.exec(value)
    return [key, scheme !== null ? `${scheme[1]} ${slot(key, scheme[2]!)}` : slot(key, value)]
  }
  const entry: Record<string, unknown> = { transport: raw.transport }
  if (raw.transport === 'stdio') {
    entry.command = text(raw.command)
    let args: string[] = []
    if (isJsExpr(raw.args)) blocked = true
    else if (Array.isArray(raw.args)) args = raw.args.map(text)
    const secretArgs = new Set(secretArgIndexes(args))
    entry.args = args.map((arg, index) => {
      if (!secretArgs.has(index)) return arg
      const eq = arg.indexOf('=')
      if (arg.startsWith('-') && eq > 0) return `${arg.slice(0, eq + 1)}${slot(arg.slice(0, eq), arg.slice(eq + 1))}`
      const flag = args[index - 1] ?? ''
      return slot(flag.startsWith('-') ? flag : 'TOKEN', arg)
    })
    entry.env = Object.fromEntries(pairs(raw.env).map(secretPair))
    const cwd = text(raw.cwd)
    if (cwd !== '') entry.cwd = cwd
  } else {
    entry.url = text(raw.url).replace(URL_SECRET, (whole, prefix: string, param: string, value: string) => {
      if (credentialRefsIn(value).length > 0) return whole
      return `${prefix}${slot(param, value)}`
    })
    entry.headers = Object.fromEntries(pairs(raw.headers).map(secretPair))
  }
  for (const field of CARRIED_NUMBERS) {
    if (isJsExpr(raw[field])) blocked = true
    else if (typeof raw[field] === 'number') entry[field] = raw[field]
  }
  const dropped = Object.keys(raw).filter(key => !KNOWN_FIELDS.has(key))
  if (isJsExpr(raw.reconnect)) blocked = true
  else if (raw.reconnect !== null && typeof raw.reconnect === 'object' && !Array.isArray(raw.reconnect)) {
    const reconnect: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(raw.reconnect as Record<string, unknown>)) {
      if (isJsExpr(value)) blocked = true
      else if (RECONNECT_KEYS.includes(key)) reconnect[key] = value
      else dropped.push(`reconnect.${key}`)
    }
    if (Object.keys(reconnect).length > 0) entry.reconnect = reconnect
  }
  if (blocked) return { blocker: 'expression' }
  return {
    name,
    secrets,
    dropped,
    build(refs) {
      const fill = (value: unknown): unknown => typeof value === 'string'
        ? value.replace(SLOT, (_whole, index: string) => credentialTemplate(refs[Number(index)]!))
        : Array.isArray(value) ? value.map(fill)
          : value !== null && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, fill(item)]))
            : value
      return fill(entry) as Record<string, unknown>
    },
  }
}

/** Why one static config cannot be adopted, or `''`. */
export function adoptBlockerOf(config: unknown): McpAdoptBlocker {
  const plan = adoptionPlan(config)
  return 'blocker' in plan ? plan.blocker : ''
}

/** An optional service, or undefined when this runtime does not mount it. */
function serviceOf<T>(ctx: Context, name: string): T | undefined {
  try {
    return (ctx as unknown as { get(name: string): T | undefined }).get(name)
  } catch {
    return undefined
  }
}

/**
 * Move one static row under the manager.
 *
 * Secrets go to the credential store first — each under a fresh reference,
 * or an existing one that already holds the same value — then the templated
 * entry is written switched off, so it never races the static row for its
 * server name; the browser turns it on once the static row has stopped. A
 * failure before the write leaves Settings untouched.
 * @param loaderId - the static row's full Loader identity.
 * @throws Error when the row is unknown or blocked, the name is taken, or a store refuses.
 */
export async function adoptMcp(ctx: Context, entries: Iterable<McpLoaderEntry>, loaderId: string): Promise<McpAdoptResult> {
  const list = [...entries]
  const entry = list.find(item => item.id === loaderId && item.options.name === MCP_CLIENT_PACKAGE)
  if (entry === undefined) throw new Error('not-found')
  const manager = list.find(item => item.options.name === MCP_MANAGER_PACKAGE)
  if (manager === undefined) throw new Error('manager-unavailable')
  const plan = adoptionPlan(entry.options.config)
  if ('blocker' in plan) throw new Error(`blocked-${plan.blocker}`)
  const settings = ctx.settings as {
    readonly writable?: boolean
    describe?(): readonly { readonly ns: string; readonly revision: number; readonly value?: unknown }[]
    mutate(ns: string, ops: readonly { readonly op: 'set'; readonly path: readonly string[]; readonly value: unknown }[], expectedRevision?: number): Promise<void>
  } | undefined
  if (settings === undefined || typeof settings.mutate !== 'function') throw new Error('settings-unavailable')
  if (settings.writable === false) throw new Error('settings-readonly')
  let expectedRevision: number | undefined
  let configuredNames: string[] = []
  try {
    const descriptor = settings.describe?.().find(item => item.ns === manager.options.id)
    if (descriptor !== undefined) {
      expectedRevision = descriptor.revision
      const servers = descriptor.value !== null && typeof descriptor.value === 'object' && !Array.isArray(descriptor.value)
        ? (descriptor.value as { readonly servers?: unknown }).servers
        : undefined
      if (servers !== null && typeof servers === 'object' && !Array.isArray(servers)) {
        configuredNames = Object.keys(servers as Record<string, unknown>)
      }
    }
  } catch {
    configuredNames = []
  }
  let managed: readonly { readonly name: string }[] = []
  try {
    managed = serviceOf<ManagerFace>(ctx, 'mcpManager')?.list?.() ?? []
  } catch {
    managed = []
  }
  if (managed.some(view => view.name === plan.name) || configuredNames.includes(plan.name)) throw new Error('name-taken')
  const refs: string[] = []
  const stored: string[] = []
  const reused: string[] = []
  if (plan.secrets.length > 0) {
    const credentials = serviceOf<CredentialsFace>(ctx, 'credentials')
    if (credentials === undefined) throw new Error('credentials-unavailable')
    const taken = new Set<string>()
    for (const secret of plan.secrets) {
      let ref = suggestRef(plan.name, secret.label, taken)
      for (;;) {
        taken.add(ref)
        if (!(await credentials.describe(ref)).configured) {
          await credentials.set(ref, secret.value)
          stored.push(ref)
          break
        }
        if ((await credentials.resolve?.(ref))?.value === secret.value) {
          reused.push(ref)
          break
        }
        ref = suggestRef(plan.name, secret.label, taken)
      }
      refs.push(ref)
    }
  }
  await settings.mutate(manager.options.id, [{ op: 'set', path: ['servers', plan.name], value: { ...plan.build(refs), enabled: false } }], expectedRevision)
  return { name: plan.name, stored, reused, dropped: plan.dropped }
}

/**
 * Group `mcp__<server>__<tool>` names under their server. A known server name
 * wins by longest prefix (server names may themselves contain `__`); anything
 * else splits at the first separator.
 */
export function groupTools(definitions: readonly { readonly name: string; readonly description?: unknown }[], known: readonly string[]): McpToolGroup[] {
  const groups = new Map<string, { name: string; description: string }[]>()
  const byLength = [...known].sort((a, b) => b.length - a.length)
  let total = 0
  for (const definition of definitions) {
    if (typeof definition.name !== 'string' || !definition.name.startsWith('mcp__')) continue
    if (total++ >= MAX_TOOLS) break
    const rest = definition.name.slice(5)
    const server = byLength.find(name => rest.startsWith(`${name}__`)) ?? rest.split('__')[0]!
    const description = str(definition.description).replace(/\s+/g, ' ').trim()
    const list = groups.get(server) ?? []
    list.push({
      name: definition.name,
      description: description.length > MAX_DESCRIPTION ? `${description.slice(0, MAX_DESCRIPTION - 1)}…` : description,
    })
    groups.set(server, list)
  }
  return [...groups].map(([server, tools]) => ({ server, tools }))
}

/**
 * Read the MCP facts this Host holds.
 * @param ctx - the plugin context (the tool registry is reached optionally).
 * @param entries - the live Loader entries.
 */
export function inspectMcpContext(ctx: Context, entries: Iterable<McpLoaderEntry>): McpHostContext {
  let managerEntry: string | null = null
  let managerActive = false
  const unmanaged: McpUnmanagedServer[] = []
  for (const entry of entries) {
    if (entry.options.name === MCP_MANAGER_PACKAGE && managerEntry === null) {
      managerEntry = entry.options.id
      managerActive = !entry.disabled && entry.fiber !== undefined && FIBER_PHASE[entry.fiber.state] === 'active'
    } else if (entry.options.name === MCP_CLIENT_PACKAGE) {
      unmanaged.push(unmanagedOf(entry))
    }
  }
  let tools: McpToolGroup[] = []
  let toolsError = ''
  const get = <T>(name: string): T | undefined => serviceOf<T>(ctx, name)
  let managedNames: string[] = []
  try {
    managedNames = get<ManagerFace>('mcpManager')?.list?.().map(view => view.name) ?? []
  } catch {
    managedNames = []
  }
  try {
    const registry = get<ToolsFace>('tools')
    if (registry !== undefined && typeof registry.definitions === 'function') {
      tools = groupTools(registry.definitions(), [...managedNames, ...unmanaged.map(server => server.serverName)])
    } else {
      toolsError = 'the tool registry is not mounted'
    }
  } catch (error) {
    toolsError = error instanceof Error ? error.message : String(error)
  }
  return { managerEntry, managerActive, unmanaged, tools, toolsError }
}
