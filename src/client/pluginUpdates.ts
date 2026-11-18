/** Update discovery and replacement use the official Host's package identities and decisions. */
import type {
  BundleInfo, MarketIndexSummary, MarketQuery, MarketSearchResult, PluginInstallRequestId,
  PluginUpdateProgress, PluginUpdateResult, PluginVersionList, Registry,
} from '@deepseek-ai/dsh-api-remotes/client'

type Reply<T> = { ok: true; value: T } | { ok: false; error: { message: string } }
export interface UpdateHost {
  listBundles(): Promise<Reply<readonly Pick<BundleInfo, 'name' | 'version' | 'installed' | 'update'>[]>>
  listVersions(name: string, options: object): Promise<Reply<PluginVersionList>>
  updateBundle(name: string, version: string, options: { registry?: Registry; spec?: string; requestId: PluginInstallRequestId }): Promise<Reply<PluginUpdateResult>>
}
export interface UpdateMarketHost {
  listIndexes(): Promise<Reply<readonly MarketIndexSummary[]>>
  search(url: string, query: MarketQuery): Promise<Reply<MarketSearchResult>>
}
export interface UpdateChoice {
  version: string
  prerelease: boolean
  deprecated?: string
  blocked?: string
  source: { registry: Registry } | { spec: string; index: string }
}
export interface UpdateState {
  phase: 'idle' | 'checking' | 'ready' | 'updating' | 'done' | 'error' | 'unknown'
  packageName: string
  installed: string
  kind?: 'registry' | 'git'
  choices: readonly UpdateChoice[]
  selected: string
  message: string
  warnings: readonly string[]
  omitted: number
  step?: PluginUpdateProgress['step']
  result?: PluginUpdateResult
  /** Every settled update invalidates installed facts, including a failed update with restoration. */
  revision: number
  /** Newest compatible stable version detected per installed package name. */
  available: Readonly<Record<string, string>>
}

function requirementsText(requirements: Readonly<Record<string, string>>): string {
  return Object.entries(requirements).map(([name, range]) => `${name === 'engines.dsh' ? 'DSH' : name} ${range}`).join(', ')
}

function defaultCandidate(choices: readonly UpdateChoice[]): string {
  return choices.find(version => !version.blocked && !version.prerelease && version.deprecated === undefined)?.version ?? ''
}

async function gitUpdateChoices(
  indexes: UpdateMarketHost,
  sources: readonly MarketIndexSummary[],
  packageName: string,
  isCurrent: () => boolean,
): Promise<{ choices: UpdateChoice[]; warnings: string[] }> {
  const warnings: string[] = []
  let fallback: UpdateChoice[] = []
  for (const source of sources) {
    let offset: number | null = 0
    let fetchedAt: number | undefined
    while (offset !== null) {
      const answer = await indexes.search(source.url, { text: packageName, sort: { kind: 'index' }, offset, limit: 100,
        ...(fetchedAt === undefined ? { refresh: true } : { fetchedAt }) })
      if (!isCurrent()) return { choices: [], warnings: [] }
      if (!answer.ok) { warnings.push(`${source.url}: ${answer.error.message}`); break }
      const page = answer.value
      const entry = page.entries.find(item => item.name === packageName)
      if (entry) {
        const choices = entry.versions.filter(version => version.update).map(version => ({
          version: version.version, prerelease: version.version.split('+')[0]!.includes('-'),
          ...(!version.compatibility.compatible && !version.compatibility.exempted
            ? { blocked: requirementsText(version.compatibility.requirements) || 'Incompatible with this DSH host.' } : {}),
          source: { spec: version.install.spec, index: source.url },
        }))
        if (defaultCandidate(choices)) return { choices, warnings }
        // Keep the first compatible prerelease in source order, or the first
        // blocked list for diagnostics when no compatible version exists.
        if (choices.length && (!fallback.length ||
          (!fallback.some(choice => !choice.blocked) && choices.some(choice => !choice.blocked)))) {
          fallback = choices
        }
        break
      }
      offset = page.nextOffset
      fetchedAt = page.fetchedAt
    }
  }
  return { choices: fallback, warnings }
}

function withAvailable(current: Readonly<Record<string, string>>, packageName: string, version: string): Readonly<Record<string, string>> {
  const clean = version.replace(/^v/i, '')
  if (clean !== '') return current[packageName] === clean ? current : { ...current, [packageName]: clean }
  if (!(packageName in current)) return current
  const { [packageName]: _removed, ...rest } = current
  return rest
}

/** One shared operation survives switching between the market's three entry points. */
export function createPluginUpdater(host: () => UpdateHost | undefined, market: () => UpdateMarketHost | undefined) {
  let state: UpdateState = { phase: 'idle', packageName: '', installed: '', choices: [], selected: '', message: '', warnings: [], omitted: 0, revision: 0, available: {} }
  let generation = 0
  let probeSeq = 0
  let requestId: PluginInstallRequestId | undefined
  const listeners = new Set<() => void>()
  const set = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    async probe(packageNames?: readonly string[]) {
      const api = host()
      if (!api?.listVersions || !api.updateBundle) return
      const currentProbe = ++probeSeq
      try {
        const inventory = await api.listBundles()
        if (currentProbe !== probeSeq || !inventory.ok) return
        const wanted = packageNames === undefined ? undefined : new Set(packageNames)
        const targets = inventory.value.filter(item => item.installed && item.update !== undefined && (wanted === undefined || wanted.has(item.name)))
        const indexes = market()
        let gitSources: readonly MarketIndexSummary[] | undefined
        for (const bundle of targets) {
          if (currentProbe !== probeSeq) return
          if (bundle.update === 'registry') {
            const answer = await api.listVersions(bundle.name, {})
            if (currentProbe !== probeSeq) return
            if (!answer.ok || answer.value.status === 'refused') continue
            const candidate = answer.value.versions.find(version =>
              version.bundle && version.incompatible === undefined && !version.prerelease && version.deprecated === undefined)
            set({ available: withAvailable(state.available, bundle.name, candidate?.version ?? '') })
          } else if (bundle.update === 'git' && indexes) {
            if (gitSources === undefined) {
              const listed = await indexes.listIndexes()
              if (currentProbe !== probeSeq) return
              gitSources = listed.ok ? listed.value : []
            }
            const { choices } = await gitUpdateChoices(indexes, gitSources, bundle.name, () => currentProbe === probeSeq)
            if (currentProbe !== probeSeq) return
            set({ available: withAvailable(state.available, bundle.name, defaultCandidate(choices)) })
          }
        }
      } catch {
        // Silent background probe: errors surface only when the user opens the update dialog.
      }
    },
    async check(packageName: string) {
      if (state.phase === 'updating') return
      const current = ++generation
      set({ phase: 'checking', packageName, installed: '', kind: undefined, choices: [], selected: '', message: '', warnings: [], omitted: 0, result: undefined, step: undefined })
      try {
        const api = host()
        if (!api?.listVersions || !api.updateBundle) throw new Error('The Host does not provide plugin updates. Upgrade DSH to 0.2.2-rc.3 or later.')
        const inventory = await api.listBundles()
        if (current !== generation) return
        if (!inventory.ok) throw new Error(inventory.error.message)
        const bundle = inventory.value.find(item => item.name === packageName && item.installed)
        if (!bundle?.update) throw new Error('The official manager does not allow this installation to be updated. Built-in, local and unpinned Git copies may require their original installer.')
        set({ installed: bundle.version ?? '', kind: bundle.update })
        let choices: UpdateChoice[] = []
        let warnings: string[] = []
        let omitted = 0
        if (bundle.update === 'registry') {
          // Supply every business argument: the strict Remote does not omit optional options.
          const answer = await api.listVersions(packageName, {})
          if (current !== generation) return
          if (!answer.ok) throw new Error(answer.error.message)
          const list = answer.value
          if (list.status === 'refused') throw new Error(list.reason)
          set({ installed: list.installed })
          omitted = list.omitted
          choices = list.versions.map(version => ({
            version: version.version, prerelease: version.prerelease,
            ...(version.deprecated === undefined ? {} : { deprecated: version.deprecated }),
            ...(version.incompatible ? { blocked: requirementsText(version.incompatible.requirements) }
              : !version.bundle ? { blocked: 'This version does not declare dsh.bundle.' } : {}),
            source: { registry: list.registry },
          }))
        } else {
          const indexes = market()
          if (!indexes) throw new Error('Git update discovery requires the official Discover feature and a configured subscription index.')
          const sources = await indexes.listIndexes()
          if (current !== generation) return
          if (!sources.ok) throw new Error(sources.error.message)
          if (!sources.value.length) throw new Error('Add a subscription index in the official Discover page before checking Git updates.')
          const found = await gitUpdateChoices(indexes, sources.value, packageName, () => current === generation)
          if (current !== generation) return
          choices = found.choices
          warnings = found.warnings
          if (!choices.length && warnings.length) throw new Error(warnings.join('\n'))
        }
        if (current !== generation) return
        const selected = defaultCandidate(choices)
        set({ phase: 'ready', choices, selected, warnings, omitted, available: withAvailable(state.available, packageName, selected) })
      } catch (error) {
        if (current === generation) set({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    },
    select(version: string) {
      if (state.phase === 'ready' && state.choices.some(choice => choice.version === version && !choice.blocked)) set({ selected: version })
    },
    async confirm() {
      if (state.phase !== 'ready') return
      const choice = state.choices.find(version => version.version === state.selected && !version.blocked)
      if (!choice) return
      requestId = globalThis.crypto.randomUUID() as PluginInstallRequestId
      set({ phase: 'updating', message: '', step: 'checking' })
      try {
        const api = host()
        if (!api) throw new Error('The plugin manager is unavailable.')
        const source = choice.source
        const answer = await api.updateBundle(state.packageName, choice.version,
          { ...('registry' in source ? { registry: source.registry } : { spec: source.spec }), requestId })
        const applied = answer.ok && (answer.value.result.application === 'applied' || answer.value.result.application === 'restart-required')
        set(answer.ok ? {
          phase: 'done',
          result: answer.value,
          revision: state.revision + 1,
          ...(applied ? { available: withAvailable(state.available, state.packageName, '') } : {}),
        } : { phase: 'unknown', message: answer.error.message, revision: state.revision + 1 })
      } catch (error) {
        set({ phase: 'unknown', message: error instanceof Error ? error.message : String(error), revision: state.revision + 1 })
      } finally { requestId = undefined }
    },
    progress(event: PluginUpdateProgress) {
      if (state.phase === 'updating' && event.requestId === requestId) set({ step: event.step })
    },
    close() {
      if (state.phase === 'updating') return
      generation += 1
      set({ phase: 'idle' })
    },
  }
}
export type PluginUpdater = ReturnType<typeof createPluginUpdater>
