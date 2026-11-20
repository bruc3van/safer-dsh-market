import { MarketButton } from './MarketButton.tsx'
import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { IconCloseOutlineRegular, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarketPlugin } from '../contract.ts'
import type { MarketLocale } from './copy.ts'
import { installChoices, installLabel } from './installTargets.ts'
import type { DirectInstaller } from './directInstall.ts'
import { installedReviewTargets, type ReviewTarget } from './reviewPrompt.ts'
import { PluginLogo } from './PluginLogo.tsx'

/** One shared installation remains observable if the recommendation page remounts. */
export function DirectInstallPanel({ item, installer, t, onClose, onInstalled, onReview, onAgentInstall, reviewBusy, reviewAvailable, reviewMessage }: {
  item: MarketPlugin | null; installer: DirectInstaller; t: MarketLocale
  onClose: () => void; onInstalled: () => void
  onReview: (targets: ReviewTarget[]) => Promise<boolean>
  onAgentInstall?: () => void
  reviewBusy: boolean; reviewAvailable: boolean; reviewMessage: string
}) {
  const state = useSyncExternalStore(installer.subscribe, installer.getSnapshot)
  const [selected, setSelected] = useState<number[]>([0])
  const [submitted, setSubmitted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const id = useId()
  const open = !dismissed && (item !== null || state.phase !== 'idle')
  const busy = ['checking', 'installing', 'cancelling', 'unknown'].includes(state.phase)
  useEffect(() => { setSelected([0]); setSubmitted(false); if (item) setDismissed(false) }, [item])
  useEffect(() => { if (state.phase === 'done' || state.phase === 'unavailable') onInstalled() }, [state, onInstalled])
  const visibleItem = busy && !submitted ? null : item
  const dismiss = () => { setDismissed(true); installer.reset(); onClose() }
  const info = visibleItem?.installInfo
  const targets = installChoices(info?.targets ?? [])
  const chosen = targets.filter((_, i) => selected.includes(i))
  const available = info?.mode === 'command' && targets.length > 0
  const manual = available ? '' : info?.manual
  const showDetails = chosen.length > 0 || Boolean(info?.requirements.length || info?.note || manual)
  const showResult = submitted || busy || state.phase === 'unavailable' || !item
  const needsApproval = showResult && state.phase === 'failed' && state.pendingBuilds.length > 0
  const finished = showResult && state.phase === 'done'
  const canDismiss = !busy || state.phase === 'unknown'
  const start = () => { if (chosen.length) { setSubmitted(true); void installer.start(chosen.map(target => target.install)) } }
  const outcome = state.application as 'applied' | 'restart-required' | 'overridden' | 'cancelled' | undefined
  const reviewTargets = showResult && !busy ? installedReviewTargets(state) : []
  const english = t('lang') === 'en'
  const description = english ? visibleItem?.descriptionEn || visibleItem?.description : visibleItem?.description
  const heading = (english ? visibleItem?.titleEn : visibleItem?.titleZh) || visibleItem?.name || state.spec || t('direct.title')
  return <Modal open={open} headless title={heading} className="dsh_market_modal"
    onClose={() => { if (canDismiss && !reviewBusy) dismiss() }}>
  <div className="dsh_market_directPanel">
    <div className="dsh_market_directHead">
      {visibleItem && <PluginLogo src={visibleItem.icon} name={visibleItem.name} fullName={visibleItem.fullName} />}
      <div className="dsh_market_installHeading">
        <span>{t('direct.title')}</span>
        <h3>{heading}</h3>
        {visibleItem && <small>{visibleItem.packageName || visibleItem.fullName}</small>}
      </div>
      {canDismiss && <button type="button" disabled={reviewBusy} className="dsh_market_directClose" aria-label={t('direct.close')} onClick={dismiss}>
        <IconCloseOutlineRegular size={16} />
      </button>}
    </div>
    {visibleItem && !showResult && description && <p className="dsh_market_installSummary">{description}</p>}
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
    {visibleItem && !available && <div className="dsh_market_installUnavailable">
      <p>{t('direct.noTarget')}</p>
      <p>{t('direct.agentHint')}</p>
      {reviewMessage && <p role="status">{reviewMessage}</p>}
    </div>}
    {visibleItem && available && !showResult && targets.length > 1 && <fieldset className="dsh_market_installChoices" disabled={busy || showResult}>
      <legend>{t('direct.target')}</legend><p>{t('direct.multiHint')}</p>
      {targets.map((entry, i) => <label key={entry.install} className="dsh_market_installChoice">
        <input type="checkbox" name={`${id}-component`} value={i} checked={selected.includes(i)}
          onChange={() => { setSelected(previous => previous.includes(i) ? previous.filter(index => index !== i) : [...previous, i]); setSubmitted(false) }} />
        <span>{installLabel(entry.install)}</span>
      </label>)}
    </fieldset>}
    {visibleItem && showDetails && <details className="dsh_market_installDetails" key={visibleItem.packageName || visibleItem.fullName} open={available}>
      <summary>{t('direct.more')}<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></summary>
      <div className="dsh_market_installDetailsBody">
        {chosen.map(target => <div key={target.install} className="dsh_market_installTarget"><code>{target.install}</code>{target.note && <p>{target.note}</p>}</div>)}
        {info?.requirements.length ? <ul className="dsh_market_installRequirements">{info.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
        {info?.note && <p>{info.note}</p>}
        {manual && <p>{manual}</p>}
      </div>
    </details>}
    {reviewTargets.length > 0 && <div className="dsh_market_installStatus">
      <strong>{t('audit.targets')}</strong>
      {reviewMessage && <p role="status">{reviewMessage}</p>}
      <MarketButton intent="secondary" disabled={reviewBusy || !reviewAvailable}
        title={!reviewAvailable ? t('install.profilePending') : undefined}
        onClick={() => { void onReview(reviewTargets).then(ok => { if (ok) dismiss() }) }}>
        {reviewBusy ? t('installing') : t('audit.action')}
      </MarketButton>
    </div>}
    <fieldset className="dsh_market_installFooter" disabled={reviewBusy}>
      {needsApproval ? <>
        <MarketButton size="md" intent="secondary" onClick={dismiss}>{t('direct.decline')}</MarketButton>
        <MarketButton size="md" intent="primary" onClick={() => { void installer.approve() }}>{t('direct.allowContinue')}</MarketButton>
      </> : finished ? <MarketButton size="md" intent="primary" onClick={dismiss}>{t('direct.finish')}</MarketButton>
        : state.phase === 'unavailable' ? <MarketButton size="md" intent="primary" onClick={dismiss}>{t('direct.finishUnconfirmed')}</MarketButton>
        : state.phase === 'unknown' ? <MarketButton size="md" intent="primary" onClick={() => { void installer.recover() }}>{t('direct.recover')}</MarketButton>
        : busy ? <MarketButton size="md" intent="secondary" disabled={state.phase !== 'installing'} onClick={() => { void installer.cancel() }}>{t('direct.cancel')}</MarketButton>
        : (available || (showResult && state.phase === 'failed')) ? <>
          <MarketButton size="md" intent="secondary" onClick={dismiss}>{t(showResult ? 'direct.close' : 'direct.dismiss')}</MarketButton>
          <MarketButton size="md" intent="primary" disabled={!chosen.length && !showResult} onClick={showResult && state.phase === 'failed' ? () => { void installer.retry() } : start}>{showResult && state.phase === 'failed' ? t('direct.retry') : `${t('direct.confirm')}${chosen.length > 1 ? ` (${chosen.length})` : ''}`}</MarketButton>
        </>
        : <>
          {visibleItem && <a className="dsh_market_link" href={visibleItem.url} target="_blank" rel="noreferrer">{t(visibleItem.fullName ? 'repo' : 'package.page')}</a>}
          <MarketButton size="md" intent="secondary" onClick={dismiss}>{t('direct.close')}</MarketButton>
          {visibleItem && onAgentInstall && <MarketButton size="md" intent="primary" disabled={reviewBusy}
            onClick={() => { if (canDismiss) onAgentInstall() }}>{reviewBusy ? t('installing') : t('direct.agentInstall')}</MarketButton>}
        </>}
    </fieldset>
  </div>
  </Modal>
}
