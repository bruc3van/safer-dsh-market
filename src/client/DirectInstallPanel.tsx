import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { MarketPlugin } from '../contract.ts'
import type { MarketLocale } from './copy.ts'
import { installChoices, installLabel } from './installTargets.ts'
import type { DirectInstaller } from './directInstall.ts'
import { installedReviewTargets, type ReviewTarget } from './reviewPrompt.ts'

/** One shared installation remains observable if the recommendation page remounts. */
export function DirectInstallPanel({ item, installer, t, onClose, onInstalled, onReview, reviewBusy, reviewAvailable, reviewMessage }: {
  item: MarketPlugin | null; installer: DirectInstaller; t: MarketLocale
  onClose: () => void; onInstalled: () => void
  onReview: (targets: ReviewTarget[]) => Promise<boolean>
  reviewBusy: boolean; reviewAvailable: boolean; reviewMessage: string
}) {
  const state = useSyncExternalStore(installer.subscribe, installer.getSnapshot)
  const [selected, setSelected] = useState<number[]>([0])
  const [submitted, setSubmitted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const open = !dismissed && (item !== null || state.phase !== 'idle')
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  const busy = ['checking', 'installing', 'cancelling', 'unknown'].includes(state.phase)
  useEffect(() => { setSelected([0]); setSubmitted(false); if (item) setDismissed(false) }, [item])
  useEffect(() => { if (state.phase === 'done') onInstalled() }, [state, onInstalled])
  const visibleItem = busy && !submitted ? null : item
  const dismiss = () => { setDismissed(true); installer.reset(); onClose() }
  const info = visibleItem?.installInfo
  const targets = installChoices(info?.targets ?? [])
  const chosen = targets.filter((_, i) => selected.includes(i))
  const available = info?.mode === 'command' && targets.length > 0
  const showResult = submitted || busy || !item
  const needsApproval = showResult && state.phase === 'failed' && state.pendingBuilds.length > 0
  const finished = showResult && state.phase === 'done'
  const canDismiss = !busy || state.phase === 'unknown'
  const start = () => { if (chosen.length) { setSubmitted(true); void installer.start(chosen.map(target => target.install)) } }
  const outcome = state.application as 'applied' | 'restart-required' | 'overridden' | 'cancelled' | undefined
  const reviewTargets = showResult && !busy ? installedReviewTargets(state) : []
  return <dialog ref={dialog} className="dsh_market_directPanel" aria-labelledby={id}
    onCancel={e => { e.preventDefault(); if (canDismiss && !reviewBusy) dismiss() }}>
    <div className="dsh_market_directHead">
      <div className="dsh_market_installHeading">
        <span>{t('direct.title')}</span>
        <h3 id={id}>{visibleItem?.name || state.spec || t('direct.title')}</h3>
      </div>
      {canDismiss && <button type="button" disabled={reviewBusy} className="dsh_market_directClose" aria-label={t('direct.close')} onClick={dismiss}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>}
    </div>
    {showResult && <div className="dsh_market_installStatus" role="status" aria-live="polite">
      <strong>{needsApproval ? t('direct.authorization') : finished && state.queue.length > 1 ? t('direct.batchDone') : finished && outcome ? t(`direct.${outcome}`) : t(`direct.${state.phase}`)}</strong>
      {needsApproval && <>
        <p>{t('direct.buildHint')}</p>
        <ul className="dsh_market_buildList">{state.pendingBuilds.map(name => <li key={name}>{name}</li>)}</ul>
      </>}
      {state.message && <details className="dsh_market_installDiagnostic"><summary>{t('direct.diagnostic')}</summary><pre className="dsh_market_directMessage">{state.message}</pre></details>}
    </div>}
    {showResult && state.queue.length > 1 && <ul className="dsh_market_installQueue" aria-label={t('direct.progress')}>
      {state.queue.map(entry => <li key={entry.spec}>
        <span>{installLabel(entry.spec)}</span>
        <small>{entry.phase === 'idle' ? t('direct.notStarted') : entry.application && entry.application !== 'failed'
          ? t(`direct.${entry.application as 'applied' | 'restart-required' | 'overridden' | 'cancelled'}`) : t(`direct.${entry.phase}`)}</small>
        {entry.message && entry.spec !== state.spec && <details><summary>{t('direct.diagnostic')}</summary><pre className="dsh_market_directMessage">{entry.message}</pre></details>}
      </li>)}
    </ul>}
    {visibleItem && !available && <p className="dsh_market_installUnavailable">{t('direct.noTarget')}</p>}
    {visibleItem && !available && info?.manual && <p className="dsh_market_installUnavailable">{info.manual}</p>}
    {visibleItem && available && !showResult && targets.length > 1 && <fieldset className="dsh_market_installChoices" disabled={busy || showResult}>
      <legend>{t('direct.target')}</legend><p>{t('direct.multiHint')}</p>
      {targets.map((entry, i) => <label key={entry.install} className="dsh_market_installChoice">
        <input type="checkbox" name={`${id}-component`} value={i} checked={selected.includes(i)}
          onChange={() => { setSelected(previous => previous.includes(i) ? previous.filter(index => index !== i) : [...previous, i]); setSubmitted(false) }} />
        <span>{installLabel(entry.install)}</span>
      </label>)}
    </fieldset>}
    {visibleItem && <details className="dsh_market_installDetails" key={visibleItem.fullName} open>
      <summary>{t('direct.more')}</summary>
      {chosen.map(target => <div key={target.install}><code>{target.install}</code>{target.note && <p>{target.note}</p>}</div>)}
      {info?.requirements.length ? <ul>{info.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
      {info?.note && <p>{info.note}</p>}
    </details>}
    {reviewTargets.length > 0 && <div className="dsh_market_installStatus">
      <strong>{t('audit.targets')}</strong>
      <p>{t('audit.hint')}</p>
      {reviewMessage && <p role="status">{reviewMessage}</p>}
      <button type="button" className="dsh_market_ghost" disabled={reviewBusy || !reviewAvailable}
        title={!reviewAvailable ? t('install.profilePending') : undefined}
        onClick={() => { void onReview(reviewTargets).then(ok => { if (ok) dismiss() }) }}>
        {reviewBusy ? t('installing') : t('audit.action')}
      </button>
    </div>}
    <fieldset className="dsh_market_installFooter" disabled={reviewBusy}>
      {needsApproval ? <>
        <button type="button" className="dsh_market_ghost" onClick={dismiss}>{t('direct.decline')}</button>
        <button type="button" className="dsh_market_primary" onClick={() => { void installer.approve() }}>{t('direct.allowContinue')}</button>
      </> : finished ? <button type="button" className="dsh_market_primary" onClick={dismiss}>{t('direct.finish')}</button>
        : state.phase === 'unknown' ? <button type="button" className="dsh_market_primary" onClick={() => { void installer.recover() }}>{t('direct.recover')}</button>
        : busy ? <button type="button" className="dsh_market_ghost" disabled={state.phase !== 'installing'} onClick={() => { void installer.cancel() }}>{t('direct.cancel')}</button>
        : (available || (showResult && state.phase === 'failed')) ? <button type="button" className="dsh_market_primary" disabled={!chosen.length && !showResult} onClick={showResult && state.phase === 'failed' ? () => { void installer.retry() } : start}>{showResult && state.phase === 'failed' ? t('direct.retry') : `${t('direct.confirm')}${chosen.length > 1 ? ` (${chosen.length})` : ''}`}</button>
        : <>
          {visibleItem && <a className="dsh_market_link" href={visibleItem.url} target="_blank" rel="noreferrer">{t('repo')}</a>}
          <button type="button" className="dsh_market_ghost" onClick={dismiss}>{t('direct.close')}</button>
        </>}
    </fieldset>
  </dialog>
}
