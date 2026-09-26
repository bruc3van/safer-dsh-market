/**
 * safer-dsh-market client plugin: the browser half of the safe plugin
 * marketplace. Mounts the safeMarket Remote namespace, contributes the
 * market pages to the left navigation and right sidebar, and owns the install
 * hand-off — which opens a session in the current or most recent workspace and
 * stages a security-review prompt in its composer.
 *
 * Nothing is sent. The draft is written through the published conversation
 * face and left there: the person at the keyboard reads the prompt and presses
 * Enter, and the install that follows is the agent's work under their eye.
 */
// Type-only: the ctx.remote merge and the forwarded Host-event face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  MarketCatalogResult,
  MarketEnvironment,
  MarketInstalledResult,
  MarketSkillsResult,
  SafeMarketSettings,
  SafeMarketSettingsUpdate,
} from '../contract.ts'
import { createDirectInstaller, type InstallHost } from './directInstall.ts'
import { stageReviewPrompt } from './handoff.ts'
import { SAFE_MARKET_REMOTE } from './remote.ts'
import {
  type ChooseWorkspaceOutcome,
  type InstallOutcome,
  type MarketSectionInjected,
  type WorkspaceReadiness,
} from './MarketSection.tsx'
import { NO_SESSION, SESSIONS_PENDING } from './SkillsView.tsx'
import { en, zh, type SafeMarketLocaleKey } from './locales.ts'
import { adoptStyles } from './styles.ts'
import { registerMarketNavigation, registerMarketSidebar } from './sidebar.tsx'
import {
  type MarketUiWorkspace,
  type MarketWorkspaces,
  type WorkspaceTarget,
  currentSessionOf,
  workspaceReady,
  workspaceTargetOf,
} from './workspaceCompat.ts'

export type {
  ChooseWorkspaceOutcome,
  InstallOutcome,
  MarketSectionInjected,
  MarketSectionProps,
  WorkspaceReadiness,
} from './MarketSection.tsx'
export type { SafeMarketLocaleKey } from './locales.ts'
export { NO_SESSION, SESSIONS_PENDING } from './SkillsView.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The safe plugin marketplace's copy. */
    'settings.safeMarket': SafeMarketLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.safeMarket'

/** Required DSH services: locale, Remote, split Controllers, navigation, and conversation. */
export const inject = ['slots', 'locale', 'remote', 'sessions', 'workspaces', 'uiWorkspace', 'conversation']

/** Poll only for the newly registered workspace to reach its list mirror. */
const WORKSPACE_POLL_MS = 60
/** How long a freshly registered workspace gets to reach the list mirror. */
const WORKSPACE_WAIT_MS = 4_000

/** A dependency-free root store; its identity and snapshots stay stable between writes. */
function createMarketStore<T>(initial: T): {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
  set(next: T): void
} {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      if (Object.is(value, next)) return
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** The mounted safeMarket namespace service's callable face. */
interface SafeMarketFace {
  getCatalog(force: boolean, signal?: AbortSignal): Promise<{ ok: true; value: MarketCatalogResult } | { ok: false; error: { code: string; message: string } }>
  listSkills(agentId: string, signal?: AbortSignal): Promise<{ ok: true; value: MarketSkillsResult } | { ok: false; error: { code: string; message: string } }>
  describe(): Promise<{ ok: true; value: MarketEnvironment } | { ok: false; error: { code: string; message: string } }>
  getSettings(): Promise<{ ok: true; value: SafeMarketSettings } | { ok: false; error: { code: string; message: string } }>
  updateSettings(update: SafeMarketSettingsUpdate): Promise<{ ok: true; value: SafeMarketSettings } | { ok: false; error: { code: string; message: string } }>
  listInstalled(): Promise<{ ok: true; value: MarketInstalledResult } | { ok: false; error: { code: string; message: string } }>
  setInstalledEnabled(update: { packageName: string; enabled: boolean }): Promise<{ ok: true; value: MarketInstalledResult } | { ok: false; error: { code: string; message: string } }>
  uninstallInstalled(update: { packageName: string }): Promise<{ ok: true; value: MarketInstalledResult } | { ok: false; error: { code: string; message: string } }>
}

const defaultSettings = (): SafeMarketSettings => ({ enabled: false })

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

/**
 * Compose the marketplace surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => adoptStyles(), 'safer-dsh-market: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'safer-dsh-market: dictionaries')

  const scope = createMarketStore({ value: defaultSettings(), profile: null as string | null, version: '' })
  let settingsGeneration = 0

  const workspaces = ctx.get('workspaces') as MarketWorkspaces
  const sessions = ctx.get('sessions') as ISessions
  const navigation = ctx.get('uiWorkspace') as MarketUiWorkspace

  const reportError = (operation: string, error: unknown): void => {
    console.error(`[safer-dsh-market] ${operation} failed:`, error)
  }

  // The mounted namespace handle resolves through the service store
  // (`ctx.reflect.get`), not through `ctx.remote.safeMarket`: the dotted read
  // walks the cordis fiber chain, which stops at the Loader's runtime-less
  // internal forks between a plugin entry and the root fiber.
  let market: SafeMarketFace | undefined

  const loadSettings = async (): Promise<void> => {
    const remote = market
    if (remote === undefined) return
    const generation = ++settingsGeneration
    try {
      const result = await remote.getSettings()
      if (market !== remote || generation !== settingsGeneration) return
      if (!result.ok) {
        reportError('settings read', result.error)
        return
      }
      scope.set({ ...scope.getSnapshot(), value: result.value })
    } catch (error) {
      if (market === remote && generation === settingsGeneration) reportError('settings read', error)
    }
  }

  /**
   * The deployment facts the install prompt needs. Read once per mount: the
   * profile a Host boots does not change under a running client.
   */
  const loadEnvironment = async (): Promise<void> => {
    const remote = market
    if (remote === undefined) return
    try {
      const result = await remote.describe()
      if (market !== remote) return
      if (!result.ok) {
        reportError('describe', result.error)
        return
      }
      scope.set({ ...scope.getSnapshot(), profile: result.value.profile, version: result.value.version })
    } catch (error) {
      if (market === remote) reportError('describe', error)
    }
  }

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(SAFE_MARKET_REMOTE)
    market = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.safeMarket') as SafeMarketFace | undefined
    if (market === undefined) {
      throw new Error('safer-dsh-market: the safeMarket Remote namespace did not mount')
    }
    await Promise.all([loadSettings(), loadEnvironment()])
    return () => {
      settingsGeneration += 1
      market = undefined
      void dispose()
    }
  }, 'safer-dsh-market: remote')

  // Reconnect may have rebuilt the host: the durable switch and the
  // deployment facts are re-read rather than assumed to have survived.
  ctx.on('connection/reset', () => {
    void loadSettings()
    void loadEnvironment()
  })

  const setEnabled = async (enabled: boolean): Promise<void> => {
    const remote = market
    if (remote === undefined) {
      const error = new Error('the safeMarket Remote is not mounted')
      reportError('settings update', error)
      throw error
    }
    const generation = ++settingsGeneration
    let result: { ok: true; value: SafeMarketSettings } | { ok: false; error: { code: string; message: string } }
    try {
      result = await remote.updateSettings({ field: 'enabled', value: enabled })
    } catch (error) {
      if (market === remote && generation === settingsGeneration) {
        reportError('settings update', error)
        throw error
      }
      return
    }
    if (market !== remote || generation !== settingsGeneration) return
    if (!result.ok) {
      reportError('settings update', result.error)
      throw new Error(result.error.message)
    }
    scope.set({ ...scope.getSnapshot(), value: result.value })
  }

  /**
   * The skills read is addressed by the current session, not by the plugin's
   * root context. The registry is host+per-scope layered and the web
   * deployment leaves local discovery to whichever agent preset a session
   * runs, so only a session's scope chain can answer what the user actually
   * has. With no session open there is nothing to address, and saying so is
   * the honest answer.
   */
  const listSkills = async (): Promise<MarketSkillsResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const sessions = ctx.get('sessions') as ISessions
    const snapshot = sessions.list.getSnapshot()
    // "Pending" means the first list pull has not landed yet — telling the
    // user "open a session first" while the list is still loading would be
    // a wrong answer, not the honest one.
    if (snapshot.phase !== 'ready') return { skills: [], complete: true, error: SESSIONS_PENDING }
    const current = currentSessionOf(snapshot)
    if (current === undefined) return { skills: [], complete: true, error: NO_SESSION }
    const result = await remote.listSkills(current)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const skillsSession = {
    getSnapshot: (): string => {
      const state = (ctx.get('sessions') as ISessions).list.getSnapshot()
      return JSON.stringify([state.phase, currentSessionOf(state) ?? null])
    },
    subscribe: (listener: () => void): (() => void) =>
      (ctx.get('sessions') as ISessions).list.subscribe(listener),
  }

  const loadCatalog = async (force: boolean): Promise<MarketCatalogResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.getCatalog(force)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  /** The installed-panel verbs: local profile facts, so they need no market switch. */
  const listInstalled = async (): Promise<MarketInstalledResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.listInstalled()
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const setInstalledEnabled = async (packageName: string, enabled: boolean): Promise<MarketInstalledResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.setInstalledEnabled({ packageName, enabled })
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const uninstallInstalled = async (packageName: string): Promise<MarketInstalledResult> => {
    const remote = market
    if (remote === undefined) throw new Error('the safeMarket Remote is not mounted')
    const result = await remote.uninstallInstalled({ packageName })
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  /**
   * The second half of every install hand-off: connect the workspace, navigate
   * to its session, and write the draft. Every step goes through a published
   * service face; nothing here reads the DOM, and nothing here sends.
   */
  const stageIn = async (workspaceId: WorkspaceTarget, prompt: string): Promise<InstallOutcome> => {
    return stageReviewPrompt(sessions, navigation, ctx.get('conversation') as IConversation, workspaceId, prompt)
  }

  /**
   * Register a directory as a Workspace, through the Host's own picker.
   *
   * The directory is the one thing here that cannot be inferred: it is where
   * the agent will work, so the choice stays with the person making it. What
   * this removes is the errand — the old answer sent them to the sidebar and
   * asked them to come back and start over.
   */
  const chooseWorkspaceId = async (): Promise<
    | { ok: true; id: WorkspaceTarget; path: string }
    | { ok: false; reason: 'cancelled' }
    | { ok: false; reason: 'failed'; message: string }
  > => {
    try {
      const path = await navigation.pickDirectory()
      // A cancelled picker is an answer, not a failure: the user changed
      // their mind, and the card says so instead of showing an error.
      if (path === null) return { ok: false, reason: 'cancelled' }
      const created = await workspaces.create({ path })
      // `openWorkspace` resolves against the list mirror, which the create
      // response reaches one projection later.
      const deadline = Date.now() + WORKSPACE_WAIT_MS
      while (Date.now() < deadline
        && !workspaces.list.getSnapshot().items.some(item => item.workspaceId === created.workspaceId)) {
        await wait(WORKSPACE_POLL_MS)
      }
      return { ok: true, id: created.workspaceId, path }
    } catch (error) {
      return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * The install hand-off: resolve the workspace, then stage the prompt in it.
   */
  const install = async (prompt: string): Promise<InstallOutcome> => {
    // The same target rule the shell's own New Session action uses: the
    // current session's workspace, then the recency projection. Both derive
    // from the two-baseline readiness flag — in the first moments of boot
    // `items` is still empty and "no workspace yet" would be a wrong answer.
    const workspaceState = workspaces.list.getSnapshot()
    const sessionState = sessions.list.getSnapshot()
    if (!workspaceReady(workspaceState, sessionState)) return { ok: false, reason: 'not-ready' }
    const workspaceId = workspaceTargetOf(
      workspaceState,
      sessionState,
    )
    if (workspaceId === undefined) return { ok: false, reason: 'no-workspace' }
    return await stageIn(workspaceId, prompt)
  }

  /** The install hand-off for a deployment with no workspace yet. */
  const installIntoNewWorkspace = async (prompt: string): Promise<InstallOutcome> => {
    const chosen = await chooseWorkspaceId()
    if (!chosen.ok) return chosen
    return await stageIn(chosen.id, prompt)
  }

  /** Pick and register a workspace on its own, for the page's standing notice. */
  const chooseWorkspace = async (): Promise<ChooseWorkspaceOutcome> => {
    const chosen = await chooseWorkspaceId()
    return chosen.ok ? { ok: true, path: chosen.path } : chosen
  }

  /**
   * Live workspace readiness for the notice at the top of the Plugins page,
   * read straight off the domain's own list store so it clears itself the
   * moment a workspace appears — from this flow or from anywhere else.
   */
  const workspaceReadiness = {
    getSnapshot: (): WorkspaceReadiness => {
      const state = workspaces.list.getSnapshot()
      if (!workspaceReady(state, sessions.list.getSnapshot())) return 'pending'
      return state.items.length > 0 ? 'present' : 'none'
    },
    subscribe: (fn: () => void): (() => void) => {
      const disposeWorkspaces = workspaces.list.subscribe(fn)
      const disposeSessions = sessions.list.subscribe(fn)
      return () => {
        disposeSessions()
        disposeWorkspaces()
      }
    },
  }

  const directInstaller = createDirectInstaller(() => ctx.reflect.get('remote.pluginManager') as InstallHost | undefined)

  const injectMarket = (): MarketSectionInjected => ({
    hooks: { scope },
    directInstaller,
    setEnabled,
    loadCatalog,
    listSkills,
    skillsSession,
    install,
    installIntoNewWorkspace,
    chooseWorkspace,
    workspaceReadiness,
    listInstalled,
    setInstalledEnabled,
    uninstallInstalled,
  })

  registerMarketSidebar(ctx, injectMarket)
  registerMarketNavigation(ctx, injectMarket)

}
