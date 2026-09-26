import { isInstallSpec } from '../installInfo.ts'

// Structural boundary for the optional host service. Do not rely on ambient
// plugin-manager declarations contributed by unrelated development packages.
type Reply<T> = { ok: true; value: T } | { ok: false; error: { message: string } }
type RequestId = string | undefined
interface InstallResult {
  application: 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled'
  pendingBuilds?: string[]
  warnings?: string[]
  error?: { code: string; diagnostic?: string; incompatible?: { name: string; version: string; peers: Record<string, string> }[] }
  packageResult?: { output?: string }
}
export interface InstallHost {
  inspect(spec: string): Promise<Reply<
    { status: 'accepted'; registry: string | null } |
    { status: 'refused'; problem: string; reason: string }
  >>
  installBundle(spec: string, options?: { requestId?: string; registry?: string | null; enabled?: boolean; approvedBuilds?: string[] }): Promise<Reply<InstallResult>>
  cancelInstall(requestId: string): Promise<Reply<{ status: string }>>
  waitForInstall(requestId: string): Promise<Reply<InstallResult | null>>
}
export interface DirectState {
  phase: 'idle' | 'checking' | 'installing' | 'cancelling' | 'unknown' | 'done' | 'failed'
  spec: string
  message: string
  application?: string
  pendingBuilds: string[]
}
export function createDirectInstaller(host: () => InstallHost | undefined) {
  let state: DirectState = { phase: 'idle', spec: '', message: '', pendingBuilds: [] }
  let requestId: RequestId
  let approved: string[] = []
  const listeners = new Set<() => void>()
  const set = (patch: Partial<DirectState>) => { state = { ...state, ...patch }; for (const fn of listeners) fn() }
  const manager = () => { const value = host(); if (!value) throw new Error('Plugin installation is unavailable in this host.'); return value }
  const cancelling = () => state.phase === 'cancelling'
  const busy = () => ['checking', 'installing', 'cancelling', 'unknown'].includes(state.phase)
  const settle = (result: Awaited<ReturnType<InstallHost['installBundle']>>) => {
    if (!result.ok) { set({ phase: 'unknown', message: result.error.message }); return }
    const value = result.value
    set({ phase: value.application === 'failed' ? 'failed' : 'done', application: value.application,
      pendingBuilds: value.pendingBuilds ?? [],
      message: [value.error?.code, value.error?.diagnostic, ...(value.warnings ?? []),
        ...(value.error?.incompatible ?? []).map(p => `${p.name}@${p.version}: ${JSON.stringify(p.peers)}`),
        value.application === 'failed' ? value.packageResult?.output : undefined,
      ].filter(Boolean).join('\n').slice(-8000) })
  }
  const start = async (spec: string, builds: string[] = []) => {
    if (busy()) return
    if (!isInstallSpec(spec)) { set({ phase: 'failed', spec, message: 'Invalid install target', pendingBuilds: [] }); return }
    requestId = undefined
    approved = builds
    set({ phase: 'checking', spec, message: '', application: undefined, pendingBuilds: [] })
    try {
      const api = manager()
      const inspection = await api.inspect(spec)
      if (!inspection.ok) throw new Error(inspection.error.message)
      if (inspection.value.status === 'refused') throw new Error(`${inspection.value.problem}: ${inspection.value.reason}`)
      requestId = globalThis.crypto.randomUUID() as RequestId
      set({ phase: 'installing' })
      try {
        settle(await api.installBundle(spec, { requestId, registry: inspection.value.registry, enabled: true, ...(builds.length ? { approvedBuilds: builds } : {}) }))
      } catch (error) { set({ phase: 'unknown', message: String(error) }) }
    } catch (error) { set({ phase: 'failed', message: error instanceof Error ? error.message : String(error) }) }
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    start,
    reset() { if (!busy()) set({ phase: 'idle', spec: '', message: '', pendingBuilds: [], application: undefined }) },
    approve: async () => { if (state.phase === 'failed' && state.pendingBuilds.length) await start(state.spec, [...new Set([...approved, ...state.pendingBuilds])]) },
    async cancel() {
      if (!requestId || state.phase !== 'installing') return
      const cancellingRequest = requestId
      set({ phase: 'cancelling' })
      try {
        const result = await manager().cancelInstall(cancellingRequest)
        if (requestId !== cancellingRequest || !cancelling()) return
        if (!result.ok) set({ phase: 'installing', message: result.error.message })
        else if (cancelling() && result.value.status !== 'cancelled') set({ phase: 'installing', message: result.value.status })
      } catch (e) { if (cancelling()) set({ phase: 'installing', message: String(e) }) }
    },
    async recover() {
      if (!requestId || state.phase !== 'unknown') return
      try {
        const result = await manager().waitForInstall(requestId)
        if (!result.ok) set({ message: result.error.message })
        else if (result.value !== null) settle({ ok: true, value: result.value })
        else set({ message: 'Installation result is unavailable. Check the official Plugins page before retrying.' })
      } catch (e) { set({ message: String(e) }) }
    },
  }
}
export type DirectInstaller = ReturnType<typeof createDirectInstaller>
