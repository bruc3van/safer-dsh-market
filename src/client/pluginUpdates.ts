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
export interface AvailableUpdate {
  readonly packageName: string
  readonly installed: string
  readonly version: string
  readonly kind: 'registry' | 'git'
  readonly source: UpdateChoice['source']
}
export type BatchItemStatus =
  | 'pending'
  | 'running'
  | 'applied'
  | 'restart-required'
  | 'overridden'
  | 'cancelled'
  | 'failed'
  | 'unknown'
  | 'skipped'
export interface BatchUpdateItem {
  readonly packageName: string
  readonly from: string
  readonly to: string
  readonly kind: 'registry' | 'git'
  readonly source: UpdateChoice['source']
  readonly self: boolean
  readonly status: BatchItemStatus
  readonly step?: PluginUpdateProgress['step']
  readonly message?: string
  readonly restoreApplication?: 'applied' | 'restart-required' | 'overridden' | 'cancelled' | 'failed'
  readonly result?: PluginUpdateResult
}
export interface BatchUpdateState {
  readonly phase: 'idle' | 'running' | 'done'
  readonly items: readonly BatchUpdateItem[]
  readonly currentIndex: number
  readonly stopRequested: boolean
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
  /** Resolved update targets for one-click batch updates without a second lookup. */
  availableDetails: Readonly<Record<string, AvailableUpdate>>
  /** Sequential batch update queue (skips failures, orders self last). */
  batch: BatchUpdateState
}

const IDLE_BATCH: BatchUpdateState = { phase: 'idle', items: [], currentIndex: -1, stopRequested: false }

/** Keep caller order while always placing the marketplace itself last so a self-reload cannot interrupt earlier updates. */
export function orderBatchTargets<T extends { readonly packageName: string }>(
  items: readonly T[],
  selfName: string,
): T[] {
  if (selfName === '') return [...items]
  const others: T[] = []
  const selfItems: T[] = []
  for (const item of items) {
    if (item.packageName === selfName) selfItems.push(item)
    else others.push(item)
  }
  return [...others, ...selfItems]
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

function withAvailableDetail(
  current: Readonly<Record<string, AvailableUpdate>>,
  packageName: string,
  detail: AvailableUpdate | null,
): Readonly<Record<string, AvailableUpdate>> {
  if (detail !== null) {
    const clean = detail.version.replace(/^v/i, '')
    if (clean !== '') return { ...current, [packageName]: { ...detail, version: clean } }
  }
  if (!(packageName in current)) return current
  const { [packageName]: _removed, ...rest } = current
  return rest
}

/** One shared operation survives switching between the market's three entry points. */
export function createPluginUpdater(host: () => UpdateHost | undefined, market: () => UpdateMarketHost | undefined) {
  let state: UpdateState = {
    phase: 'idle', packageName: '', installed: '', choices: [], selected: '', message: '', warnings: [], omitted: 0,
    revision: 0, available: {}, availableDetails: {}, batch: IDLE_BATCH,
  }
  let generation = 0
  let probeSeq = 0
  let requestId: PluginInstallRequestId | undefined
  const listeners = new Set<() => void>()
  const set = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  const patchBatchItem = (index: number, patch: Partial<BatchUpdateItem>) => {
    const items = state.batch.items.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    set({ batch: { ...state.batch, items } })
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
        const eligible = new Set(
          inventory.value.filter(item => item.installed && item.update !== undefined).map(item => item.name),
        )
        let nextAvailable = state.available
        let nextDetails = state.availableDetails
        let pruned = false
        for (const name of Object.keys(nextAvailable)) {
          if (!eligible.has(name)) {
            nextAvailable = withAvailable(nextAvailable, name, '')
            pruned = true
          }
        }
        for (const name of Object.keys(nextDetails)) {
          if (!eligible.has(name)) {
            nextDetails = withAvailableDetail(nextDetails, name, null)
            pruned = true
          }
        }
        if (pruned) set({ available: nextAvailable, availableDetails: nextDetails })
        const wanted = packageNames === undefined ? undefined : new Set(packageNames)
        const targets = inventory.value.filter(item => item.installed && item.update !== undefined && (wanted === undefined || wanted.has(item.name)))
        const indexes = market()
        let gitSources: readonly MarketIndexSummary[] | undefined
        for (const bundle of targets) {
          if (currentProbe !== probeSeq) return
          if (bundle.update === 'registry') {
            const answer = await api.listVersions(bundle.name, {})
            if (currentProbe !== probeSeq) return
            if (!answer.ok) continue
            if (answer.value.status === 'refused') {
              if (answer.value.problem === 'not-updatable' || answer.value.problem === 'not-found') {
                set({
                  available: withAvailable(state.available, bundle.name, ''),
                  availableDetails: withAvailableDetail(state.availableDetails, bundle.name, null),
                })
              }
              continue
            }
            const candidate = answer.value.versions.find(version =>
              version.bundle && version.incompatible === undefined && !version.prerelease && version.deprecated === undefined)
            const nextVersion = candidate?.version ?? ''
            const detail: AvailableUpdate | null = nextVersion !== '' ? {
              packageName: bundle.name,
              installed: answer.value.installed || bundle.version || '',
              version: nextVersion,
              kind: 'registry',
              source: { registry: answer.value.registry },
            } : null
            set({
              available: withAvailable(state.available, bundle.name, nextVersion),
              availableDetails: withAvailableDetail(state.availableDetails, bundle.name, detail),
            })
          } else if (bundle.update === 'git' && indexes) {
            if (gitSources === undefined) {
              const listed = await indexes.listIndexes()
              if (currentProbe !== probeSeq) return
              gitSources = listed.ok ? listed.value : []
            }
            const { choices } = await gitUpdateChoices(indexes, gitSources, bundle.name, () => currentProbe === probeSeq)
            if (currentProbe !== probeSeq) return
            const nextVersion = defaultCandidate(choices)
            const chosen = nextVersion !== '' ? choices.find(choice => choice.version === nextVersion) : undefined
            const detail: AvailableUpdate | null = chosen ? {
              packageName: bundle.name,
              installed: bundle.version ?? '',
              version: chosen.version,
              kind: 'git',
              source: chosen.source,
            } : null
            set({
              available: withAvailable(state.available, bundle.name, nextVersion),
              availableDetails: withAvailableDetail(state.availableDetails, bundle.name, detail),
            })
          }
        }
      } catch {
        // Silent background probe: errors surface only when the user opens the update dialog.
      }
    },
    async check(packageName: string) {
      if (state.phase === 'updating' || state.batch.phase === 'running') return
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
        let installedVersion = bundle.version ?? ''
        set({ installed: installedVersion, kind: bundle.update })
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
          installedVersion = list.installed
          set({ installed: installedVersion })
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
        const chosen = selected !== '' ? choices.find(choice => choice.version === selected) : undefined
        const detail: AvailableUpdate | null = chosen ? {
          packageName,
          installed: installedVersion,
          version: chosen.version,
          kind: bundle.update,
          source: chosen.source,
        } : null
        set({
          phase: 'ready',
          choices,
          selected,
          warnings,
          omitted,
          available: withAvailable(state.available, packageName, selected),
          availableDetails: withAvailableDetail(state.availableDetails, packageName, detail),
        })
      } catch (error) {
        if (current === generation) set({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    },
    select(version: string) {
      if (state.phase === 'ready' && state.choices.some(choice => choice.version === version && !choice.blocked)) set({ selected: version })
    },
    async confirm() {
      if (state.phase !== 'ready' || state.batch.phase === 'running') return
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
          ...(applied ? {
            available: withAvailable(state.available, state.packageName, ''),
            availableDetails: withAvailableDetail(state.availableDetails, state.packageName, null),
          } : {}),
        } : { phase: 'unknown', message: answer.error.message, revision: state.revision + 1 })
      } catch (error) {
        set({ phase: 'unknown', message: error instanceof Error ? error.message : String(error), revision: state.revision + 1 })
      } finally { requestId = undefined }
    },
    async startBatch(targets: readonly (string | AvailableUpdate)[], selfName = '') {
      if (state.phase === 'updating' || state.batch.phase === 'running') return
      const resolved: AvailableUpdate[] = []
      const seen = new Set<string>()
      for (const entry of targets) {
        const detail = typeof entry === 'string' ? state.availableDetails[entry] : entry
        if (!detail || seen.has(detail.packageName)) continue
        seen.add(detail.packageName)
        resolved.push(detail)
      }
      if (resolved.length === 0) return
      const ordered = orderBatchTargets(resolved, selfName)
      const queue: BatchUpdateItem[] = ordered.map(item => ({
        packageName: item.packageName,
        from: item.installed,
        to: item.version,
        kind: item.kind,
        source: item.source,
        self: selfName !== '' && item.packageName === selfName,
        status: 'pending',
      }))
      generation += 1
      set({
        phase: 'idle',
        batch: { phase: 'running', items: queue, currentIndex: 0, stopRequested: false },
      })
      for (let index = 0; index < queue.length; index += 1) {
        if (state.batch.stopRequested) {
          const items = state.batch.items.map((entry, i) => (i >= index ? { ...entry, status: 'skipped' as const } : entry))
          set({ batch: { phase: 'done', items, currentIndex: -1, stopRequested: false } })
          return
        }
        const entry = queue[index]!
        set({
          batch: {
            ...state.batch,
            currentIndex: index,
            items: state.batch.items.map((item, i) => (i === index ? { ...item, status: 'running', step: 'checking' } : item)),
          },
        })
        requestId = globalThis.crypto.randomUUID() as PluginInstallRequestId
        try {
          const api = host()
          if (!api?.updateBundle) throw new Error('The plugin manager is unavailable.')
          const source = entry.source
          const answer = await api.updateBundle(entry.packageName, entry.to, {
            ...('registry' in source ? { registry: source.registry } : { spec: source.spec }),
            requestId,
          })
          if (answer.ok) {
            const app = answer.value.result.application
            const applied = app === 'applied' || app === 'restart-required'
            const matchesCurrentAvailable = state.available[entry.packageName] === entry.to.replace(/^v/i, '')
            const nextItems = state.batch.items.map((item, i) => (i === index ? {
              ...item,
              status: app as BatchItemStatus,
              step: undefined,
              result: answer.value,
              restoreApplication: answer.value.restore?.application,
            } : item))
            set({
              batch: { ...state.batch, items: nextItems },
              revision: state.revision + 1,
              ...(applied && matchesCurrentAvailable ? {
                available: withAvailable(state.available, entry.packageName, ''),
                availableDetails: withAvailableDetail(state.availableDetails, entry.packageName, null),
              } : {}),
            })
          } else {
            const nextItems = state.batch.items.map((item, i) => (i === index ? {
              ...item,
              status: 'unknown' as const,
              step: undefined,
              message: answer.error.message,
            } : item))
            set({ batch: { ...state.batch, items: nextItems }, revision: state.revision + 1 })
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const nextItems = state.batch.items.map((item, i) => (i === index ? {
            ...item,
            status: 'unknown' as const,
            step: undefined,
            message,
          } : item))
          set({ batch: { ...state.batch, items: nextItems }, revision: state.revision + 1 })
        } finally {
          requestId = undefined
        }
      }
      set({ batch: { ...state.batch, phase: 'done', currentIndex: -1, stopRequested: false } })
    },
    requestStopBatch() {
      if (state.batch.phase === 'running' && !state.batch.stopRequested) {
        set({ batch: { ...state.batch, stopRequested: true } })
      }
    },
    resetBatch() {
      if (state.batch.phase === 'running') return
      set({ batch: IDLE_BATCH })
    },
    progress(event: PluginUpdateProgress) {
      if (event.requestId !== requestId) return
      if (state.phase === 'updating') {
        set({ step: event.step })
      } else if (state.batch.phase === 'running' && state.batch.currentIndex >= 0) {
        patchBatchItem(state.batch.currentIndex, { step: event.step })
      }
    },
    close() {
      if (state.phase === 'updating') return
      generation += 1
      set({ phase: 'idle' })
    },
  }
}
export type PluginUpdater = ReturnType<typeof createPluginUpdater>
