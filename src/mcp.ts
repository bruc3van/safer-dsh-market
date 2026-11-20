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
 * Read-only by construction: nothing here writes the profile or the Loader.
 * Static rows are masked before they leave the Host — only env and header
 * NAMES travel, and a secret-looking argument or URL query value is replaced.
 * @module dsh-market-pro/mcp
 */
import type { Context } from '@deepseek-ai/cordis'
import type { McpHostContext, McpToolGroup, McpUnmanagedServer } from './contract.ts'
import {
  MCP_CLIENT_PACKAGE, MCP_MANAGER_PACKAGE, isSecretField, isSecretUrl, maskArg, maskUrl, secretArgIndexes,
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

/** The manager's own list read, structurally. */
interface ManagerFace { list?(): readonly { readonly name: string }[] }

/** Upper bounds, so one runaway server cannot balloon the wire. */
const MAX_TOOLS = 2000
const MAX_DESCRIPTION = 280

const str = (value: unknown): string => typeof value === 'string' ? value : ''
const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : String(item)) : []
const record = (value: unknown): Record<string, string> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
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
  }
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
  const get = <T>(name: string): T | undefined => {
    try {
      return (ctx as unknown as { get(name: string): T | undefined }).get(name)
    } catch {
      return undefined
    }
  }
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
