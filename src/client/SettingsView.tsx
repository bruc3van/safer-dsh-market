import { useEffect, useId, useRef, useState, type ReactElement } from 'react'
import type { SafeMarketSettings, SafeMarketSettingsUpdate } from '../contract.ts'
import type { MarketLocale } from './copy.ts'

export interface SettingsViewProps {
  readonly t: MarketLocale
  readonly settings: SafeMarketSettings
  readonly settingsReady: boolean
  readonly updateSettings?: (update: SafeMarketSettingsUpdate) => Promise<SafeMarketSettings>
  readonly onTryAssistant?: () => void
  readonly tryBusy?: boolean
  readonly tryMessage?: string
}

/** Built-in settings tab for toggling the AI assistant and online catalog access. */
export function SettingsView({
  t,
  settings,
  settingsReady,
  updateSettings,
  onTryAssistant,
  tryBusy = false,
  tryMessage = '',
}: SettingsViewProps): ReactElement {
  const [busyField, setBusyField] = useState<SafeMarketSettingsUpdate['field'] | null>(null)
  const [error, setError] = useState('')
  const baseId = useId()
  const aiHeadingId = `${baseId}-ai`
  const catalogHeadingId = `${baseId}-catalog`
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const toggle = (field: SafeMarketSettingsUpdate['field'], next: boolean): void => {
    if (!updateSettings || busyField !== null) return
    setBusyField(field)
    setError('')
    void updateSettings({ field, value: next }).then(
      () => { if (mounted.current) setBusyField(null) },
      (cause: unknown) => {
        if (!mounted.current) return
        setBusyField(null)
        setError(t('settings.saveFailed', { reason: cause instanceof Error ? cause.message : String(cause) }))
      },
    )
  }

  const controlsDisabled = !settingsReady || !updateSettings || busyField !== null

  return (
    <div className="dsh_market_page dsh_market_settingsPage">
      <div className="dsh_market_settingsIntro">
        <h3 className="dsh_market_settingsTitle">{t('settings.title')}</h3>
        <p className="dsh_market_settingsDesc">{t('settings.subtitle')}</p>
      </div>

      {error !== '' && <p className="dsh_market_status" data-error="true" role="alert">{error}</p>}
      {!updateSettings && <p className="dsh_market_status">{t('settings.unavailable')}</p>}

      <section className="dsh_market_settingCard" aria-labelledby={aiHeadingId}>
        <div className="dsh_market_settingHead">
          <div className="dsh_market_settingCopy">
            <div className="dsh_market_settingTitleRow">
              <h4 id={aiHeadingId} className="dsh_market_settingName">{t('settings.ai.title')}</h4>
              <span className="dsh_market_settingState" data-on={settings.aiAssistantEnabled ? 'true' : 'false'}>
                {settings.aiAssistantEnabled ? t('settings.state.on') : t('settings.state.off')}
              </span>
            </div>
            <p className="dsh_market_settingBody">{t('settings.ai.desc')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.aiAssistantEnabled}
            aria-labelledby={aiHeadingId}
            className="dsh_market_switch"
            data-on={settings.aiAssistantEnabled ? 'true' : 'false'}
            disabled={controlsDisabled}
            onClick={() => toggle('aiAssistantEnabled', !settings.aiAssistantEnabled)}
          >
            <span className="dsh_market_switchThumb" aria-hidden="true" />
          </button>
        </div>

        {settings.aiAssistantEnabled && !settings.enabled && (
          <p className="dsh_market_settingWarn">{t('settings.ai.catalogOffHint')}</p>
        )}

        {onTryAssistant && (
          <div className="dsh_market_settingActions">
            <button
              type="button"
              className="dsh_market_primary"
              disabled={!settingsReady || !settings.aiAssistantEnabled || tryBusy}
              onClick={onTryAssistant}
            >
              {tryBusy ? t('installing') : t('settings.ai.try')}
            </button>
            {tryMessage !== '' && <span className="dsh_market_cardNotice">{tryMessage}</span>}
          </div>
        )}
      </section>

      <section className="dsh_market_settingCard" aria-labelledby={catalogHeadingId}>
        <div className="dsh_market_settingHead">
          <div className="dsh_market_settingCopy">
            <div className="dsh_market_settingTitleRow">
              <h4 id={catalogHeadingId} className="dsh_market_settingName">{t('settings.catalog.title')}</h4>
              <span className="dsh_market_settingState" data-on={settings.enabled ? 'true' : 'false'}>
                {settings.enabled ? t('settings.state.on') : t('settings.state.off')}
              </span>
            </div>
            <p className="dsh_market_settingBody">{t('settings.catalog.desc')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            aria-labelledby={catalogHeadingId}
            className="dsh_market_switch"
            data-on={settings.enabled ? 'true' : 'false'}
            disabled={controlsDisabled}
            onClick={() => toggle('enabled', !settings.enabled)}
          >
            <span className="dsh_market_switchThumb" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  )
}
