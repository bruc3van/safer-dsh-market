import { useEffect, useId, useRef } from 'react'
import type { MarketLocale } from './copy.ts'
import type { PluginUpdater, UpdateState } from './pluginUpdates.ts'

/** Checking is read-only; only the version confirmation invokes updateBundle. */
export function PluginUpdatePanel({ open, state, updater, t, onClose }: {
  open: boolean; state: UpdateState; updater: PluginUpdater; t: MarketLocale; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  const updating = state.phase === 'updating'
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  const close = () => { if (!updating) { updater.close(); onClose() } }
  const selected = state.choices.find(version => version.version === state.selected)
  const result = state.result
  const restore = result?.restore
  return <dialog ref={dialog} className="dsh_market_directPanel" aria-labelledby={id}
    onCancel={event => { event.preventDefault(); close() }}>
    <div className="dsh_market_directHead">
      <div className="dsh_market_installHeading"><span>{t('update.title')}</span><h3 id={id}>{state.packageName}</h3></div>
      <button type="button" className="dsh_market_directClose" disabled={updating} aria-label={t('direct.close')} onClick={close}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
    {result ? <p>{t('update.transition', { from: result.from, to: result.to })}</p>
      : state.installed && <p>{t('update.installed', { version: state.installed })}</p>}
    {state.phase === 'checking' && <p role="status" aria-busy="true">{t('update.checking')}</p>}
    {state.phase === 'ready' && <>
      <p>{t(state.choices.length ? 'update.available' : state.kind === 'git' ? 'update.noGitUpdate' : 'update.latest')}</p>
      <fieldset className="dsh_market_installChoices">
        {state.choices.length > 0 && <legend>{t('update.choose')}</legend>}
        {state.choices.map(choice => <label className="dsh_market_installChoice" key={choice.version}>
          <input type="radio" name={id} value={choice.version} checked={choice.version === state.selected} disabled={!!choice.blocked}
            onChange={() => updater.select(choice.version)} />
          <span><strong>{choice.version}</strong>
            {choice.prerelease && <> · {t('update.prerelease')}</>}
            {choice.deprecated !== undefined && <p>{t('update.deprecated', { reason: choice.deprecated })}</p>}
            {choice.blocked && <p>{t('update.blocked', { reason: choice.blocked })}</p>}
          </span>
        </label>)}
      </fieldset>
      {state.omitted > 0 && <p>{t('update.omitted', { count: String(state.omitted) })}</p>}
      {selected && <>
        <p>{t('update.confirm', { from: state.installed, to: selected.version })}</p>
        <p>{t('update.source')}: {'registry' in selected.source ? selected.source.registry ?? t('update.defaultRegistry') : selected.source.spec}</p>
        <p>{t('update.notice')}</p>
      </>}
    </>}
    {updating && <p role="status" aria-busy="true">{t(`update.${state.step ?? 'checking'}`)}</p>}
    {state.phase === 'unknown' && <p role="alert">{t('update.unknown')} {state.message}</p>}
    {state.phase === 'error' && <p role="alert">{t('update.failed', { reason: state.message })}</p>}
    {state.phase === 'done' && result && <>
      <p role="status">{t(result.result.application === 'failed' ? 'update.failedResult' : `update.${result.result.application}`)}</p>
      {restore && <p>{t(restore.application === 'applied' ? 'update.restored' : restore.application === 'restart-required' ? 'update.restoreRestart' : 'update.restoreFailed')}</p>}
      <details className="dsh_market_installDetails"><summary>{t('direct.diagnostic')}</summary>
        <pre className="dsh_market_directMessage">{JSON.stringify(result, null, 2).slice(-12000)}</pre>
      </details>
    </>}
    {state.warnings.length > 0 && <p role="alert">{t('update.partial')} {state.warnings.join('\n')}</p>}
    <div className="dsh_market_updateActions">
      {state.phase === 'ready' && state.selected && <button type="button" className="dsh_market_primary" onClick={() => { void updater.confirm() }}>{t('update.action')}</button>}
      {!updating && state.phase !== 'checking' && <button type="button" className="dsh_market_ghost" onClick={() => { void updater.check(state.packageName) }}>{t('update.recheck')}</button>}
      <button type="button" className="dsh_market_ghost" disabled={updating} onClick={close}>{t('direct.close')}</button>
    </div>
  </dialog>
}
