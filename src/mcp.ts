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
import { findFeaturedMcpById, mcpIdentityKey, pickAvailableServerName } from './mcpFeatured.ts'
import {
  CREDENTIAL_REF_PATTERN, MCP_CLIENT_PACKAGE, MCP_MANAGER_PACKAGE, SERVER_NAME_PATTERN, credentialRefsIn,
  credentialTemplate, isExactCredentialTemplate, isSecretField, isSecretUrl, looksSecretValue, malformedTemplate,
  maskArg, maskUrl, secretArgIndexes, suggestRef,
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
interface ManagerFace {
  list?(): readonly {
    readonly name: string
    readonly configured?: boolean
    readonly status?: { readonly state?: string; readonly toolCount?: number }
  }[]
}

interface SettingsFace {
  readonly writable?: boolean
  describe?(): readonly { readonly ns: string; readonly revision: number; readonly value?: unknown }[]
  mutate(
    ns: string,
    ops: readonly { readonly op: 'set'; readonly path: readonly string[]; readonly value: unknown }[],
    expectedRevision?: number,
  ): Promise<void>
}

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

/** One managed MCP server summary exposed safely to Host-side Agent tools (no secret values). */
export interface ManagedMcpSummary {
  readonly name: string
  readonly transport: 'stdio' | 'streamable-http' | 'unknown'
  readonly target: string
  readonly enabled: boolean
  readonly state: string
  readonly toolCount: number
  readonly credentialRefs: readonly string[]
  readonly identityKey: string
  readonly registeredOnly?: boolean
  readonly retained?: boolean
}

/** Complete masked inventory of managed and static MCP servers in this profile. */
export interface ManagedMcpInspection {
  readonly managerEntry: string | null
  readonly managerActive: boolean
  readonly settingsWritable: boolean
  readonly managed: readonly ManagedMcpSummary[]
  readonly unmanaged: readonly McpUnmanagedServer[]
  readonly tools: readonly McpToolGroup[]
  readonly takenNames: readonly string[]
}

/** Input for installing a curated MCP server into the official DSH manager. */
export interface FeaturedMcpInstallInput {
  readonly kind: 'featured'
  readonly featuredId: string
  readonly name?: string
  /** Non-secret input values (e.g. `dir` for filesystem). Plaintext secrets are rejected. */
  readonly inputs?: Readonly<Record<string, string>>
  /** Optional explicit credential reference names for secret inputs. */
  readonly credentialRefs?: Readonly<Record<string, string>>
  readonly enabled?: boolean
}

/** Input for installing a custom MCP server into the official DSH manager. */
export interface CustomMcpInstallInput {
  readonly kind: 'custom'
  readonly name: string
  readonly transport: 'stdio' | 'streamable-http'
  readonly command?: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly cwd?: string
  readonly url?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly enabled?: boolean
}

export type ManagedMcpInstallInput = FeaturedMcpInstallInput | CustomMcpInstallInput

/** Validated, secret-free installation plan ready for user approval and Settings write. */
export interface ManagedMcpInstallPlan {
  readonly name: string
  readonly source: 'featured' | 'custom'
  readonly featuredId?: string
  readonly featuredTitle?: string
  readonly transport: 'stdio' | 'streamable-http'
  readonly entry: Readonly<Record<string, unknown>>
  readonly preview: string
  readonly enabled: boolean
  readonly credentialRefs: readonly string[]
  readonly risks: readonly ('fetch' | 'shell')[]
}

/** Outcome of writing a managed MCP server to Settings. */
export interface ManagedMcpInstallResult {
  readonly name: string
  readonly source: 'featured' | 'custom'
  readonly featuredId?: string
  readonly transport: 'stdio' | 'streamable-http'
  readonly preview: string
  readonly enabled: boolean
  readonly credentialRefs: readonly string[]
  readonly configuredCredentials: readonly string[]
  readonly missingCredentials: readonly string[]
}

const NEEDS_SHELL_QUOTES = /[\s"']/

function formatMaskedCommand(command: string, args: readonly string[]): string {
  const secret = new Set(secretArgIndexes(args))
  return [command, ...args.map((arg, index) => secret.has(index) ? maskArg(arg) : arg)]
    .filter(part => part !== '')
    .map(part => NEEDS_SHELL_QUOTES.test(part) ? JSON.stringify(part) : part)
    .join(' ')
}

function detectCommandRisks(command: string, args: readonly string[]): ('fetch' | 'shell')[] {
  const all = [command, ...args]
  const words = all.map(word => word.replace(/^.*[\\/]/, '').replace(/\.(?:exe|cmd|bat)$/i, '').toLowerCase())
  const risks: ('fetch' | 'shell')[] = []
  if (words.some(word => ['npx', 'bunx', 'uvx', 'pipx'].includes(word))
    || (words.includes('pnpm') && words.includes('dlx'))) risks.push('fetch')
  const shell = words.findIndex(word => ['cmd', 'sh', 'bash', 'zsh', 'powershell', 'pwsh'].includes(word))
  if (shell >= 0 && all.slice(shell + 1).some(arg => /^(?:\/c|\/k|-c|-command|-encodedcommand)$/i.test(arg))) risks.push('shell')
  return risks
}

function readManagerSettings(ctx: Context, managerEntry: string | null): {
  readonly settings: SettingsFace | undefined
  readonly namespacePresent: boolean
  readonly writable: boolean
  readonly revision: number | undefined
  readonly servers: Readonly<Record<string, Record<string, unknown>>>
} {
  const settings = ctx.settings as SettingsFace | undefined
  if (settings === undefined || managerEntry === null) {
    return { settings, namespacePresent: false, writable: false, revision: undefined, servers: {} }
  }
  const writable = settings.writable !== false && typeof settings.mutate === 'function'
  try {
    const descriptor = settings.describe?.().find(item => item.ns === managerEntry)
    if (descriptor === undefined) {
      return { settings, namespacePresent: false, writable: false, revision: undefined, servers: {} }
    }
    const rawServers = descriptor.value !== null && typeof descriptor.value === 'object' && !Array.isArray(descriptor.value)
      ? (descriptor.value as { readonly servers?: unknown }).servers
      : undefined
    const servers: Record<string, Record<string, unknown>> = {}
    if (rawServers !== null && typeof rawServers === 'object' && !Array.isArray(rawServers)) {
      for (const [key, item] of Object.entries(rawServers as Record<string, unknown>)) {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          servers[key] = item as Record<string, unknown>
        }
      }
    }
    return { settings, namespacePresent: true, writable, revision: descriptor.revision, servers }
  } catch {
    return { settings, namespacePresent: false, writable: false, revision: undefined, servers: {} }
  }
}

function refsOfServerEntry(entry: Record<string, unknown>): string[] {
  const texts = [
    str(entry.command),
    ...strings(entry.args),
    ...Object.values(record(entry.env)),
    str(entry.cwd),
    str(entry.url),
    ...Object.values(record(entry.headers)),
  ]
  return [...new Set(texts.flatMap(value => credentialRefsIn(value)))]
}

/**
 * Inspect both managed and static MCP servers on the Host without exposing any
 * secret values. Used by Agent-facing MCP discovery and install tools.
 */
export function inspectManagedMcp(ctx: Context, entries: Iterable<McpLoaderEntry>): ManagedMcpInspection {
  const list = [...entries]
  const base = inspectMcpContext(ctx, list)
  const settingsInfo = readManagerSettings(ctx, base.managerEntry)
  let runtimeViews: readonly {
    readonly name: string
    readonly configured?: boolean
    readonly status?: { readonly state?: string; readonly toolCount?: number }
  }[] = []
  try {
    runtimeViews = serviceOf<ManagerFace>(ctx, 'mcpManager')?.list?.() ?? []
  } catch {
    runtimeViews = []
  }
  const viewByName = new Map(runtimeViews.map(view => [view.name, view]))
  const toolsByServer = new Map(base.tools.map(group => [group.server, group.tools.length]))
  const managed: ManagedMcpSummary[] = []
  for (const [name, entry] of Object.entries(settingsInfo.servers)) {
    const transport = entry.transport === 'stdio' || entry.transport === 'streamable-http' ? entry.transport : 'unknown'
    const command = str(entry.command)
    const args = strings(entry.args)
    const url = str(entry.url)
    const view = viewByName.get(name)
    const state = view?.status?.state ?? (entry.enabled === false ? 'disabled' : 'unknown')
    const toolCount = typeof view?.status?.toolCount === 'number'
      ? view.status.toolCount
      : (toolsByServer.get(name) ?? 0)
    managed.push({
      name,
      transport,
      target: transport === 'stdio' ? formatMaskedCommand(command, args) : maskUrl(url),
      enabled: entry.enabled !== false,
      state,
      toolCount,
      credentialRefs: refsOfServerEntry(entry),
      identityKey: mcpIdentityKey({ transport, command, args, url }),
    })
  }
  for (const view of runtimeViews) {
    if (Object.hasOwn(settingsInfo.servers, view.name)) continue
    const state = view.status?.state ?? 'unknown'
    const toolCount = typeof view.status?.toolCount === 'number'
      ? view.status.toolCount
      : (toolsByServer.get(view.name) ?? 0)
    const retained = view.configured === false
    managed.push({
      name: view.name,
      transport: 'unknown',
      target: '',
      enabled: !retained && state !== 'disabled',
      state,
      toolCount,
      credentialRefs: [],
      identityKey: '',
      ...(retained ? { retained: true } : { registeredOnly: true }),
    })
  }
  const takenNames = [...new Set([
    ...managed.map(item => item.name),
    ...base.unmanaged.map(server => server.serverName).filter(name => name !== ''),
  ])]
  return {
    managerEntry: base.managerEntry,
    managerActive: base.managerActive,
    settingsWritable: settingsInfo.writable,
    managed,
    unmanaged: base.unmanaged,
    tools: base.tools,
    takenNames,
  }
}

const CREDENTIAL_TOKEN_GLOBAL = /\$\{credential:[A-Za-z_][A-Za-z0-9_]*\}/g
const CREDENTIAL_TOKEN_PREFIX = /^\$\{credential:[A-Za-z_][A-Za-z0-9_]*\}/
const AUTH_SCHEME_PREFIX = /^(?:Bearer|Basic|token)\s+/i
const SECRET_ARG_FLAG = /^--?[\w-]*(?:key|token|secret|password|passwd|auth|credential)[\w-]*$/i
const SECRET_URL_QUERY = /[?&][^=&#]*(?:key|token|secret|password|auth)[^=&#]*=([^&#]+)/gi
const URL_USERINFO = /^https?:\/\/([^/?#]+)@/i

function stripCredentialTokens(value: string): string {
  return value.replace(CREDENTIAL_TOKEN_GLOBAL, '').trim()
}

/** Reject both pure plaintext secrets and mixed `plaintext + ${credential:REF}` smuggling. */
function hasPlaintextSecretField(name: string, value: string): boolean {
  if (isSecretField(name, value)) return true
  if (credentialRefsIn(value).length === 0) return false
  const withoutScheme = value.trim().replace(AUTH_SCHEME_PREFIX, '')
  const remainder = stripCredentialTokens(withoutScheme)
  if (remainder === '') return false
  return isSecretField(name, remainder) || looksSecretValue(remainder)
}

/** Reject plaintext or mixed-template secret args (inline, flag-following, or opaque token). */
function firstPlaintextSecretArgIndex(args: readonly string[]): number {
  const direct = secretArgIndexes(args)
  if (direct.length > 0) return direct[0]!
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
    if (credentialRefsIn(arg).length === 0) continue
    const eq = arg.indexOf('=')
    if (arg.startsWith('-') && eq > 0 && SECRET_ARG_FLAG.test(arg.slice(0, eq))) {
      if (stripCredentialTokens(arg.slice(eq + 1)) !== '') return index
    }
    if (index > 0 && SECRET_ARG_FLAG.test(args[index - 1]!) && !arg.startsWith('-')) {
      if (stripCredentialTokens(arg) !== '') return index
    }
    const remainder = stripCredentialTokens(arg)
    if (remainder !== '' && looksSecretValue(remainder)) return index
  }
  return -1
}

/** Reject plaintext or mixed-template secrets in URL query parameters or userinfo (`user:pass@`). */
function hasPlaintextSecretUrl(url: string): boolean {
  if (isSecretUrl(url)) return true
  for (const match of url.matchAll(SECRET_URL_QUERY)) {
    if (stripCredentialTokens(match[1]!) !== '') return true
  }
  const userinfoMatch = URL_USERINFO.exec(url)
  if (userinfoMatch !== null) {
    const userinfo = userinfoMatch[1]!
    const colon = userinfo.indexOf(':')
    const secretPart = colon >= 0 ? userinfo.slice(colon + 1) : userinfo
    if (stripCredentialTokens(secretPart) !== '') return true
  }
  return false
}

/**
 * Validate and build a secret-free installation plan before asking the user for
 * approval. Plaintext secrets are refused everywhere: credentials must be
 * passed as `${credential:REF}` templates so secret values never traverse the
 * model context or Settings file.
 */
export function buildManagedMcpInstallPlan(
  input: ManagedMcpInstallInput,
  takenNames: ReadonlySet<string>,
  takenRefs: ReadonlySet<string> = new Set(),
): ManagedMcpInstallPlan {
  if (input.kind === 'featured') {
    const featured = findFeaturedMcpById(input.featuredId)
    if (featured === undefined) throw new Error(`unknown curated MCP server "${input.featuredId}"`)
    const name = input.name !== undefined && input.name.trim() !== ''
      ? input.name.trim()
      : pickAvailableServerName(featured.id, takenNames)
    if (!SERVER_NAME_PATTERN.test(name)) {
      throw new Error('server name must use 1-32 letters, digits, _ or -')
    }
    if (takenNames.has(name)) {
      throw new Error(`server name "${name}" is already in use`)
    }
    const providedInputs = input.inputs ?? {}
    const providedRefs = input.credentialRefs ?? {}
    const args = [...(featured.args ?? [])]
    const env: Record<string, string> = { ...(featured.env ?? {}) }
    const headers: Record<string, string> = { ...(featured.headers ?? {}) }
    const refsUsed = new Set<string>(takenRefs)
    const credentialRefs: string[] = []

    for (const field of featured.inputs) {
      const rawValue = (providedInputs[field.key] ?? '').trim()
      const explicitRef = (providedRefs[field.key] ?? '').trim()
      if (field.secret) {
        if (rawValue !== '') {
          if (malformedTemplate(rawValue) !== undefined || !isExactCredentialTemplate(rawValue)) {
            throw new Error(`secret input "${field.key}" must never be passed in plaintext; omit it to auto-bind a credential template, pass credentialRefs.${field.key}, or pass an exact \${credential:REF} token`)
          }
          for (const ref of credentialRefsIn(rawValue)) {
            refsUsed.add(ref)
            if (!credentialRefs.includes(ref)) credentialRefs.push(ref)
          }
          if (field.where === 'env') env[field.key] = rawValue
          else if (field.where === 'header') {
            const fmt = field.format && field.format.includes('{}') ? field.format : '{}'
            headers[field.key] = fmt.replace('{}', rawValue)
          } else if (field.flag) {
            args.push(field.flag, rawValue)
          } else {
            args.push(rawValue)
          }
          continue
        }
        if (explicitRef !== '') {
          if (!CREDENTIAL_REF_PATTERN.test(explicitRef)) {
            throw new Error(`invalid credential ref "${explicitRef}" for "${field.key}" (use letters, digits, and _)`)
          }
          refsUsed.add(explicitRef)
          if (!credentialRefs.includes(explicitRef)) credentialRefs.push(explicitRef)
          const template = credentialTemplate(explicitRef)
          if (field.where === 'env') env[field.key] = template
          else if (field.where === 'header') {
            const fmt = field.format && field.format.includes('{}') ? field.format : '{}'
            headers[field.key] = fmt.replace('{}', template)
          } else if (field.flag) {
            args.push(field.flag, template)
          } else {
            args.push(template)
          }
          continue
        }
        if (field.required) {
          const autoRef = suggestRef(name, field.key, refsUsed)
          refsUsed.add(autoRef)
          credentialRefs.push(autoRef)
          const template = credentialTemplate(autoRef)
          if (field.where === 'env') env[field.key] = template
          else if (field.where === 'header') {
            const fmt = field.format && field.format.includes('{}') ? field.format : '{}'
            headers[field.key] = fmt.replace('{}', template)
          } else if (field.flag) {
            args.push(field.flag, template)
          } else {
            args.push(template)
          }
        }
        continue
      }

      if (rawValue === '') {
        if (field.required) throw new Error(`required input "${field.key}" is missing for "${featured.id}"`)
        continue
      }
      if (malformedTemplate(rawValue) !== undefined) {
        throw new Error(`input "${field.key}" contains a malformed credential template`)
      }
      if (hasPlaintextSecretField(field.key, rawValue)) {
        throw new Error(`input "${field.key}" looks like a plaintext secret; use \${credential:REF} instead`)
      }
      for (const ref of credentialRefsIn(rawValue)) {
        if (!credentialRefs.includes(ref)) credentialRefs.push(ref)
      }
      if (field.where === 'env') env[field.key] = rawValue
      else if (field.where === 'header') {
        const fmt = field.format && field.format.includes('{}') ? field.format : '{}'
        headers[field.key] = fmt.replace('{}', rawValue)
      } else if (field.flag) {
        args.push(field.flag, rawValue)
      } else {
        args.push(rawValue)
      }
    }

    const enabled = input.enabled !== false
    const entry: Record<string, unknown> = featured.transport === 'stdio'
      ? {
          transport: 'stdio',
          command: featured.command ?? '',
          ...(args.length > 0 ? { args } : {}),
          ...(Object.keys(env).length > 0 ? { env } : {}),
          enabled,
        }
      : {
          transport: 'streamable-http',
          url: featured.url ?? '',
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
          enabled,
        }
    return {
      name,
      source: 'featured',
      featuredId: featured.id,
      featuredTitle: featured.title,
      transport: featured.transport,
      entry,
      preview: featured.transport === 'stdio'
        ? formatMaskedCommand(featured.command ?? '', args)
        : maskUrl(featured.url ?? ''),
      enabled,
      credentialRefs,
      risks: featured.transport === 'stdio' ? detectCommandRisks(featured.command ?? '', args) : [],
    }
  }

  const name = input.name.trim()
  if (!SERVER_NAME_PATTERN.test(name)) {
    throw new Error('server name must use 1-32 letters, digits, _ or -')
  }
  if (takenNames.has(name)) {
    throw new Error(`server name "${name}" is already in use`)
  }
  const enabled = input.enabled !== false
  if (input.transport === 'stdio') {
    const command = (input.command ?? '').trim()
    if (command === '') throw new Error('command is required for stdio MCP servers')
    const args = [...(input.args ?? [])]
    const envEntries = Object.entries(input.env ?? {}).map(([k, v]): [string, string] => [k.trim(), v])
    if (envEntries.some(([k]) => k === '')) throw new Error('env variable names cannot be empty')
    const cwd = (input.cwd ?? '').trim()
    for (const [value, where] of [
      [command, 'command'],
      ...args.map((arg, index): [string, string] => [arg, `args[${index}]`]),
      ...envEntries.map(([k, v]): [string, string] => [v, `env.${k}`]),
      [cwd, 'cwd'],
    ]) {
      const bad = malformedTemplate(value)
      if (bad !== undefined) throw new Error(`${where} contains a malformed credential template (${bad})`)
    }
    const secretArg = firstPlaintextSecretArgIndex(args)
    if (secretArg >= 0) {
      throw new Error(`plaintext secret detected in args[${secretArg}]; use \${credential:REF} instead`)
    }
    for (const [k, v] of envEntries) {
      if (hasPlaintextSecretField(k, v)) {
        throw new Error(`plaintext secret detected in env.${k}; use \${credential:REF} instead`)
      }
    }
    const env = Object.fromEntries(envEntries)
    const entry: Record<string, unknown> = {
      transport: 'stdio',
      command,
      ...(args.length > 0 ? { args } : {}),
      ...(envEntries.length > 0 ? { env } : {}),
      ...(cwd !== '' ? { cwd } : {}),
      enabled,
    }
    return {
      name,
      source: 'custom',
      transport: 'stdio',
      entry,
      preview: formatMaskedCommand(command, args),
      enabled,
      credentialRefs: refsOfServerEntry(entry),
      risks: detectCommandRisks(command, args),
    }
  }

  const url = (input.url ?? '').trim()
  if (url === '') throw new Error('url is required for streamable-http MCP servers')
  const badUrl = malformedTemplate(url)
  if (badUrl !== undefined) throw new Error(`url contains a malformed credential template (${badUrl})`)
  if (!/^https?:\/\//i.test(url) && !CREDENTIAL_TOKEN_PREFIX.test(url)) {
    throw new Error('url must start with http:// or https://')
  }
  if (hasPlaintextSecretUrl(url)) {
    throw new Error('plaintext secret detected in url; use ${credential:REF} instead')
  }
  const headerEntries = Object.entries(input.headers ?? {}).map(([k, v]): [string, string] => [k.trim(), v])
  if (headerEntries.some(([k]) => k === '')) throw new Error('header names cannot be empty')
  for (const [k, v] of headerEntries) {
    const bad = malformedTemplate(v)
    if (bad !== undefined) throw new Error(`headers.${k} contains a malformed credential template (${bad})`)
    if (hasPlaintextSecretField(k, v)) {
      throw new Error(`plaintext secret detected in headers.${k}; use \${credential:REF} instead`)
    }
  }
  const headers = Object.fromEntries(headerEntries)
  const entry: Record<string, unknown> = {
    transport: 'streamable-http',
    url,
    ...(headerEntries.length > 0 ? { headers } : {}),
    enabled,
  }
  return {
    name,
    source: 'custom',
    transport: 'streamable-http',
    entry,
    preview: maskUrl(url),
    enabled,
    credentialRefs: refsOfServerEntry(entry),
    risks: [],
  }
}

/**
 * Commit a validated install plan to the official `dsh-mcp-manager` Settings
 * namespace using revision-checked `settings.mutate`, then inspect referenced
 * credentials so the caller can guide the user if any secret still needs to be
 * filled in the UI.
 */
export async function installManagedMcp(
  ctx: Context,
  entries: Iterable<McpLoaderEntry>,
  plan: ManagedMcpInstallPlan,
): Promise<ManagedMcpInstallResult> {
  const list = [...entries]
  const manager = list.find(item => item.options.name === MCP_MANAGER_PACKAGE)
  if (manager === undefined) throw new Error('manager-unavailable: this DSH runtime has no dsh-mcp-manager')
  const settingsInfo = readManagerSettings(ctx, manager.options.id)
  if (settingsInfo.settings === undefined || typeof settingsInfo.settings.mutate !== 'function') {
    throw new Error('settings-unavailable: Host Settings service is unavailable')
  }
  if (!settingsInfo.namespacePresent) {
    throw new Error('namespace-missing: dsh-mcp-manager Settings namespace is unavailable')
  }
  if (!settingsInfo.writable) {
    throw new Error('settings-readonly: Settings are read-only in this profile')
  }
  const inspection = inspectManagedMcp(ctx, list)
  if (inspection.takenNames.includes(plan.name)) {
    throw new Error(`name-taken: MCP server "${plan.name}" already exists`)
  }
  await settingsInfo.settings.mutate(
    manager.options.id,
    [{ op: 'set', path: ['servers', plan.name], value: plan.entry }],
    settingsInfo.revision,
  )
  const configuredCredentials: string[] = []
  const missingCredentials: string[] = []
  const credentials = serviceOf<CredentialsFace>(ctx, 'credentials')
  for (const ref of plan.credentialRefs) {
    if (credentials === undefined) {
      missingCredentials.push(ref)
      continue
    }
    try {
      const info = await credentials.describe(ref)
      if (info.configured) configuredCredentials.push(ref)
      else missingCredentials.push(ref)
    } catch {
      missingCredentials.push(ref)
    }
  }
  return {
    name: plan.name,
    source: plan.source,
    ...(plan.featuredId !== undefined ? { featuredId: plan.featuredId } : {}),
    transport: plan.transport,
    preview: plan.preview,
    enabled: plan.enabled,
    credentialRefs: plan.credentialRefs,
    configuredCredentials,
    missingCredentials,
  }
}

/** Toggle one managed MCP server on or off through revision-checked Settings mutation. */
export async function setManagedMcpEnabled(
  ctx: Context,
  entries: Iterable<McpLoaderEntry>,
  name: string,
  enabled: boolean,
): Promise<{ readonly name: string; readonly enabled: boolean }> {
  const target = name.trim()
  if (!SERVER_NAME_PATTERN.test(target)) throw new Error('invalid MCP server name')
  const list = [...entries]
  const manager = list.find(item => item.options.name === MCP_MANAGER_PACKAGE)
  if (manager === undefined) throw new Error('manager-unavailable: this DSH runtime has no dsh-mcp-manager')
  const settingsInfo = readManagerSettings(ctx, manager.options.id)
  if (settingsInfo.settings === undefined || typeof settingsInfo.settings.mutate !== 'function') {
    throw new Error('settings-unavailable: Host Settings service is unavailable')
  }
  if (!settingsInfo.namespacePresent) {
    throw new Error('namespace-missing: dsh-mcp-manager Settings namespace is unavailable')
  }
  if (!settingsInfo.writable) {
    throw new Error('settings-readonly: Settings are read-only in this profile')
  }
  if (!Object.hasOwn(settingsInfo.servers, target)) {
    throw new Error(`not-found: managed MCP server "${target}" does not exist`)
  }
  await settingsInfo.settings.mutate(
    manager.options.id,
    [{ op: 'set', path: ['servers', target, 'enabled'], value: enabled }],
    settingsInfo.revision,
  )
  return { name: target, enabled }
}
