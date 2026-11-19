import type { DirectInstaller } from './directInstall.ts'
import { MarketSelector } from './InstallModeSelector.tsx'
import { DirectInstallPanel } from './DirectInstallPanel.tsx'
import type { PluginUpdater } from './pluginUpdates.ts'
import { PluginUpdatePanel } from './PluginUpdatePanel.tsx'
import type { SkillsSessionSource } from './skillsSubscription.ts'
/**
 * The shared Marketplace surface, with Plugins and Skills pages.
 *
 * **Plugins** offers editorial picks and the full repository catalog by
 * default. The host configuration can disable catalog access. Cards use
 * official Host installation, with optional read-only review of installed artifacts.
 *
 * **Skills** is what this deployment can already resolve. It needs neither the
 * switch nor the network.
 *
 * Each host supplies a close callback to reveal the conversation after staging.
 */
import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent, type ReactElement,
} from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {
  MarketCatalog,
  MarketInstalledPackage,
  MarketInstalledResult,
  MarketPlugin,
  MarketSkillsResult,
  SafeMarketSettings,
} from '../contract.ts'
import { FEATURED_CATEGORY, SUBSCRIPTION_CATEGORY, isSafeVersion } from '../shapes.ts'
import type { MarketLocale } from './copy.ts'
import { ownedBy, ownedIndexOf, shortName } from './owned.ts'
import {
  INSTALLED_FILTER, SELF_CARD_KEY, featuredRows, installedReviewCardKey, marketKey, marketRows, matches, pageOf, starCount, stateOf,
} from './rows.ts'
import { SkillsView } from './SkillsView.tsx'
import { MarketMoreActions } from './MarketMoreActions.tsx'
import { BackToTop } from './BackToTop.tsx'
import { PluginLogo } from './PluginLogo.tsx'
import { buildInstallPrompt, buildReviewPrompt, type ReviewTarget } from './reviewPrompt.ts'
import { useSearchDock } from './useSearchDock.ts'

/** The live snapshot the section renders from: the switch plus the deployment facts. */
export interface SafeMarketSnapshot {
  readonly value: SafeMarketSettings
  /** Wait for the host's persisted catalog preference before loading. */
  readonly settingsReady: boolean
  /** Current instance profile; reviews stay disabled until the Host confirms it. */
  readonly profile: string | null
  /** The market's own version, from the same `describe`; '' until it answers. */
  readonly version: string
}
export type SafeMarketSource = ObservableSnapshot<SafeMarketSnapshot>

/** What the review hand-off reports back to the card that asked for it. */
export type InstallOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'not-ready' }
  | { readonly ok: false; readonly reason: 'no-workspace' }
  | { readonly ok: false; readonly reason: 'draft-exists' }
  | { readonly ok: false; readonly reason: 'cancelled' }
  | { readonly ok: false; readonly reason: 'failed'; readonly message: string }

/** What registering a directory as a Workspace reports back. */
export type ChooseWorkspaceOutcome =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: 'cancelled' }
  | { readonly ok: false; readonly reason: 'failed'; readonly message: string }

/**
 * Whether this deployment has a Workspace for an AI review.
 *
 * `pending` is its own answer rather than a flavour of `none`: for the first
 * moments of a boot the list mirror is legitimately empty, and telling someone
 * with a dozen workspaces that they have none is worse than saying nothing.
 */
export type WorkspaceReadiness = 'pending' | 'none' | 'present'

/** Injected business face: the live source and the section's verbs. */
export interface MarketSectionInjected {
  directInstaller?: DirectInstaller
  pluginUpdater?: PluginUpdater
  hooks: { scope: SafeMarketSource }
  /** Read the reduced catalog; `force` bypasses the refresh interval. */
  loadCatalog: (force: boolean) => Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }>
  /** Read the skills this deployment resolves. */
  listSkills: () => Promise<MarketSkillsResult>
  skillsSession: SkillsSessionSource
  /** Whether the Host can open a folder on its desktop at all. */
  canOpenFolder: () => Promise<boolean>
  /** Open one skill's directory in the Host's file manager. */
  openFolder: (path: string) => Promise<void>
  /** Open a session in the current or most recent workspace and stage the given prompt. */
  install: (prompt: string) => Promise<InstallOutcome>
  /**
   * The same hand-off for someone who has no workspace yet: pick a directory
   * through the Host's own picker, register it, then stage the prompt in it.
   */
  installIntoNewWorkspace: (prompt: string) => Promise<InstallOutcome>
  /** Pick a directory and register it as a Workspace, installing nothing. */
  chooseWorkspace: () => Promise<ChooseWorkspaceOutcome>
  /** Live answer to "is there a workspace for review?". */
  workspaceReadiness: {
    getSnapshot: () => WorkspaceReadiness
    subscribe: (fn: () => void) => () => void
  }
  /** Read the plugins installed into this profile, with live enable state. */
  listInstalled: () => Promise<MarketInstalledResult>
  subscribeInstalledChanges?: (listener: () => void) => () => void
  /** Enable or disable one installed package (durable and immediate). */
  setInstalledEnabled: (packageName: string, enabled: boolean) => Promise<MarketInstalledResult>
  /** Uninstall one installed package (stops now, finishes on restart). */
  uninstallInstalled: (packageName: string) => Promise<MarketInstalledResult>
}

/** Full section props: runtime share + injected face + locale seat. */
export type MarketSectionProps =
  { close: () => void }
  & InjectFace<MarketSectionInjected>
  & PropsLocale<'settings.dshMarketPro'>

type CatalogState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly catalog: MarketCatalog; readonly stale: boolean }
  | { readonly status: 'error'; readonly message: string }

type CardState =
  | { readonly status: 'busy' }
  /** The Host's directory picker is open for this card. */
  | { readonly status: 'picking' }
  /** The review is one directory choice away; the card offers to make it. */
  | { readonly status: 'needs-workspace'; readonly message: string }
  | { readonly status: 'staged' }
  | { readonly status: 'error'; readonly message: string }

type Page = 'plugins' | 'skills'

type InstalledState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: MarketInstalledResult }
  | { readonly status: 'error'; readonly message: string }

/**
 * The installed set's own state and verbs: the plugins installed into this
 * profile, with enable/disable and uninstall. It is local profile facts all
 * the way down — reading them reaches nothing outside this machine, so this
 * answers with the market off too.
 *
 * A hook rather than a panel because the count belongs to the filter chip and
 * the rows belong to the same card grid the catalog uses: one list of cards,
 * one of whose filters happens to be "the ones I already have".
 */
function useInstalled({ t, active, listInstalled, subscribeInstalledChanges, setInstalledEnabled, uninstallInstalled }: {
  t: MarketLocale
  /**
   * Whether the panel is on screen at all. The read is local and cheap, but
   * with the market off there is nothing rendering it — and a read fired for
   * a panel nobody is looking at would report its failures into a page whose
   * only job is to explain the switch.
   */
  active: boolean
  listInstalled: MarketSectionInjected['listInstalled']
  subscribeInstalledChanges?: MarketSectionInjected['subscribeInstalledChanges']
  setInstalledEnabled: MarketSectionInjected['setInstalledEnabled']
  uninstallInstalled: MarketSectionInjected['uninstallInstalled']
}): {
  state: InstalledState
  busy: string | null
  confirming: string | null
  notice: string
  actionError: string
  count: number
  reload: () => void
  toggle: (item: MarketInstalledPackage) => void
  uninstall: (item: MarketInstalledPackage) => void
  setConfirming: (name: string | null) => void
} {
  const [state, setState] = useState<InstalledState>({ status: 'loading' })
  // `${name}:toggle` / `${name}:uninstall`: one verb at a time.
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const mounted = useRef(true)
  // Set on mount as well as cleared on unmount: React 18 StrictMode runs the
  // cleanup once immediately after the first mount, and a ref that is only
  // ever cleared would stay false for the rest of the component's life —
  // every async answer below would then be silently dropped.
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  // The read's generation. `mounted` answers "is this component still here?";
  // this answers the separate "is this still the read whose answer we want?".
  // StrictMode dispatches the mount read twice, and a verb below can land a
  // fresher list while an earlier read is still in flight — without a token
  // the older answer resolves last and overwrites the newer one. Each read
  // captures the value it bumped to; a verb that writes fresh state advances
  // it too, retiring any read that has not yet returned.
  const readSeq = useRef(0)

  const load = useCallback((): void => {
    if (!active) return
    const seq = (readSeq.current += 1)
    setState(previous => (previous.status === 'ready' ? previous : { status: 'loading' }))
    void listInstalled().then((result) => {
      if (!mounted.current || seq !== readSeq.current) return
      setState({ status: 'ready', result })
    }, (error: unknown) => {
      if (!mounted.current || seq !== readSeq.current) return
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
  }, [active, listInstalled])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (active) return subscribeInstalledChanges?.(load)
  }, [active, load, subscribeInstalledChanges])

  const describe = (error: unknown): string => error instanceof Error ? error.message : String(error)

  const toggle = (item: MarketInstalledPackage): void => {
    setBusy(`${item.packageName}:toggle`)
    setActionError('')
    // A new action retires the last outcome line, whatever it said.
    setNotice('')
    void setInstalledEnabled(item.packageName, !item.enabled).then((result) => {
      if (!mounted.current) return
      // This verb's own list is the fresh one; retire any read still in flight.
      readSeq.current += 1
      setBusy(null)
      setState({ status: 'ready', result })
      if (result.restartRequired) setNotice(t('installed.restartRequired'))
    }, (error: unknown) => {
      if (!mounted.current) return
      setBusy(null)
      setActionError(t('installed.actionFailed', { reason: describe(error) }))
      // The durable half may have landed even when the live half reports a
      // failure — what the list says now is the truth to show.
      setState(previous => (previous.status === 'ready' ? { status: 'loading' } : previous))
      load()
    })
  }

  const uninstall = (item: MarketInstalledPackage): void => {
    setBusy(`${item.packageName}:uninstall`)
    setActionError('')
    setNotice('')
    void uninstallInstalled(item.packageName).then((result) => {
      if (!mounted.current) return
      // This verb's own list is the fresh one; retire any read still in flight.
      readSeq.current += 1
      setBusy(null)
      setConfirming(null)
      // The host may have an outcome line of its own (e.g. the in-session
      // stop failed and the plugin runs until the next restart) — prefer it
      // over the default success copy.
      setNotice((() => {
        const faults = result.notice ?? ''
        if (result.restartRequired) return t('installed.restartRequired') + (faults === '' ? '' : ` ${faults}`)
        if (faults === '') return t('installed.uninstalled', { name: item.packageName })
        return t(
          result.noticeKind === 'may-run' ? 'installed.uninstalledMayRun' : 'installed.uninstalledWithFaults',
          { name: item.packageName, faults },
        )
      })())
      setState({ status: 'ready', result })
    }, (error: unknown) => {
      if (!mounted.current) return
      setBusy(null)
      setConfirming(null)
      setActionError(t('installed.actionFailed', { reason: describe(error) }))
      setState(previous => (previous.status === 'ready' ? { status: 'loading' } : previous))
      load()
    })
  }

  const reload = useCallback((): void => {
    setState({ status: 'loading' })
    setNotice('')
    setActionError('')
    load()
  }, [load])

  const count = state.status === 'ready' && state.result.error === '' ? state.result.packages.length : 0
  return { state, busy, confirming, notice, actionError, count, reload, toggle, uninstall, setConfirming }
}

/**
 * One installed package, in the same card the catalog rows use — so the grid
 * stays one grid and the eye does not have to re-learn the layout when the
 * filter changes.
 */
function InstalledCard({ t, item, installed, snapshot, card, installBusy, readiness, onReview, onCheckUpdate, availableVersion }: {
  t: MarketLocale
  item: MarketInstalledPackage
  installed: ReturnType<typeof useInstalled>
  snapshot: SafeMarketSnapshot
  card: CardState | undefined
  installBusy: boolean
  readiness: WorkspaceReadiness
  onReview: (item: MarketInstalledPackage, viaNewWorkspace: boolean) => void
  onCheckUpdate?: (packageName: string) => void
  availableVersion?: string
}): ReactElement {
  const { busy, confirming, setConfirming, toggle, uninstall } = installed
  const uninstalling = busy === `${item.packageName}:uninstall`
  const busyRow = busy !== null && (busy === `${item.packageName}:toggle` || uninstalling)
  const confirmRow = confirming === item.packageName || uninstalling
  const metaParts = [
    item.self ? t('installed.self') : '',
    item.inBox ? t('installed.inBox') : '',
    item.unregistered ? t('installed.unregistered') : '',
  ].filter(part => part !== '')
  const reviewNeedsWorkspace = card?.status === 'needs-workspace' || (readiness === 'none' && card === undefined)
  const reviewDisabled = busy !== null || installBusy || snapshot.profile === null

  const reviewTitle = snapshot.profile === null ? t('install.profilePending') : undefined
  const stateLabels: Record<ReturnType<typeof stateOf>, string> = {
    running: t('installed.running'),
    disabled: t('installed.disabled'),
    failed: t('installed.failedState'),
    readFailed: t('installed.readFailedState'),
    installed: t('installed.installedState'),
    unregistered: t('installed.unregisteredState'),
  }
  return (
    <li className="dsh_market_card">
      <div className="dsh_market_head">
        <span className="dsh_market_name" title={item.packageName}>{shortName(item.packageName)}</span>
        <span className="dsh_market_installedState" data-state={stateOf(item)}>{stateLabels[stateOf(item)]}</span>
      </div>
      <p className="dsh_market_meta">
        {metaParts.join(' · ')}
        {metaParts.length > 0 && item.version !== '' ? ' · ' : ''}
        {item.version !== '' && `v${item.version}`}
        {/* The repository identity has already been reduced to owner/name by
            the Host. Keep the link beside the version it describes instead
            of spending a full action-button seat on it. */}
        {item.repository !== '' && (
          <a
            className="dsh_market_repoIcon"
            href={`https://github.com/${item.repository}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`${t('repo')}: ${item.repository}`}
            title={`${t('repo')}: ${item.repository}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.16 1.18A10.98 10.98 0 0 1 12 6.16c.98 0 1.94.13 2.86.38 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.06.79 2.14v3.26c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
            </svg>
          </a>
        )}
        {/* The how-and-why of a desktop seat, folded behind a hint icon: it
            matters exactly once — when someone wonders what this row is —
            and as a standing paragraph it dwarfed the card it explains.
            Focusable, so the tooltip is reachable without a pointer. */}
        {item.inBox && (
          <span className="dsh_market_hint" tabIndex={0} aria-label={t('installed.inBoxNotice')}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 7.3v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
            </svg>
            <span className="dsh_market_hintTip" role="tooltip">{t('installed.inBoxNotice')}</span>
          </span>
        )}
        {item.unregistered && (
          <span className="dsh_market_hint" tabIndex={0} aria-label={t('installed.unregisteredNotice')}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 7.3v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
            </svg>
            <span className="dsh_market_hintTip" role="tooltip">{t('installed.unregisteredNotice')}</span>
          </span>
        )}
      </p>
      {item.description !== '' && <p className="dsh_market_desc">{item.description}</p>}
      {item.error !== '' && <p className="dsh_market_cardError">{t('installed.readFailed', { reason: item.error })}</p>}
      {item.heldDown && item.entries.length > 0
        && <p className="dsh_market_cardNotice">{t('installed.heldDown')}</p>}
      {card?.status === 'error' && <p className="dsh_market_cardError">{card.message}</p>}
      {card?.status === 'needs-workspace' && <p className="dsh_market_cardNotice">{card.message}</p>}
      <div className="dsh_market_foot">
        {confirmRow
          ? (
            <>
              <span className="dsh_market_cardNotice" aria-live="polite">
                {uninstalling
                  ? t('installed.uninstallingHint', { name: shortName(item.packageName) })
                  : t('installed.confirmUninstall', { name: shortName(item.packageName) })}
              </span>
              <button
                type="button"
                className="dsh_market_danger"
                disabled={busyRow}
                onClick={() => { uninstall(item) }}
              >
                {uninstalling ? t('installed.uninstalling') : t('installed.confirm')}
              </button>
              {!uninstalling && (
                <button
                  type="button"
                  className="dsh_market_ghost"
                  disabled={busyRow}
                  onClick={() => { setConfirming(null) }}
                >
                  {t('installed.cancel')}
                </button>
              )}
            </>
            )
          : (
            <>
              {onCheckUpdate && <button type="button" className={availableVersion ? 'dsh_market_install' : 'dsh_market_ghost'}
                disabled={busy !== null || installBusy || item.error !== ''}
                onClick={() => onCheckUpdate(item.packageName)}>
                {availableVersion ? t('update.to', { version: availableVersion }) : t('update.check')}
              </button>}
              <button
                type="button"
                className="dsh_market_ghost"
                disabled={reviewDisabled}
                title={reviewTitle}
                onClick={() => { onReview(item, reviewNeedsWorkspace) }}
              >
                {card?.status === 'picking'
                  ? t('install.picking')
                  : card?.status === 'busy'
                    ? t('installing')
                    : reviewNeedsWorkspace ? t('installed.pickAndReview') : t('installed.review')}
              </button>
              {!item.self && !item.unregistered && (
                <button
                  type="button"
                  className="dsh_market_ghost"
                  disabled={busyRow || busy !== null || installBusy || (item.error !== ''
                    // An unreadable package can still be switched off by the Host, never on.
                    ? item.bundleEnabled !== true
                    : item.bundleEnabled === undefined && item.entries.length === 0)}
                  onClick={() => { toggle(item) }}
                >
                  {busy === `${item.packageName}:toggle`
                    ? (item.enabled ? t('installed.disabling') : t('installed.enabling'))
                    : (item.enabled ? t('installed.disable') : t('installed.enable'))}
                </button>
              )}
              <button
                type="button"
                className="dsh_market_danger"
                disabled={busyRow || busy !== null || installBusy}
                onClick={() => { setConfirming(item.packageName) }}
              >
                {t('installed.uninstall')}
              </button>
            </>
            )}
      </div>
    </li>
  )
}

/** The installed set as a card grid, with its own status lines above it. */
function InstalledCards({ t, installed, needle, snapshot, cards, installBusy, readiness, onReview, onCheckUpdate, availableUpdates }: {
  t: MarketLocale
  installed: ReturnType<typeof useInstalled>
  needle: string
  snapshot: SafeMarketSnapshot
  cards: Readonly<Record<string, CardState>>
  installBusy: boolean
  readiness: WorkspaceReadiness
  onReview: (item: MarketInstalledPackage, viaNewWorkspace: boolean) => void
  onCheckUpdate?: (packageName: string) => void
  availableUpdates?: Readonly<Record<string, string>>
}): ReactElement {
  const { state, notice, actionError, reload } = installed
  const shown = state.status === 'ready' && state.result.error === ''
    ? (needle === ''
      ? state.result.packages
      : state.result.packages.filter(item => [
        item.packageName,
        shortName(item.packageName),
        item.description,
        item.repository,
      ].some(text => text.toLocaleLowerCase().includes(needle))))
    : []
  return (
    <>
      <p className="dsh_market_installedBody">{t('installed.body')}</p>
      {notice !== '' && <p className="dsh_market_installedNotice">{notice}</p>}
      {actionError !== '' && <p className="dsh_market_status" data-error="true">{actionError}</p>}
      {state.status === 'loading' && (
        <div className="dsh_market_notice" aria-busy="true" aria-live="polite">
          <p className="dsh_market_noticeBody">{t('installed.loading')}</p>
        </div>
      )}
      {state.status === 'error' && (
        <p className="dsh_market_status" data-error="true">
          {t('installed.failed', { reason: state.message })}
          <button type="button" className="dsh_market_ghost" onClick={reload}>{t('retry')}</button>
        </p>
      )}
      {state.status === 'ready' && state.result.error !== '' && (
        <p className="dsh_market_status" data-error="true">{t('installed.failed', { reason: state.result.error })}</p>
      )}
      {state.status === 'ready' && state.result.error === '' && state.result.packages.length === 0 && (
        <p className="dsh_market_status">{t('installed.empty')}</p>
      )}
      {state.status === 'ready' && state.result.error === '' && state.result.packages.length > 0 && shown.length === 0 && (
        <p className="dsh_market_status">{t('empty')}</p>
      )}
      {shown.length > 0 && (
        <ul className="dsh_market_cards dsh_market_cardsUniform">
          {shown.map(item => (
            <InstalledCard
              key={item.packageName}
              t={t}
              item={item}
              installed={installed}
              snapshot={snapshot}
              card={cards[installedReviewCardKey(item.packageName)]}
              installBusy={installBusy}
              readiness={readiness}
              onReview={onReview}
              onCheckUpdate={onCheckUpdate}
              availableVersion={availableUpdates?.[item.packageName]}
            />
          ))}
        </ul>
      )}
    </>
  )
}

/** The Plugins page. */
function PluginsPage({ t, english, snapshot, loadCatalog, listInstalled, subscribeInstalledChanges, setInstalledEnabled, uninstallInstalled, chooseWorkspace, workspaceReadiness, cards, installBusy, onReviewDraft, directInstaller, setDirectItem, installedRevision, appliedUpdateRevision, onCheckUpdate, availableUpdates, onProbeUpdates }: {
  setDirectItem: (item: MarketPlugin) => void
  installedRevision: number
  appliedUpdateRevision: number
  onCheckUpdate?: (packageName: string) => void
  availableUpdates?: Readonly<Record<string, string>>
  onProbeUpdates?: (packageNames: readonly string[]) => void
  t: MarketLocale
  english: boolean
  snapshot: SafeMarketSnapshot
  loadCatalog: MarketSectionInjected['loadCatalog']
  listInstalled: MarketSectionInjected['listInstalled']
  subscribeInstalledChanges?: MarketSectionInjected['subscribeInstalledChanges']
  setInstalledEnabled: MarketSectionInjected['setInstalledEnabled']
  uninstallInstalled: MarketSectionInjected['uninstallInstalled']
  chooseWorkspace: MarketSectionInjected['chooseWorkspace']
  workspaceReadiness: MarketSectionInjected['workspaceReadiness']
  directInstaller?: DirectInstaller
  cards: Readonly<Record<string, CardState>>
  installBusy: boolean
  onReviewDraft: (cardKey: string, prompt: string, viaNewWorkspace: boolean) => void
}): ReactElement {
  const enabled = snapshot.settingsReady && snapshot.value.enabled
  const [state, setState] = useState<CatalogState>(enabled ? { status: 'loading' } : { status: 'idle' })
  // A force refresh from `ready` keeps showing the catalog, so the busy
  // answer is a separate flag rather than the `loading` status.
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  // The editor's picks are the first view; a catalog without them falls back
  // to All (see `scope` below), so no feed can open on an empty page.
  const [category, setCategory] = useState(FEATURED_CATEGORY)
  const [filterCategory, setFilterCategory] = useState('')
  const [page, setPage] = useState(0)
  const resultsRef = useRef<HTMLDivElement>(null)
  const installed = useInstalled({ t, active: enabled, listInstalled, subscribeInstalledChanges, setInstalledEnabled, uninstallInstalled })
  useEffect(() => { if (installedRevision > 0) installed.reload() }, [installedRevision, installed.reload])
  useLayoutEffect(() => {
    if (appliedUpdateRevision > 0) resultsRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [appliedUpdateRevision])
  useEffect(() => {
    if (installed.state.status === 'ready' && installed.state.result.error === '' && installed.state.result.packages.length > 0) {
      onProbeUpdates?.(installed.state.result.packages.map(pkg => pkg.packageName))
    }
  }, [installed.state, onProbeUpdates])
  const installedSelected = category === INSTALLED_FILTER
  // Rebuilt only when the installed set itself changes — every enable,
  // disable and uninstall answers with the whole list, so the catalog's
  // "already installed" marks follow those verbs without a second read.
  // Above the market-off early return, where the rules of hooks need it.
  const ownedIndex = useMemo(
    () => ownedIndexOf(installed.state.status === 'ready' ? installed.state.result.packages : []),
    [installed.state],
  )
  // The notice's own state, kept apart from the cards': it can be answered
  // before any card has been clicked.
  const [choosing, setChoosing] = useState(false)
  const [chooseError, setChooseError] = useState('')
  // Read from the workspace domain's own store, so the notice clears itself
  // whether the workspace arrived from this button or from the sidebar.
  const readiness = useSyncExternalStore(workspaceReadiness.subscribe, workspaceReadiness.getSnapshot)
  // The section keeps this page mounted across tab switches (see
  // MarketSection), but the settings shell can still unmount the whole
  // section mid-read — the guard stops the late answer from touching state.
  const mounted = useRef(true)
  // Set on mount as well as cleared on unmount: React 18 StrictMode runs the
  // cleanup once immediately after the first mount, and a ref that is only
  // ever cleared would stay false for the rest of the component's life —
  // every async answer below would then be silently dropped.
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  // The read's generation, distinct from `mounted`: StrictMode dispatches the
  // first read twice and a force-refresh can overlap the background read, so
  // two `loadCatalog` calls may be in flight at once. Each captures the value
  // it bumped to, and only the latest is allowed to land — otherwise the
  // slower, older answer resolves last and overwrites the newer catalog.
  const readSeq = useRef(0)

  const load = useCallback((force: boolean) => {
    const seq = (readSeq.current += 1)
    setState(previous => (previous.status === 'ready' ? previous : { status: 'loading' }))
    if (force) setRefreshing(true)
    void loadCatalog(force).then((result) => {
      if (!mounted.current || seq !== readSeq.current) return
      setRefreshing(false)
      if (result.catalog === null) {
        setState({ status: 'error', message: result.error })
        return
      }
      setState({ status: 'ready', catalog: result.catalog, stale: result.stale })
    }, (error: unknown) => {
      if (!mounted.current || seq !== readSeq.current) return
      setRefreshing(false)
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
  }, [loadCatalog])

  // The host resolves the persisted preference before catalog access begins.
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' })
      return
    }
    load(false)
  }, [enabled, load])

  const catalog = state.status === 'ready' ? state.catalog : null
  const needle = query.trim().toLocaleLowerCase()
  const featuredSelected = category === FEATURED_CATEGORY && catalog?.featured !== undefined
  const allSelected = !installedSelected && !featuredSelected
    && !(catalog === null && category === FEATURED_CATEGORY)
  const filterCategories = featuredSelected
    ? catalog.featured?.categories ?? []
    : catalog?.categories.filter(entry => entry.key !== FEATURED_CATEGORY && entry.key !== SUBSCRIPTION_CATEGORY) ?? []
  const scope = filterCategories.some(entry => entry.key === filterCategory) ? filterCategory : ''
  const shown = useMemo<readonly { item: MarketPlugin; reason?: string }[]>(() => catalog === null || installedSelected
    ? []
    : featuredSelected
      ? featuredRows(catalog.featured, needle, english, scope)
      : marketRows(catalog.items, catalog.featured, needle)
        .filter(item => matches(item, needle, scope, english))
        .sort((a, b) => b.stars - a.stars)
        .map(item => ({ item })), [catalog, installedSelected, featuredSelected, needle, english, scope])
  const paged = pageOf(shown, page)
  useLayoutEffect(() => {
    resultsRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [paged.current])
  useEffect(() => {
    setPage(0)
    resultsRef.current?.scrollTo({ top: 0 })
  }, [catalog, category, filterCategory, query, english])

  if (!snapshot.settingsReady) {
    return <p className="dsh_market_status" role="status">{t('loading')}</p>
  }

  if (!enabled) {
    return (
      <div className="dsh_market_page">
        <div className="dsh_market_intro">
          <p className="dsh_market_introTitle">{t('intro.title')}</p>
          <p className="dsh_market_introBody">{t('intro.disabled')}</p>
        </div>
      </div>
    )
  }

  const pickWorkspace = (): void => {
    setChoosing(true)
    setChooseError('')
    void chooseWorkspace().then((outcome) => {
      if (!mounted.current) return
      setChoosing(false)
      // A cancelled picker leaves the notice exactly as it was: the user
      // declined, and there is nothing to report about it.
      if (!outcome.ok && outcome.reason === 'failed') {
        setChooseError(t('workspace.failed', { reason: outcome.message }))
      }
    }, (error: unknown) => {
      if (!mounted.current) return
      setChoosing(false)
      setChooseError(t('workspace.failed', { reason: error instanceof Error ? error.message : String(error) }))
    })
  }

  const reviewInstalledPackage = (item: MarketInstalledPackage, viaNewWorkspace: boolean): void => {
    const profile = snapshot.profile
    if (profile === null) return
    onReviewDraft(installedReviewCardKey(item.packageName), buildReviewPrompt(t, {
      profile, targets: [{ packageName: item.packageName, version: item.version }],
    }), viaNewWorkspace)
  }

  return (
    <div className="dsh_market_page dsh_market_fixedPage">
      <div className="dsh_market_controls">
      {/* Says the prerequisite out loud before a click runs into it, and
          offers the same one action the cards do. It does not block browsing:
          the shortlist is worth reading without a workspace. */}
      {installedSelected && readiness === 'none' && (
        <div className="dsh_market_notice">
          <p className="dsh_market_noticeBody">{t('workspace.needed')}</p>
          {chooseError !== '' && <p className="dsh_market_status" data-error="true">{chooseError}</p>}
          <button
            type="button"
            className="dsh_market_primary"
            disabled={choosing || installBusy}
            onClick={pickWorkspace}
          >
            {choosing ? t('workspace.choosing') : t('workspace.choose')}
          </button>
        </div>
      )}
        <button
          type="button"
          className="dsh_market_headerAction dsh_market_refreshMarket"
          disabled={state.status === 'loading' || refreshing}
          aria-busy={refreshing}
          onClick={() => { load(true); if (installedSelected) installed.reload() }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 4v6h-6M20 10a8 8 0 1 0-1.7 7" />
          </svg>
          {refreshing ? t('refreshing') : t('refresh')}
        </button>

      <div className="dsh_market_filterBar">
        <div className="dsh_market_scope" role="group" aria-label={t('filter.scope')}>
          {catalog?.featured !== undefined && (
            <button type="button" className="dsh_market_scopeButton" aria-pressed={featuredSelected}
              onClick={() => { setQuery(''); setFilterCategory(''); setCategory(FEATURED_CATEGORY) }}>
              {t('featured.chip')} <span>{catalog.featured.count}</span>
            </button>
          )}
          <button type="button" className="dsh_market_scopeButton" aria-pressed={installedSelected}
            onClick={() => setCategory(INSTALLED_FILTER)}>
            {t('installed.chip')} <span>{installed.count}</span>
          </button>
          <button type="button" className="dsh_market_scopeButton" aria-pressed={allSelected}
            onClick={() => { setFilterCategory(''); setCategory('') }}>
            {t('all')} {catalog !== null && <span>{catalog.items.length}</span>}
          </button>
        </div>
        <div className="dsh_market_filterActions">
          <input
            className="dsh_market_search dsh_market_filterSearch"
            type="search"
            spellCheck={false}
            aria-label={t('search')}
            placeholder={t('search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {!installedSelected && filterCategories.length > 0 && <MarketSelector
            value={scope} onChange={setFilterCategory} label={t('filter.category')} className="dsh_market_category"
            options={[{ value: '', label: t('filter.allCategories') }, ...filterCategories
              .map(entry => ({ value: entry.key, label: english ? entry.en : entry.zh, count: entry.count }))]} />}
        </div>

      </div>

      </div>
      <div className="dsh_market_results" ref={resultsRef}>
      {installedSelected
        ? (
          <InstalledCards
            t={t}
            installed={installed}
            needle={needle}
            snapshot={snapshot}
            cards={cards}
            installBusy={installBusy}
            readiness={readiness}
            onReview={reviewInstalledPackage}
            onCheckUpdate={onCheckUpdate}
            availableUpdates={availableUpdates}
          />
          )
        : state.status === 'error'
          ? (
            <p className="dsh_market_status" data-error="true">
              {t('failed', { reason: state.message })}
              <button type="button" className="dsh_market_ghost" onClick={() => { load(true) }}>{t('retry')}</button>
            </p>
            )
          : catalog === null
            ? (
              <div className="dsh_market_notice" aria-busy="true" aria-live="polite">
                <p className="dsh_market_noticeBody">{t('loading')}</p>
              </div>
              )
            : (
              <p className="dsh_market_status" aria-busy={refreshing ? 'true' : undefined} aria-live="polite">
                {refreshing
                  ? t('refreshing')
                  : shown.length === 0
                    ? t('empty')
                    : query.trim() !== '' || scope !== ''
                        ? t('filter.results', { shown: String(shown.length) })
                      : featuredSelected && catalog.featured !== undefined
                        ? t('featured.summary', { count: String(catalog.featured.count) })
                        : t('summary', {
                          total: String(catalog.items.length),
                          categories: String(catalog.categories.filter(entry => entry.key !== FEATURED_CATEGORY && entry.key !== SUBSCRIPTION_CATEGORY).length),
                        })}
                {(query.trim() !== '' || scope !== '') && <button type="button" className="dsh_market_clearFilters"
                  onClick={() => { setQuery(''); setFilterCategory('') }}>{t('filter.clear')}</button>}
              </p>
              )}

      {!installedSelected && shown.length > 0 && (
        <ul className="dsh_market_cards dsh_market_cardsUniform">
          {paged.items.map(({ item, reason }) => {
            const owned = ownedBy(ownedIndex, item)
            return (
              <li key={marketKey(item)} className="dsh_market_card dsh_market_catalogCard">
                <div className="dsh_market_head">
                  <PluginLogo src={item.icon} name={item.name} fullName={item.fullName} />
                  <div className="dsh_market_identity">
                    <span className="dsh_market_name" title={(english ? item.titleEn : item.titleZh) || item.name}>{(english ? item.titleEn : item.titleZh) || item.name}</span>
                    <span className="dsh_market_packageName" title={item.packageName || item.fullName}>{item.packageName || item.fullName}</span>
                  </div>
                  {/* Says "you already have this" where the eye lands first,
                      so the card's verb below is read as the upgrade it is.
                      The version is shown only in a shape that cannot carry a
                      line of its own into the layout. */}
                  {owned !== undefined && (
                    <span className="dsh_market_owned" title={owned.packageName}>
                      {isSafeVersion(owned.version)
                        ? t('installedHere', { version: owned.version })
                        : t('installedHereUnknown')}
                    </span>
                  )}
                  {/* The picks are ordered by the editor, not by stars, so
                      their cards do not show a count that suggests a ranking;
                      a card built from a pick's install block (found by a
                      search in All) has no count to show at all. */}
                  {reason === undefined && item.category !== FEATURED_CATEGORY && item.category !== SUBSCRIPTION_CATEGORY && (
                    <span className="dsh_market_stars" title={`${String(item.stars)} ${t('stars')}`}>
                      {`★ ${starCount(item.stars)}`}
                    </span>
                  )}
                </div>
                <p className="dsh_market_meta">
                  <span className="dsh_market_categoryTag">{english ? item.categoryEn : item.categoryZh}</span>
                  <span>{[
                    item.owner,
                    item.pushedAt.slice(0, 10),
                    item.archived ? t('repository.archived') : '',
                    item.disabled ? t('repository.disabled') : '',
                  ].filter(part => part !== '').join(' · ')}</span>
                </p>
                {item.description !== '' && <p className="dsh_market_desc">{english ? item.descriptionEn || item.description : item.description}</p>}
                <div className="dsh_market_foot">
                  <a className="dsh_market_link" href={item.url} target="_blank" rel="noreferrer">{t(item.fullName ? 'repo' : 'package.page')}</a>
                  {/* Manage updates using the installed package's exact identity. */}
                  {owned !== undefined
                    ? (
                      <button type="button" className="dsh_market_install"
                        onClick={(event) => {
                          event.currentTarget.closest('.dsh_market_results')?.scrollTo({ top: 0 })
                          setCategory(INSTALLED_FILTER)
                        }}>{t('direct.manage')}</button>
                      )
                    : (
                      <button type="button" className="dsh_market_install" disabled={!directInstaller || installBusy}
                        onClick={() => setDirectItem(item)}>{t('direct.install')}</button>
                      )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {catalog !== null && !installedSelected && (
        <p className="dsh_market_note">
          {t('snapshot', { date: catalog.fetchedAt.slice(0, 10), scanned: String(catalog.scanned) })}
          {' · '}
          <a href="https://github.com/bruc3van/awesome-dsh-plugin-pro" target="_blank" rel="noreferrer">{t('source')}</a>
          {state.status === 'ready' && state.stale ? ` · ${t('stale')}` : ''}
        </p>
      )}
      </div>
      {!installedSelected && shown.length > 0 && <nav className="dsh_market_pagination" aria-label={t('pagination.label')}>
        <span className="dsh_market_pageRange">{t('pagination.range', { start: String(paged.start), end: String(paged.end), total: String(paged.total) })}</span>
        <div className="dsh_market_pager">
          <button type="button" className="dsh_market_pageButton" disabled={paged.current === 0} aria-label={t('pagination.previous')} title={t('pagination.previous')}
            onClick={() => setPage(paged.current - 1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className="dsh_market_pageNumber" aria-live="polite">{t('pagination.page', { page: String(paged.current + 1), pages: String(paged.pages) })}</span>
          <button type="button" className="dsh_market_pageButton" disabled={paged.current + 1 === paged.pages} aria-label={t('pagination.next')} title={t('pagination.next')}
            onClick={() => setPage(paged.current + 1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </nav>}
    </div>
  )
}

/** The Marketplace section. */
export function MarketSection({
  useScope, loadCatalog, listSkills, skillsSession, canOpenFolder, openFolder, install, installIntoNewWorkspace, chooseWorkspace, workspaceReadiness,
  listInstalled, subscribeInstalledChanges, setInstalledEnabled, uninstallInstalled, directInstaller, pluginUpdater, close, t,
}: MarketSectionProps): ReactElement {
  const snapshot = useScope(value => value)
  // The slot props carry a translate function, not a locale tag; the
  // dictionary names its own language so the category labels and the staged
  // prompt follow the same setting the rest of the copy does.
  const english = t('lang') === 'en'
  const [page, setPage] = useState<Page>('plugins')
  const [directItem, setDirectItem] = useState<MarketPlugin | null>(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  const updateState = useSyncExternalStore(pluginUpdater?.subscribe ?? (() => () => {}), pluginUpdater?.getSnapshot ?? (() => null))
  const [installedRevision, setInstalledRevision] = useState(0)
  const refreshInstalled = useCallback(() => setInstalledRevision(value => value + 1), [])
  useEffect(() => { if (updateState?.revision) refreshInstalled() }, [updateState?.revision, refreshInstalled])
  const application = updateState?.result?.result.application
  const appliedUpdateRevision = updateState?.phase === 'done' && (application === 'applied' || application === 'restart-required')
    ? updateState.revision : 0
  const checkUpdate = pluginUpdater ? (packageName: string) => {
    if (pluginUpdater.getSnapshot().phase === 'updating') return
    void pluginUpdater.check(packageName)
    setUpdateOpen(true)
  } : undefined
  const probeUpdates = useCallback((packageNames: readonly string[]) => {
    void pluginUpdater?.probe(packageNames)
  }, [pluginUpdater])
  const searchDock = useSearchDock(page)
  const [cards, setCards] = useState<Readonly<Record<string, CardState>>>({})
  const tabsId = useId()
  // Mirror of the card states for same-tick guards (the rendered copy lags a
  // frame behind), and a live flag so a hand-off that resolves after the
  // section unmounted stops touching state.
  const cardsRef = useRef<Readonly<Record<string, CardState>>>({})
  const mounted = useRef(true)
  // Set on mount as well as cleared on unmount: React 18 StrictMode runs the
  // cleanup once immediately after the first mount, and a ref that is only
  // ever cleared would stay false for the rest of the component's life —
  // every async answer below would then be silently dropped.
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  // One review hand-off at a time: two cards clicked back to back must not
  // open two sessions and stage two drafts.
  const installBusy = updateState?.phase === 'updating' || Object.values(cards).some(card => card.status === 'busy' || card.status === 'picking')

  const report = (fullName: string, next: CardState): void => {
    cardsRef.current = { ...cardsRef.current, [fullName]: next }
    if (mounted.current) setCards(cardsRef.current)
  }

  const closeInstallPanel = (): void => {
    // This review belongs to the dismissed installation, not the next panel.
    const { [SELF_CARD_KEY]: _dismissedReview, ...remaining } = cardsRef.current
    cardsRef.current = remaining
    if (mounted.current) {
      setCards(remaining)
      setDirectItem(null)
    }
  }

  const runReview = async (cardKey: string, prompt: string, viaNewWorkspace: boolean): Promise<boolean> => {
    if (Object.values(cardsRef.current).some(card => card.status === 'busy' || card.status === 'picking')) return false
    report(cardKey, { status: viaNewWorkspace ? 'picking' : 'busy' })
    const handOff = viaNewWorkspace ? installIntoNewWorkspace : install
    try {
      const outcome = await handOff(prompt)
      if (outcome.ok) {
        report(cardKey, { status: 'staged' })
        close()
        return true
      }
      if (outcome.reason === 'no-workspace' || outcome.reason === 'cancelled') {
        report(cardKey, {
          status: 'needs-workspace',
          message: outcome.reason === 'cancelled' ? t('install.cancelled') : t('install.noWorkspace'),
        })
      } else {
        report(cardKey, { status: 'error', message: outcome.reason === 'not-ready'
          ? t('install.notReady') : outcome.reason === 'draft-exists'
            ? t('install.draftExists') : t('install.failed', { reason: outcome.message }) })
      }
    } catch (error) {
      report(cardKey, { status: 'error', message: t('install.failed', { reason: error instanceof Error ? error.message : String(error) }) })
    }
    return false
  }

  const pages: readonly { id: Page; label: string }[] = [
    { id: 'plugins', label: t('tab.plugins') },
    { id: 'skills', label: t('tab.skills') },
  ]

  /**
   * Keyboard navigation for the tablist. The roving `tabIndex` below puts one
   * tab in the tab order; the ARIA pattern then expects the arrow keys to move
   * between them, which is the half that was missing — without it the second
   * tab is unreachable from the keyboard at all.
   */
  const onTabKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    const next = step !== 0
      ? (index + step + pages.length) % pages.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? pages.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    setPage(pages[next]!.id)
    // Focus follows selection, as the pattern's automatic-activation form asks.
    document.getElementById(`${tabsId}-tab-${pages[next]!.id}`)?.focus()
  }
  const reviewResult = cards[SELF_CARD_KEY]
  const reviewInstalled = (targets: ReviewTarget[]): Promise<boolean> => {
    const profile = snapshot.profile
    if (profile === null) return Promise.resolve(false)
    return runReview(SELF_CARD_KEY, buildReviewPrompt(t, { profile, targets }),
      workspaceReadiness.getSnapshot() === 'none')
  }
  /**
   * A catalog repository with no recorded install target is handed to the
   * agent instead of dead-ending the card: the prompt asks it to verify the
   * repository, resolve a package or subdirectory, then install through the
   * official manager. Staged as a draft the user sends.
   */
  const agentInstall = (item: MarketPlugin): void => {
    const profile = snapshot.profile
    if (profile === null || !item.fullName) return
    void runReview(SELF_CARD_KEY, buildInstallPrompt(t, { profile, repo: item.fullName, name: item.name }),
      workspaceReadiness.getSnapshot() === 'none').then(ok => { if (ok) closeInstallPanel() })
  }

  return (
    <div className="dsh_market_section" ref={searchDock.root} data-search-compact={searchDock.compact ? 'true' : undefined}>
      {/* The market's own version, where it is legible without scrolling. The
          installed panel does carry a row for the in-box seat now, but that
          row is one card among many and only exists while the seat is listed
          — the header states which market this is, always. */}
      <div className="dsh_market_headingRow">
        <h2 className="dsh_market_heading">
          {t('nav')}
          {isSafeVersion(snapshot.version) && <span className="dsh_market_selfVersion">{`v${snapshot.version}`}</span>}
        </h2>
        {/* No self-update entry: the host has no update verb, and its
            installer refuses a package that is already installed. */}
        <MarketMoreActions label={t('header.more')}>
        <a className="dsh_market_headerAction" href="https://github.com/bruc3van/dsh-market-pro" target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7M15 22v-3.8a3.3 3.3 0 0 0-.9-2.5c3-.3 6.2-1.5 6.2-6.9a5.4 5.4 0 0 0-1.5-3.8 5 5 0 0 0-.1-3.8s-1.2-.4-3.9 1.4a13.4 13.4 0 0 0-7 0C5.1.8 3.9 1.2 3.9 1.2A5 5 0 0 0 3.8 5a5.4 5.4 0 0 0-1.5 3.8c0 5.4 3.2 6.6 6.2 6.9a3.3 3.3 0 0 0-.9 2.5V22" />
          </svg>
          {t('header.repository')}
        </a>
        <a className="dsh_market_headerAction" href="https://x.com/bruc3van" target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 3h4l12 18h-4L4 3ZM20 3l-7 8M4 21l7-8" />
          </svg>
          {t('header.contact')}
        </a>
        </MarketMoreActions>
      </div>
      <p className="dsh_market_subtitle">{t('intro.slogan')}</p>
      {updateState && updateState.phase !== 'idle' && (
        <button type="button" className="dsh_market_headerAction" onClick={() => setUpdateOpen(true)}>
          {t('update.resume')} · {updateState.packageName}
        </button>
      )}
      {directInstaller && <DirectInstallPanel item={directItem} installer={directInstaller} t={t}
        onClose={closeInstallPanel} onInstalled={refreshInstalled}
        onReview={reviewInstalled} onAgentInstall={directItem ? () => agentInstall(directItem) : undefined}
        reviewBusy={installBusy} reviewAvailable={snapshot.profile !== null}
        reviewMessage={reviewResult?.status === 'error' || reviewResult?.status === 'needs-workspace' ? reviewResult.message : ''} />}
      {pluginUpdater && updateState && <PluginUpdatePanel open={updateOpen} state={updateState} updater={pluginUpdater} t={t}
        onClose={() => setUpdateOpen(false)} />}
      <div className="dsh_market_tabToolbar">
      <div className="dsh_market_tabs" role="tablist" aria-label={t('tabs.aria')}>
        {pages.map((entry, index) => (
          <button
            key={entry.id}
            id={`${tabsId}-tab-${entry.id}`}
            type="button"
            role="tab"
            className="dsh_market_tab"
            aria-selected={page === entry.id}
            aria-controls={`${tabsId}-panel-${entry.id}`}
            data-active={page === entry.id ? 'true' : undefined}
            tabIndex={page === entry.id ? 0 : -1}
            onClick={() => { setPage(entry.id) }}
            onKeyDown={(event) => { onTabKey(event, index) }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      </div>
      {/* The Plugins panel stays mounted across tab switches: unmounting it
          would drop the search/filter state and re-pull the catalog on every
          return. The Skills panel remounts per visit, so each visit re-reads
          the live skill list. */}
      <div
        id={`${tabsId}-panel-plugins`}
        className="dsh_market_scroll"
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-plugins`}
        hidden={page !== 'plugins'}
      >
        <PluginsPage
          setDirectItem={setDirectItem}
          installedRevision={installedRevision}
          appliedUpdateRevision={appliedUpdateRevision}
          onCheckUpdate={checkUpdate}
          availableUpdates={updateState?.available}
          onProbeUpdates={probeUpdates}
          t={t}
          english={english}
          snapshot={snapshot}
          loadCatalog={loadCatalog}
          listInstalled={listInstalled}
          subscribeInstalledChanges={subscribeInstalledChanges}
          setInstalledEnabled={setInstalledEnabled}
          uninstallInstalled={uninstallInstalled}
          chooseWorkspace={chooseWorkspace}
          workspaceReadiness={workspaceReadiness}
          cards={cards}
          installBusy={installBusy}
          onReviewDraft={runReview}
          directInstaller={directInstaller}
        />
      </div>
      {page === 'skills' && (
        <div
          id={`${tabsId}-panel-skills`}
          className="dsh_market_scroll"
          role="tabpanel"
          aria-labelledby={`${tabsId}-tab-skills`}
        >
          <SkillsView t={t} listSkills={listSkills} skillsSession={skillsSession}
            canOpenFolder={canOpenFolder} openFolder={openFolder} />
        </div>
      )}
      <BackToTop root={searchDock.root} page={page} label={t('backToTop')} />
    </div>
  )
}
