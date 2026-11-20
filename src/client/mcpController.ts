/**
 * The MCP page's I/O: one store over the three official Remotes and this
 * market's own Host read.
 *
 * - `remote.mcpManager.watch` streams the live server list; `restart` and
 *   `probe` are its recovery verbs. It has no write method by design.
 * - `remote.settings` reads and writes the manager's `servers` namespace —
 *   the only write path, validated by the manager and revision-checked.
 * - `remote.credentials` describes and stores `${credential:REF}` values;
 *   no read path ever returns a value.
 * - `remote.dshMarketPro.inspectMcp` names the manager's namespace and lists
 *   static rows and live tools the manager cannot see.
 *
 * The stream runs only while a page is attached, so a closed market holds no
 * Host stream open.
 * @module dsh-market-pro/client/mcpController
 */
import type { McpHostContext } from '../contract.ts'
import {
  buildRows, entryRefs, pendingToStore, saveOps, serversOf,
  type McpCredentialInfo, type McpDraft, type McpRow, type McpServerView, type McpSettingsOp, type McpSettingsView,
} from './mcpModel.ts'

type Reply<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }

/** The probe outcome, as `mcpManager.probe` returns it. */
export type McpProbeResult =
  | {
    readonly ok: true; readonly serverInfo?: { readonly name: string; readonly version: string }
    readonly toolNames: readonly string[]; readonly truncated: boolean; readonly durationMs: number
    readonly closeConfirmed: boolean; readonly cleanupError?: string
  }
  | {
    readonly ok: false; readonly stage: 'connect' | 'list'; readonly message: string; readonly durationMs: number
    readonly closeConfirmed: boolean; readonly cleanupError?: string
  }

/** `ctx.remote.mcpManager`, structurally. */
export interface McpManagerFace {
  watch(signal?: AbortSignal): AsyncIterable<readonly McpServerView[]> & { dispose?(): void }
  restart(name: string): Promise<Reply<void>>
  probe(name: string, signal?: AbortSignal): Promise<Reply<McpProbeResult>>
}

/** `ctx.remote.settings`, structurally (the subset this page uses). */
export interface McpSettingsFace {
  describe(): Promise<Reply<{ writable: boolean; namespaces: readonly McpSettingsView[] }>>
  mutate(ns: string, ops: McpSettingsOp[], expectedRevision?: number): Promise<Reply<McpSettingsView>>
}

/** `ctx.remote.credentials`, structurally. */
export interface McpCredentialsFace {
  describe(refs: string[]): Promise<Reply<Record<string, McpCredentialInfo>>>
  set(ref: string, value: string): Promise<Reply<void>>
}

/** One row of the official plugin manager's `listPlugins` (the subset this page reads). */
export interface McpPluginRow {
  readonly entryId: string
  readonly moduleName: string
  readonly enabled: boolean
  readonly readOnlyReason?: 'management-required' | 'unaddressable'
}

/** The official plugin manager's entry-level outcome (the subset this page reads). */
export interface McpPluginChange {
  readonly changed: boolean
  readonly application: 'failed' | 'cancelled' | 'applied' | 'restart-required' | 'overridden'
  readonly error?: { readonly code: string; readonly diagnostic?: string }
}

/**
 * `ctx.remote.pluginManager`, structurally: the official way to switch one
 * profile Loader entry. It owns the patch-layer rules (edit the last matching
 * override, drop an override equal to the composition) and the live reload,
 * so this page never writes the profile itself.
 */
export interface McpPluginsFace {
  listPlugins(): Promise<Reply<readonly McpPluginRow[]>>
  setPluginEnabled(id: string, enabled: boolean): Promise<Reply<McpPluginChange>>
}

/** Where the controller finds each Remote; every getter may answer undefined. */
export interface McpHosts {
  manager(): McpManagerFace | undefined
  settings(): McpSettingsFace | undefined
  credentials(): McpCredentialsFace | undefined
  plugins?(): McpPluginsFace | undefined
  inspect(): Promise<McpHostContext>
}

/** Whether, and why not, one static row can be switched through the plugin manager. */
export type McpStaticToggle =
  | { readonly available: true }
  | { readonly available: false; readonly reason: 'management-required' | 'unaddressable' | 'unlisted' }

/** One card's in-flight probe. */
export type McpProbeState =
  | { readonly status: 'running' }
  | { readonly status: 'done'; readonly result: McpProbeResult }
  | { readonly status: 'error'; readonly message: string }

/**
 * What the page can do here.
 * - `full`: manager present, Settings writable.
 * - `readonly`: manager present, writes refused (a non-owner peer, a read-only profile, no Settings namespace).
 * - `legacy`: this runtime has no manager; only static rows can be shown.
 * - `error`: the Host read itself failed — not a verdict on the runtime's version.
 */
export type McpMode = 'loading' | 'error' | 'full' | 'readonly' | 'legacy'

/** The page's whole state. */
export interface McpSnapshot {
  readonly mode: McpMode
  readonly host: McpHostContext | null
  readonly hostError: string
  readonly views: readonly McpServerView[] | null
  readonly watchError: string
  readonly settings: McpSettingsView | null
  readonly settingsError: string
  readonly rows: readonly McpRow[]
  readonly credentials: Readonly<Record<string, McpCredentialInfo>>
  /** Row name → the verb in flight. */
  readonly busy: Readonly<Record<string, string>>
  /** Row name → the last verb's failure. */
  readonly errors: Readonly<Record<string, string>>
  readonly probes: Readonly<Record<string, McpProbeState>>
  /** Row key → a non-failure outcome worth saying (`restart-required`). */
  readonly notices: Readonly<Record<string, string>>
  /**
   * Static row Loader id → its plugin-manager switch; null while unread or
   * when this Host exposes no plugin manager.
   */
  readonly staticToggles: Readonly<Record<string, McpStaticToggle>> | null
}

/** What a save reports back to the editor. */
export type McpSaveOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly conflict: boolean }

/** The controller's face. */
export interface McpController {
  getSnapshot(): McpSnapshot
  subscribe(listener: () => void): () => void
  /** Start the stream and the reads for one visible page; the disposer stops them when the last page leaves. */
  attach(): () => void
  refresh(): Promise<void>
  /** Restart the stream after a carrier reset. */
  reset(): void
  setEnabled(name: string, enabled: boolean): Promise<void>
  /** Drop the user-layer entry: removes a user server, restores an inherited one. */
  remove(name: string): Promise<void>
  restart(name: string): Promise<void>
  probe(name: string): Promise<void>
  save(draft: McpDraft, original: string | undefined): Promise<McpSaveOutcome>
  /** Store one credential value; resolves to an error message, or '' on success. */
  setCredential(ref: string, value: string): Promise<string>
  /** Switch one static `dsh-mcp-client` row through the official plugin manager. */
  setStaticEnabled(loaderId: string, enabled: boolean): Promise<void>
  /** Re-read the Host facts after a plugin change elsewhere; a no-op while no page is attached. */
  invalidate(): void
  /** A Settings document changed elsewhere (`settings/document-updated`). */
  settingsChanged(): void
  /** A credential reference changed (`credentials/reference-updated`). */
  credentialsChanged(): void
}

/** The busy/error/notice key of one static row. */
export const staticKey = (loaderId: string): string => `static:${loaderId}`

const initial: McpSnapshot = {
  mode: 'loading', host: null, hostError: '', views: null, watchError: '', settings: null, settingsError: '',
  rows: [], credentials: {}, busy: {}, errors: {}, probes: {}, notices: {}, staticToggles: null,
}

/** Credential descriptions travel in batches of at most this many references. */
const CREDENTIAL_BATCH = 64

const message = (error: unknown): string => error instanceof Error ? error.message : String(error)
const failure = (reply: { error: { code: string; message: string } }): string => `${reply.error.code}: ${reply.error.message}`

/** Optional timer seams, for tests. */
export interface McpControllerOptions {
  readonly wait?: (ms: number) => Promise<void>
  readonly debounceMs?: number
}

/** Create the controller over the given Remotes. */
export function createMcpController(hosts: McpHosts, options: McpControllerOptions = {}): McpController {
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms) }))
  const debounceMs = options.debounceMs ?? 300
  let state = initial
  let writable = false
  const listeners = new Set<() => void>()
  let attached = 0
  let watchGeneration = 0
  let watchAbort: AbortController | undefined
  let settingsTimer: ReturnType<typeof setTimeout> | undefined
  let inspectTimer: ReturnType<typeof setTimeout> | undefined
  let lastShape = ''
  let lastTools = -1
  let watching = false
  // Read sequences: a response is applied only if no newer read or write
  // started after it, so a slow describe cannot roll back a fresh revision.
  let settingsSeq = 0
  let hostSeq = 0

  const set = (patch: Partial<McpSnapshot>): void => {
    const next = { ...state, ...patch }
    const rows = 'views' in patch || 'settings' in patch ? buildRows(next.views, next.settings) : next.rows
    state = { ...next, rows, mode: modeOf(next) }
    for (const listener of [...listeners]) listener()
  }

  const modeOf = (next: McpSnapshot): McpMode => {
    if (next.host === null) return next.hostError === '' ? 'loading' : 'error'
    if (next.host.managerEntry === null) return 'legacy'
    return writable && next.settings !== null && hosts.settings() !== undefined ? 'full' : 'readonly'
  }

  const patchRecord = <K extends 'busy' | 'errors' | 'probes' | 'notices'>(key: K, name: string, value: McpSnapshot[K][string] | undefined): void => {
    const { [name]: _dropped, ...rest } = state[key] as Record<string, unknown>
    set({ [key]: value === undefined ? rest : { ...rest, [name]: value } } as Partial<McpSnapshot>)
  }

  const loadCredentials = async (): Promise<void> => {
    const remote = hosts.credentials()
    const refs = [...new Set(Object.values(serversOf(state.settings?.value)).flatMap(entryRefs))]
    if (remote === undefined || refs.length === 0) return
    const described: Record<string, McpCredentialInfo> = {}
    for (let start = 0; start < refs.length; start += CREDENTIAL_BATCH) {
      try {
        const reply = await remote.describe(refs.slice(start, start + CREDENTIAL_BATCH))
        if (reply.ok) Object.assign(described, reply.value)
      } catch {
        // A credential read is decoration on the card; the server list stands without it.
      }
    }
    set({ credentials: { ...state.credentials, ...described } })
  }

  const loadSettings = async (): Promise<void> => {
    const ns = state.host?.managerEntry
    const remote = hosts.settings()
    if (ns === null || ns === undefined) return
    if (remote === undefined) {
      writable = false
      set({ settingsError: 'settings-unavailable' })
      return
    }
    const seq = ++settingsSeq
    try {
      const reply = await remote.describe()
      if (seq !== settingsSeq) return
      if (!reply.ok) {
        writable = false
        set({ settingsError: failure(reply) })
        return
      }
      writable = reply.value.writable
      const view = reply.value.namespaces.find(candidate => candidate.ns === ns) ?? null
      set({ settings: view, settingsError: view === null ? 'namespace-missing' : '' })
      await loadCredentials()
    } catch (error) {
      if (seq === settingsSeq) set({ settingsError: message(error) })
    }
  }

  /** Which static rows the official plugin manager can address, and why not the rest. */
  const loadToggles = async (): Promise<void> => {
    const remote = hosts.plugins?.()
    const unmanaged = state.host?.unmanaged ?? []
    if (remote === undefined || unmanaged.length === 0) {
      set({ staticToggles: null })
      return
    }
    const seq = hostSeq
    try {
      const reply = await remote.listPlugins()
      if (seq !== hostSeq) return
      if (!reply.ok) {
        set({ staticToggles: null })
        return
      }
      const byId = new Map(reply.value.map(row => [row.entryId, row]))
      set({
        staticToggles: Object.fromEntries(unmanaged.map((server): [string, McpStaticToggle] => {
          const row = byId.get(server.loaderId)
          if (row === undefined) return [server.loaderId, { available: false, reason: 'unlisted' }]
          return [server.loaderId, row.readOnlyReason === undefined
            ? { available: true } : { available: false, reason: row.readOnlyReason }]
        })),
      })
    } catch {
      // The switch is an extra; without the plugin manager the row stays read-only.
      set({ staticToggles: null })
    }
  }

  const loadHost = async (): Promise<void> => {
    const seq = ++hostSeq
    try {
      const host = await hosts.inspect()
      if (seq !== hostSeq) return
      set({ host, hostError: '' })
    } catch (error) {
      if (seq === hostSeq) set({ hostError: message(error) })
      return
    }
    await loadToggles()
  }

  const schedule = (which: 'settings' | 'inspect'): void => {
    if (which === 'settings') {
      clearTimeout(settingsTimer)
      settingsTimer = setTimeout(() => { void loadSettings() }, debounceMs)
    } else {
      clearTimeout(inspectTimer)
      inspectTimer = setTimeout(() => { void loadHost() }, debounceMs * 2)
    }
  }

  /**
   * A watch frame. The stream pushes on every status change; Settings is
   * re-read only when the set of entries or their lifecycle shape moved (an
   * external edit shows up as exactly that), and the tool view only when the
   * connected tool counts changed.
   */
  const onViews = (views: readonly McpServerView[]): void => {
    set({ views, watchError: '' })
    const shape = views.map(view => `${view.name}:${String(view.configured)}:${view.status.state === 'disabled' ? 'off' : 'on'}`).join('|')
    if (shape !== lastShape) {
      if (lastShape !== '') schedule('settings')
      lastShape = shape
    }
    const tools = views.reduce((sum, view) => sum + (view.status.state === 'connected' ? view.status.toolCount : 0), 0)
    if (tools !== lastTools) {
      if (lastTools !== -1) schedule('inspect')
      lastTools = tools
    }
  }

  const runWatch = async (generation: number): Promise<void> => {
    watching = true
    try {
      await watchLoop(generation)
    } finally {
      if (generation === watchGeneration) watching = false
    }
  }

  const watchLoop = async (generation: number): Promise<void> => {
    let backoff = 1_000
    while (attached > 0 && generation === watchGeneration) {
      const manager = hosts.manager()
      if (manager === undefined) {
        set({ watchError: 'manager-unavailable' })
        return
      }
      const abort = new AbortController()
      watchAbort = abort
      try {
        for await (const views of manager.watch(abort.signal)) {
          if (generation !== watchGeneration) return
          onViews(views)
          backoff = 1_000
        }
      } catch (error) {
        if (abort.signal.aborted || generation !== watchGeneration) return
        set({ watchError: message(error) })
      }
      if (generation !== watchGeneration) return
      await wait(backoff)
      backoff = Math.min(backoff * 2, 15_000)
    }
  }

  const stopWatch = (): void => {
    watchGeneration += 1
    watching = false
    watchAbort?.abort()
    watchAbort = undefined
  }

  const startWatch = (): void => {
    stopWatch()
    if (state.host?.managerEntry === null || state.host?.managerEntry === undefined) return
    lastShape = ''
    lastTools = -1
    void runWatch(watchGeneration)
  }

  /** Start the stream unless one is already running; safe to call after every read. */
  const ensureWatch = (): void => {
    if (attached > 0 && !watching && state.host !== null && state.host.managerEntry !== null) startWatch()
  }

  /**
   * Re-read everything, then make sure the stream runs: a first Host read
   * that failed (say, before this market's Remote mounted) recovers on the
   * next refresh instead of leaving the page without a live list.
   */
  const refresh = async (): Promise<void> => {
    await loadHost()
    await loadSettings()
    ensureWatch()
  }

  const mutate = async (ops: McpSettingsOp[]): Promise<McpSaveOutcome> => {
    const remote = hosts.settings()
    const view = state.settings
    if (remote === undefined || view === null) return { ok: false, message: 'settings-unavailable', conflict: false }
    // A write supersedes any read in flight or scheduled: its reply is newer.
    clearTimeout(settingsTimer)
    const seq = ++settingsSeq
    const reply = await remote.mutate(view.ns, ops, view.revision)
    if (!reply.ok) {
      const conflict = /conflict/i.test(reply.error.code)
      if (conflict) await loadSettings()
      return { ok: false, message: failure(reply), conflict }
    }
    if (seq === settingsSeq) set({ settings: reply.value })
    void loadCredentials()
    return { ok: true }
  }

  /** Run one row verb with its busy flag and error seat. */
  const verb = async (name: string, label: string, run: () => Promise<string>): Promise<void> => {
    if (state.busy[name] !== undefined) return
    patchRecord('busy', name, label)
    patchRecord('errors', name, undefined)
    try {
      const error = await run()
      if (error !== '') patchRecord('errors', name, error)
    } catch (error) {
      patchRecord('errors', name, message(error))
    } finally {
      patchRecord('busy', name, undefined)
    }
  }

  const outcomeError = (outcome: McpSaveOutcome): string => outcome.ok ? '' : outcome.message

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    attach() {
      attached += 1
      if (attached === 1) void refresh()
      let live = true
      return () => {
        if (!live) return
        live = false
        attached -= 1
        if (attached === 0) {
          stopWatch()
          clearTimeout(settingsTimer)
          clearTimeout(inspectTimer)
        }
      }
    },
    refresh,
    reset() {
      if (attached === 0) return
      // The carrier was lost: the old stream is gone with it.
      stopWatch()
      void refresh()
    },
    setEnabled: (name, enabled) => verb(name, enabled ? 'enable' : 'disable',
      async () => outcomeError(await mutate([{ op: 'set', path: ['servers', name, 'enabled'], value: enabled }]))),
    remove: name => verb(name, 'remove', async () => outcomeError(await mutate([{ op: 'unset', path: ['servers', name] }]))),
    restart: name => verb(name, 'restart', async () => {
      const manager = hosts.manager()
      if (manager === undefined) return 'manager-unavailable'
      const reply = await manager.restart(name)
      return reply.ok ? '' : failure(reply)
    }),
    async probe(name) {
      const manager = hosts.manager()
      if (manager === undefined || state.probes[name]?.status === 'running') return
      patchRecord('probes', name, { status: 'running' })
      try {
        const reply = await manager.probe(name)
        patchRecord('probes', name, reply.ok ? { status: 'done', result: reply.value } : { status: 'error', message: failure(reply) })
      } catch (error) {
        patchRecord('probes', name, { status: 'error', message: message(error) })
      }
    },
    async save(draft, original) {
      // Secrets first: an entry that names a credential the store does not
      // hold would land straight in `waiting-credentials`. If a store fails,
      // nothing is written and the draft stays open.
      const secrets = pendingToStore(draft)
      if (secrets.length > 0) {
        const remote = hosts.credentials()
        if (remote === undefined) return { ok: false, message: 'credentials-unavailable', conflict: false }
        for (const secret of secrets) {
          try {
            const reply = await remote.set(secret.ref, secret.value)
            if (!reply.ok) return { ok: false, message: failure(reply), conflict: false }
          } catch (error) {
            return { ok: false, message: message(error), conflict: false }
          }
        }
      }
      try {
        return await mutate(saveOps(draft, original))
      } catch (error) {
        return { ok: false, message: message(error), conflict: false }
      }
    },
    async setStaticEnabled(loaderId, enabled) {
      const key = staticKey(loaderId)
      const server = state.host?.unmanaged.find(item => item.loaderId === loaderId)
      await verb(key, enabled ? 'enable' : 'disable', async () => {
        const remote = hosts.plugins?.()
        if (remote === undefined || server === undefined) return 'plugins-unavailable'
        // Two servers with one name cannot both load: refuse to start a
        // static row over a managed entry that is switched on.
        if (enabled && state.rows.some(row => row.name === server.serverName && row.entry?.enabled !== false)) return 'name-conflict'
        patchRecord('notices', key, undefined)
        const reply = await remote.setPluginEnabled(loaderId, enabled)
        await loadHost()
        if (!reply.ok) return failure(reply)
        const outcome = reply.value
        switch (outcome.application) {
          case 'applied': return ''
          case 'restart-required':
            patchRecord('notices', key, 'restart-required')
            return ''
          case 'overridden': return 'overridden'
          default:
            return outcome.error === undefined ? outcome.application
              : `${outcome.error.code}${outcome.error.diagnostic === undefined ? '' : `: ${outcome.error.diagnostic}`}`
        }
      })
    },
    invalidate() {
      if (attached > 0) void refresh()
    },
    settingsChanged() {
      if (attached > 0) schedule('settings')
    },
    credentialsChanged() {
      if (attached > 0) void loadCredentials()
    },
    async setCredential(ref, value) {
      const remote = hosts.credentials()
      if (remote === undefined) return 'credentials-unavailable'
      try {
        const reply = await remote.set(ref, value)
        if (!reply.ok) return failure(reply)
        await loadCredentials()
        return ''
      } catch (error) {
        return message(error)
      }
    },
  }
}
