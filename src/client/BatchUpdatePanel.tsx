import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { IconCloseOutlineRegular, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { PACKAGE_NAME } from '../shapes.ts'
import type { MarketLocale } from './copy.ts'
import { MarketButton } from './MarketButton.tsx'
import { shortName } from './owned.ts'
import { orderBatchTargets, type AvailableUpdate, type BatchItemStatus, type BatchUpdateItem, type PluginUpdater, type UpdateState } from './pluginUpdates.ts'

function isSuccessStatus(status: BatchItemStatus): boolean {
  return status === 'applied' || status === 'restart-required'
}

function isFailedStatus(status: BatchItemStatus): boolean {
  return status === 'failed' || status === 'unknown' || status === 'overridden' || status === 'cancelled'
}

function itemTone(status: BatchItemStatus): 'ok' | 'warn' | 'error' | 'active' | 'muted' {
  if (status === 'applied') return 'ok'
  if (status === 'restart-required' || status === 'overridden' || status === 'skipped') return 'warn'
  if (status === 'failed' || status === 'unknown' || status === 'cancelled') return 'error'
  if (status === 'running') return 'active'
  return 'muted'
}

function statusText(t: MarketLocale, item: BatchUpdateItem): string {
  if (item.status === 'running') return t(`update.${item.step ?? 'checking'}`)
  return t(`batchUpdate.status.${item.status}`)
}

function restoreText(t: MarketLocale, restore: BatchUpdateItem['restoreApplication']): string {
  if (!restore) return ''
  if (restore === 'applied') return t('update.restored')
  if (restore === 'restart-required') return t('update.restoreRestart')
  return t('update.restoreFailed')
}

/** Three-stage sequential batch updater: confirm list -> run with skip-on-failure -> summary. */
export function BatchUpdatePanel({ open, state, updater, t, onClose }: {
  open: boolean
  state: UpdateState
  updater: PluginUpdater
  t: MarketLocale
  onClose: () => void
}): ReactElement {
  const { batch } = state
  const candidates = useMemo(
    () => orderBatchTargets(Object.values(state.availableDetails), PACKAGE_NAME),
    [state.availableDetails],
  )
  const [selected, setSelected] = useState<readonly string[]>([])
  const initializedSelection = useRef(false)

  useEffect(() => {
    if (!open || batch.phase !== 'idle') {
      initializedSelection.current = false
      return
    }
    if (!initializedSelection.current) {
      initializedSelection.current = true
      setSelected(candidates.map(item => item.packageName))
    }
  }, [open, batch.phase, candidates])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const chosenCount = candidates.filter(item => selectedSet.has(item.packageName)).length
  const running = batch.phase === 'running'

  const close = () => {
    if (running) {
      onClose()
      return
    }
    updater.resetBatch()
    onClose()
  }

  const toggle = (packageName: string) => {
    setSelected(previous => (
      previous.includes(packageName)
        ? previous.filter(name => name !== packageName)
        : [...previous, packageName]
    ))
  }

  const start = () => {
    const targets = candidates.filter(item => selectedSet.has(item.packageName))
    if (targets.length > 0) void updater.startBatch(targets, PACKAGE_NAME)
  }

  const total = batch.items.length
  const succeeded = batch.items.filter(item => isSuccessStatus(item.status)).length
  const failed = batch.items.filter(item => isFailedStatus(item.status)).length
  const skipped = batch.items.filter(item => item.status === 'skipped').length
  const finishedCount = succeeded + failed + skipped
  const remaining = Math.max(0, total - finishedCount)
  const restartCount = batch.items.filter(
    item => item.status === 'restart-required' || item.restoreApplication === 'restart-required',
  ).length
  const retryableTargets: AvailableUpdate[] = batch.items
    .filter(item => (item.status === 'failed' || item.status === 'unknown' || item.status === 'cancelled')
      && state.availableDetails[item.packageName] !== undefined)
    .map(item => ({
      packageName: item.packageName,
      installed: item.from,
      version: item.to,
      kind: item.kind,
      source: item.source,
    }))
  const currentStepNumber = batch.currentIndex >= 0 ? Math.min(total, batch.currentIndex + 1) : total
  const percent = total > 0 ? Math.round((finishedCount / total) * 100) : 0

  const title = batch.phase === 'running'
    ? t('batchUpdate.runningTitle', { current: String(currentStepNumber), total: String(total) })
    : batch.phase === 'done'
      ? t('batchUpdate.doneTitle')
      : t('batchUpdate.title')

  return (
    <Modal open={open} headless title={title} className="dsh_market_modal" onClose={close}>
      <div className="dsh_market_directPanel dsh_market_updateDialog">
        <div className="dsh_market_directHead">
          <div className="dsh_market_installHeading">
            <span>{t('update.title')}</span>
            <h3>{title}</h3>
          </div>
          <button type="button" className="dsh_market_directClose" aria-label={t('direct.close')} onClick={close}>
            <IconCloseOutlineRegular size={16} />
          </button>
        </div>

        <div className="dsh_market_updateBody">
          {batch.phase === 'idle' && (
            <>
              <p>{t('batchUpdate.subtitle')}</p>
              {candidates.length > 0 ? (
                <fieldset className="dsh_market_installChoices">
                  <div className="dsh_market_updateChoiceList">
                    {candidates.map(item => {
                      const isSelf = item.packageName === PACKAGE_NAME
                      return (
                        <label className="dsh_market_installChoice dsh_market_batchChoice" key={item.packageName}>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(item.packageName)}
                            onChange={() => toggle(item.packageName)}
                          />
                          <span className="dsh_market_batchChoiceMain">
                            <span className="dsh_market_batchNameRow">
                              <strong title={item.packageName}>{shortName(item.packageName)}</strong>
                              {isSelf && <em className="dsh_market_updateBadge">{t('batchUpdate.selfLast')}</em>}
                            </span>
                            <small className="dsh_market_batchTransition">
                              {item.installed ? `v${item.installed} → v${item.version}` : `v${item.version}`}
                            </small>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ) : (
                <p>{t('update.latest')}</p>
              )}
              <p>{t('update.notice')}</p>
            </>
          )}

          {batch.phase === 'running' && (
            <>
              <div className="dsh_market_batchProgress">
                <div className="dsh_market_batchProgressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                  <div className="dsh_market_batchProgressFill" style={{ width: `${String(percent)}%` }} />
                </div>
                <p className="dsh_market_batchProgressText" role="status" aria-live="polite">
                  {t('batchUpdate.progress', { done: String(succeeded), failed: String(failed), remaining: String(remaining) })}
                </p>
              </div>
              <ul className="dsh_market_installQueue dsh_market_batchQueue" aria-label={t('batchUpdate.title')}>
                {batch.items.map(item => (
                  <li key={item.packageName}>
                    <div className="dsh_market_batchRowHead">
                      <span className="dsh_market_batchRowName" title={item.packageName}>
                        <strong>{shortName(item.packageName)}</strong>
                        {item.self && <em className="dsh_market_updateBadge">{t('batchUpdate.selfLast')}</em>}
                      </span>
                      <span className="dsh_market_batchState" data-tone={itemTone(item.status)}>
                        {statusText(t, item)}
                      </span>
                    </div>
                    <small>{item.from ? `v${item.from} → v${item.to}` : `v${item.to}`}</small>
                  </li>
                ))}
              </ul>
            </>
          )}

          {batch.phase === 'done' && (
            <>
              <div className="dsh_market_installStatus" role="status" aria-live="polite">
                <strong>
                  {skipped > 0
                    ? t('batchUpdate.summarySkipped', { total: String(total), succeeded: String(succeeded), failed: String(failed), skipped: String(skipped) })
                    : t('batchUpdate.summary', { total: String(total), succeeded: String(succeeded), failed: String(failed) })}
                </strong>
                {restartCount > 0 && <p>{t('batchUpdate.restartHint', { count: String(restartCount) })}</p>}
              </div>
              <ul className="dsh_market_installQueue dsh_market_batchQueue" aria-label={t('batchUpdate.doneTitle')}>
                {batch.items.map(item => {
                  const hasDiagnostic = isFailedStatus(item.status) && (item.message || item.result)
                  const restore = restoreText(t, item.restoreApplication)
                  return (
                    <li key={item.packageName}>
                      <div className="dsh_market_batchRowHead">
                        <span className="dsh_market_batchRowName" title={item.packageName}>
                          <strong>{shortName(item.packageName)}</strong>
                          {item.self && <em className="dsh_market_updateBadge">{t('batchUpdate.selfLast')}</em>}
                        </span>
                        <span className="dsh_market_batchState" data-tone={itemTone(item.status)}>
                          {statusText(t, item)}
                        </span>
                      </div>
                      <small>
                        {item.from ? `v${item.from} → v${item.to}` : `v${item.to}`}
                        {restore !== '' && ` · ${restore}`}
                      </small>
                      {hasDiagnostic && (
                        <details className="dsh_market_installDiagnostic">
                          <summary>{t('direct.diagnostic')}</summary>
                          <pre className="dsh_market_directMessage">
                            {item.result ? JSON.stringify(item.result, null, 2).slice(-8000) : item.message}
                          </pre>
                        </details>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <div className="dsh_market_updateActions">
          {batch.phase === 'idle' && (
            <>
              <MarketButton size="md" intent="secondary" onClick={close}>{t('direct.dismiss')}</MarketButton>
              <MarketButton size="md" intent="primary" disabled={chosenCount === 0} onClick={start}>
                {t('batchUpdate.start', { count: String(chosenCount) })}
              </MarketButton>
            </>
          )}
          {batch.phase === 'running' && (
            <MarketButton
              size="md"
              intent="secondary"
              disabled={batch.stopRequested}
              onClick={() => updater.requestStopBatch()}
            >
              {batch.stopRequested ? t('batchUpdate.stopping') : t('batchUpdate.stopAfter')}
            </MarketButton>
          )}
          {batch.phase === 'done' && (
            <>
              {retryableTargets.length > 0 && (
                <MarketButton size="md" intent="secondary" onClick={() => { void updater.startBatch(retryableTargets, PACKAGE_NAME) }}>
                  {t('batchUpdate.retryFailed', { count: String(retryableTargets.length) })}
                </MarketButton>
              )}
              <MarketButton size="md" intent="primary" onClick={close}>{t('direct.finish')}</MarketButton>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
