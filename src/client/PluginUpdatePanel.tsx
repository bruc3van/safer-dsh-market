import { MarketButton } from './MarketButton.tsx'
import { useId } from 'react'
import { IconCloseOutlineRegular, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarketLocale } from './copy.ts'
import type { PluginUpdater, UpdateState } from './pluginUpdates.ts'

/** Checking is read-only; only the version confirmation invokes updateBundle. */
export function PluginUpdatePanel({ open, state, updater, t, onClose }: {
  open: boolean; state: UpdateState; updater: PluginUpdater; t: MarketLocale; onClose: () => void
}) {
  const id = useId()
  const updating = state.phase === 'updating'
  const close = () => { if (!updating) { updater.close(); onClose() } }
  const selected = state.choices.find(version => version.version === state.selected)
  const result = state.result
  const restore = result?.restore
  return <Modal open={open} headless title={`${t('update.title')} · ${state.packageName}`} className="dsh_market_modal" onClose={close}>
  <div className="dsh_market_directPanel">
    <div className="dsh_market_directHead">
      <div className="dsh_market_installHeading"><span>{t('update.title')}</span><h3>{state.packageName}</h3></div>
      <button type="button" className="dsh_market_directClose" disabled={updating} aria-label={t('direct.close')} onClick={close}>
        <IconCloseOutlineRegular size={16} />
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
      {state.phase === 'ready' && state.selected && <MarketButton size="md" intent="primary" onClick={() => { void updater.confirm() }}>{t('update.action')}</MarketButton>}
      {!updating && state.phase !== 'checking' && <MarketButton size="md" intent="secondary" onClick={() => { void updater.check(state.packageName) }}>{t('update.recheck')}</MarketButton>}
      <MarketButton size="md" intent="secondary" disabled={updating} onClick={close}>{t('direct.close')}</MarketButton>
    </div>
  </div>
  </Modal>
}
