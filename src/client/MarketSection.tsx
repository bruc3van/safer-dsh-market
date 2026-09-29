import type { DirectInstaller } from './directInstall.ts'
import { MarketSelector } from './InstallModeSelector.tsx'
import { DirectInstallPanel } from './DirectInstallPanel.tsx'
import type { SkillsSessionSource } from './skillsSubscription.ts'
/**
 * The shared Marketplace surface, with Plugins and Skills pages.
 *
 * **Plugins** is the community shortlist. While the market is off it is one
 * card that says what turning it on will do and asks; the switch is the
 * plugin's own durable setting, so the answer survives a restart. While it is
 * on, cards use official Host installation, with optional read-only review
 * of installed artifacts.
 *
 * **Skills** is what this deployment can already resolve. It needs neither the
 * switch nor the network.
 *
 * Each host supplies a close callback to reveal the conversation after staging.
 */
import {
  useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore,
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
import { FEATURED_CATEGORY, isSafeVersion, PACKAGE_NAME } from '../shapes.ts'
import type { MarketLocale } from './copy.ts'
import { ownedBy, ownedIndexOf, shortName } from './owned.ts'
import {
  INSTALLED_FILTER, SELF_CARD_KEY, SELF_MARKET_PLUGIN, featuredRows, installedReviewCardKey, marketRows, matches, starCount, stateOf,
} from './rows.ts'
import { SkillsView } from './SkillsView.tsx'
import { MarketMoreActions } from './MarketMoreActions.tsx'
import { BackToTop } from './BackToTop.tsx'
import { buildReviewPrompt, type ReviewTarget } from './reviewPrompt.ts'
import { useSearchDock } from './useSearchDock.ts'

/** The live snapshot the section renders from: the switch plus the deployment facts. */
export interface SafeMarketSnapshot {
  readonly value: SafeMarketSettings
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
  hooks: { scope: SafeMarketSource }
  /** Turn the market on or off (durable). */
  setEnabled: (enabled: boolean) => Promise<void>
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
  /** Enable or disable one installed package (durable and immediate). */
  setInstalledEnabled: (packageName: string, enabled: boolean) => Promise<MarketInstalledResult>
  /** Uninstall one installed package (stops now, finishes on restart). */
  uninstallInstalled: (packageName: string) => Promise<MarketInstalledResult>
}

/** Full section props: runtime share + injected face + locale seat. */
export type MarketSectionProps =
  { close: () => void }
  & InjectFace<MarketSectionInjected>
  & PropsLocale<'settings.saferMarket'>

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
function useInstalled({ t, active, listInstalled, setInstalledEnabled, uninstallInstalled }: {
  t: MarketLocale
  /**
   * Whether the panel is on screen at all. The read is local and cheap, but
   * with the market off there is nothing rendering it — and a read fired for
   * a panel nobody is looking at would report its failures into a page whose
   * only job is to explain the switch.
   */
  active: boolean
  listInstalled: MarketSectionInjected['listInstalled']
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

  // One read per mount, and one more the first time the market is switched
  // on: the list changes only through these verbs (or a `dsh plugin` command,
  // which needs a restart anyway) — a poll would add nothing but motion.
  useEffect(() => { load() }, [load])

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
function InstalledCard({ t, item, installed, snapshot, card, installBusy, readiness, onReview }: {
  t: MarketLocale
  item: MarketInstalledPackage
  installed: ReturnType<typeof useInstalled>
  snapshot: SafeMarketSnapshot
  card: CardState | undefined
  installBusy: boolean
  readiness: WorkspaceReadiness
  onReview: (item: MarketInstalledPackage, viaNewWorkspace: boolean) => void
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
              <button
                type="button"
                className="dsh_market_install"
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
                  disabled={busyRow || busy !== null || item.error !== '' || item.entries.length === 0}
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
                disabled={busyRow || busy !== null}
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
function InstalledCards({ t, installed, snapshot, cards, installBusy, readiness, onReview }: {
  t: MarketLocale
  installed: ReturnType<typeof useInstalled>
  snapshot: SafeMarketSnapshot
  cards: Readonly<Record<string, CardState>>
  installBusy: boolean
  readiness: WorkspaceReadiness
  onReview: (item: MarketInstalledPackage, viaNewWorkspace: boolean) => void
}): ReactElement {
  const { state, notice, actionError, reload } = installed
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
      {state.status === 'ready' && state.result.packages.length > 0 && (
        <ul className="dsh_market_cards dsh_market_cardsUniform">
          {state.result.packages.map(item => (
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
            />
          ))}
        </ul>
      )}
    </>
  )
}

/** The Plugins page. */
function PluginsPage({ t, english, snapshot, setEnabled, loadCatalog, listInstalled, setInstalledEnabled, uninstallInstalled, chooseWorkspace, workspaceReadiness, cards, installBusy, onReviewDraft, directInstaller, setDirectItem, installedRevision }: {
  setDirectItem: (item: MarketPlugin) => void
  installedRevision: number
  t: MarketLocale
  english: boolean
  snapshot: SafeMarketSnapshot
  setEnabled: MarketSectionInjected['setEnabled']
  loadCatalog: MarketSectionInjected['loadCatalog']
  listInstalled: MarketSectionInjected['listInstalled']
  setInstalledEnabled: MarketSectionInjected['setInstalledEnabled']
  uninstallInstalled: MarketSectionInjected['uninstallInstalled']
  chooseWorkspace: MarketSectionInjected['chooseWorkspace']
  workspaceReadiness: MarketSectionInjected['workspaceReadiness']
  directInstaller?: DirectInstaller
  cards: Readonly<Record<string, CardState>>
  installBusy: boolean
  onReviewDraft: (cardKey: string, prompt: string, viaNewWorkspace: boolean) => void
}): ReactElement {
  const enabled = snapshot.value.enabled
  const [state, setState] = useState<CatalogState>(enabled ? { status: 'loading' } : { status: 'idle' })
  const [switching, setSwitching] = useState(false)
  // A force refresh from `ready` keeps showing the catalog, so the busy
  // answer is a separate flag rather than the `loading` status.
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  // The editor's picks are the first view; a catalog without them falls back
  // to All (see `scope` below), so no feed can open on an empty page.
  const [category, setCategory] = useState(FEATURED_CATEGORY)
  const [switchError, setSwitchError] = useState('')
  const installed = useInstalled({ t, active: enabled, listInstalled, setInstalledEnabled, uninstallInstalled })
  useEffect(() => { if (installedRevision > 0) installed.reload() }, [installedRevision, installed.reload])
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

  // The first read happens when the market is switched on, not when the page
  // mounts: a disabled market must not reach the network at all.
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' })
      return
    }
    load(false)
  }, [enabled, load])

  const toggle = (next: boolean): void => {
    setSwitching(true)
    setSwitchError('')
    void setEnabled(next).then(() => {
      if (mounted.current) setSwitching(false)
    }, (error: unknown) => {
      if (!mounted.current) return
      setSwitching(false)
      setSwitchError(t(next ? 'intro.enableFailed' : 'intro.disableFailed', {
        reason: error instanceof Error ? error.message : String(error),
      }))
    })
  }

  if (!enabled) {
    // Off means off: the page is the switch and nothing else. The installed
    // set is local enough that showing it here would break no privacy promise
    // — but a marketplace the user has turned off should not still be running
    // a plugin manager in their settings, and a panel with no filter chips
    // above it read as a second, always-on feature rather than as part of the
    // market they had just declined.
    return (
      <div className="dsh_market_page">
        <div className="dsh_market_intro">
          <p className="dsh_market_introTitle">{t('intro.title')}</p>
          <p className="dsh_market_introBody">{t('intro.body')}</p>
          {switchError !== '' && <p className="dsh_market_status" data-error="true">{switchError}</p>}
          <div className="dsh_market_introActions">
            <button
              type="button"
              className="dsh_market_primary"
              disabled={switching}
              onClick={() => { toggle(true) }}
            >
              {switching ? t('intro.enabling') : t('intro.enable')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const catalog = state.status === 'ready' ? state.catalog : null
  // Normalised once, not once per row: this runs on every keystroke over the
  // whole catalog.
  const needle = query.trim().toLocaleLowerCase()
  const featuredSelected = category === FEATURED_CATEGORY && catalog?.featured !== undefined
  // Asking for the picks of a catalog that has none (an older feed, a
  // custom source) reads as All. While the first read is in flight nothing is
  // known yet, so neither chip claims the page.
  const scope = category === FEATURED_CATEGORY && !featuredSelected ? '' : category
  const allSelected = !installedSelected && !featuredSelected && !(catalog === null && category === FEATURED_CATEGORY)
  // The picks are not a filter over the rows: they carry their own order and
  // cards the shortlist does not have. A card shows its row's own description;
  // `reason` only marks the row as a pick.
  const shown: readonly { item: MarketPlugin; reason?: string }[] = catalog === null
    ? []
    : featuredSelected
      ? featuredRows(catalog.featured, needle, english)
      : marketRows(catalog.items, catalog.featured, needle)
        .filter(item => matches(item, needle, scope, english))
        // The All view answers "what the community uses", so it ranks by stars;
        // a category chip keeps the publisher's order, whose front rows are its
        // own picks. `filter` copies, so the sort cannot reorder the catalog
        // the other views read.
        .sort((a, b) => (scope === '' ? b.stars - a.stars : 0))
        .map(item => ({ item }))

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
      {/* Docks beside the tabs while the list scrolls down, as on the Skills
          page (see useSearchDock). */}
      <div className="dsh_market_bar dsh_market_dockable">
        <input
          className="dsh_market_search"
          type="search"
          spellCheck={false}
          aria-label={t('search')}
          placeholder={t('search')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            // A search is a question about the whole market, not the picks.
            if (featuredSelected && event.target.value.trim() !== '') setCategory('')
          }}
        />
      </div>
        <button
          type="button"
          className="dsh_market_headerAction dsh_market_refreshMarket"
          disabled={state.status === 'loading' || refreshing}
          aria-busy={refreshing}
          onClick={() => { load(true) }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 4v6h-6M20 10a8 8 0 1 0-1.7 7" />
          </svg>
          {refreshing ? t('refreshing') : t('refresh')}
        </button>
      {switchError !== '' && <p className="dsh_market_status" data-error="true">{switchError}</p>}

      <div className="dsh_market_filterBar">
        <div className="dsh_market_scope" role="group" aria-label={t('filter.scope')}>
          {catalog?.featured !== undefined && (
            <button type="button" className="dsh_market_scopeButton" aria-pressed={featuredSelected}
              onClick={() => { setQuery(''); setCategory(FEATURED_CATEGORY) }}>
              {t('featured.chip')} <span>{catalog.featured.count}</span>
            </button>
          )}
          <button type="button" className="dsh_market_scopeButton" aria-pressed={installedSelected}
            onClick={() => setCategory(INSTALLED_FILTER)}>
            {t('installed.chip')} <span>{installed.count}</span>
          </button>
          <button type="button" className="dsh_market_scopeButton" aria-pressed={allSelected}
            onClick={() => setCategory('')}>
            {t('all')} {catalog !== null && <span>{catalog.items.length}</span>}
          </button>
        </div>
        {/* Categories narrow All; the picks have their own chip, so they are
            not offered here a second time. */}
        {allSelected && catalog !== null && <MarketSelector
          value={scope} onChange={setCategory} label={t('filter.category')} className="dsh_market_category"
          options={[{ value: '', label: t('filter.allCategories') }, ...catalog.categories
            .filter(entry => entry.key !== FEATURED_CATEGORY)
            .map(entry => ({ value: entry.key, label: english ? entry.en : entry.zh, count: entry.count }))]} />}

      </div>

      </div>
      <div className="dsh_market_results">
      {installedSelected
        ? (
          <InstalledCards
            t={t}
            installed={installed}
            snapshot={snapshot}
            cards={cards}
            installBusy={installBusy}
            readiness={readiness}
            onReview={reviewInstalledPackage}
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
                    : featuredSelected && catalog.featured !== undefined
                      ? t('featured.summary', { count: String(catalog.featured.count) })
                      : query.trim() !== '' || scope !== ''
                        ? t('filter.results', { shown: String(shown.length) })
                        : t('summary', {
                          total: String(catalog.items.length),
                          categories: String(catalog.categories.filter(entry => entry.key !== FEATURED_CATEGORY).length),
                        })}
                {(query.trim() !== '' || (scope !== '' && !featuredSelected)) && <button type="button" className="dsh_market_clearFilters"
                  onClick={() => { setQuery(''); setCategory('') }}>{t('filter.clear')}</button>}
              </p>
              )}

      {!installedSelected && shown.length > 0 && (
        <ul className="dsh_market_cards dsh_market_cardsUniform">
          {shown.map(({ item, reason }) => {
            const owned = ownedBy(ownedIndex, item)
            return (
              <li key={item.fullName} className="dsh_market_card">
                <div className="dsh_market_head">
                  <span className="dsh_market_name" title={item.fullName}>{item.name}</span>
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
                  {reason === undefined && item.category !== FEATURED_CATEGORY && (
                    <span className="dsh_market_stars" title={`${String(item.stars)} ${t('stars')}`}>
                      {`★ ${starCount(item.stars)}`}
                    </span>
                  )}
                </div>
                <p className="dsh_market_meta">
                  {[
                    english ? item.categoryEn : item.categoryZh,
                    item.owner,
                    item.pushedAt.slice(0, 10),
                  ].filter(part => part !== '').join(' · ')}
                </p>
                {item.description !== '' && <p className="dsh_market_desc">{item.description}</p>}
                <div className="dsh_market_foot">
                  <a className="dsh_market_link" href={item.url} target="_blank" rel="noreferrer">{t('repo')}</a>
                  <button type="button" className="dsh_market_install" disabled={!directInstaller || installBusy}
                    onClick={() => setDirectItem(item)}>{t(item.installInfo?.mode === 'command' && item.installInfo.targets.length ? 'direct.install' : 'direct.details')}</button>
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
          <a href="https://github.com/bruc3van/awesome-dsh-plugin" target="_blank" rel="noreferrer">{t('source')}</a>
          {state.status === 'ready' && state.stale ? ` · ${t('stale')}` : ''}
        </p>
      )}
      </div>
    </div>
  )
}

/** The Marketplace section. */
export function MarketSection({
  useScope, setEnabled, loadCatalog, listSkills, skillsSession, canOpenFolder, openFolder, install, installIntoNewWorkspace, chooseWorkspace, workspaceReadiness,
  listInstalled, setInstalledEnabled, uninstallInstalled, directInstaller, close, t,
}: MarketSectionProps): ReactElement {
  const snapshot = useScope(value => value)
  // The slot props carry a translate function, not a locale tag; the
  // dictionary names its own language so the category labels and the staged
  // prompt follow the same setting the rest of the copy does.
  const english = t('lang') === 'en'
  const [page, setPage] = useState<Page>('plugins')
  const [directItem, setDirectItem] = useState<MarketPlugin | null>(null)
  const [installedRevision, setInstalledRevision] = useState(0)
  const refreshInstalled = useCallback(() => setInstalledRevision(value => value + 1), [])
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
  const installBusy = Object.values(cards).some(card => card.status === 'busy' || card.status === 'picking')

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
          ? t('install.notReady') : t('install.failed', { reason: outcome.message }) })
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
  const runSelfUpgrade = (): void => {
    setDirectItem({ ...SELF_MARKET_PLUGIN, installInfo: {
      mode: 'command', targets: [{ install: PACKAGE_NAME, profile: '', note: '' }],
      tasks: [], requirements: [], note: '', manual: '',
    } })
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
        <MarketMoreActions label={t('header.more')}>
        <button
          type="button"
          className="dsh_market_headerAction"
          disabled={!directInstaller || installBusy}
          onClick={runSelfUpgrade}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 17V3M6 9l6-6 6 6M4 17v4h16v-4" />
          </svg>
          {t('self.upgrade')}
        </button>
        <a className="dsh_market_headerAction" href="https://github.com/bruc3van/safer-dsh-market" target="_blank" rel="noopener noreferrer">
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
      {directInstaller && <DirectInstallPanel item={directItem} installer={directInstaller} t={t}
        onClose={closeInstallPanel} onInstalled={refreshInstalled}
        onReview={reviewInstalled} reviewBusy={installBusy} reviewAvailable={snapshot.profile !== null}
        reviewMessage={reviewResult?.status === 'error' || reviewResult?.status === 'needs-workspace' ? reviewResult.message : ''} />}
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
          t={t}
          english={english}
          snapshot={snapshot}
          setEnabled={setEnabled}
          loadCatalog={loadCatalog}
          listInstalled={listInstalled}
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
