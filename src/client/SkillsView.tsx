/**
 * The Skills page of the marketplace section: what the current session can
 * actually resolve right now.
 *
 * Read-only, and it needs neither the market switch nor the network. It is
 * addressed by the open session because skill discovery is layered by the
 * agent preset that session runs — a deployment-wide read would report "none"
 * to a user with plenty. Incomplete discovery is shown rather than smoothed
 * over: a short list that looks whole is a wrong answer, not a tidy one.
 */
import { useEffect, useState, type ReactElement } from 'react'
import type { MarketSkillsResult } from '../contract.ts'
import { watchSkills, type SkillsSessionSource } from './skillsSubscription.ts'
import type { MarketLocale } from './copy.ts'
import { matchesSkill } from './rows.ts'

/** The reader's sentinel for "nothing to address" (see client/index.ts). */
export const NO_SESSION = 'no-session'

/** The reader's sentinel for "the session list has not landed yet". */
export const SESSIONS_PENDING = 'sessions-pending'

/** Loading, failed, or answered. */
type SkillsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: MarketSkillsResult }
  | { readonly status: 'error'; readonly message: string }

/** The Skills page. */
export function SkillsView({ t, listSkills, skillsSession, canOpenFolder, openFolder }: {
  t: MarketLocale
  listSkills: () => Promise<MarketSkillsResult>
  skillsSession: SkillsSessionSource
  canOpenFolder: () => Promise<boolean>
  openFolder: (path: string) => Promise<void>
}): ReactElement {
  const [state, setState] = useState<SkillsState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  // A deployment without a desktop (a headless or remote Host) has nowhere to
  // open a folder, so the icon only appears once the Host says it can.
  const [folderAvailable, setFolderAvailable] = useState(false)
  const [folderError, setFolderError] = useState('')

  useEffect(() => {
    let live = true
    void canOpenFolder().then(ok => { if (live) setFolderAvailable(ok) }, () => undefined)
    return () => { live = false }
  }, [canOpenFolder])

  const open = (path: string): void => {
    setFolderError('')
    void openFolder(path).catch((error: unknown) => {
      setFolderError(t('skills.openFailed', { reason: error instanceof Error ? error.message : String(error) }))
    })
  }

  useEffect(() => watchSkills(skillsSession, listSkills, {
    loading: () => setState({ status: 'loading' }),
    result: result => setState({ status: 'ready', result }),
    error: error => setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
  }), [listSkills, skillsSession])

  const result = state.status === 'ready' ? state.result : null
  // Normalised once, not once per skill.
  const needle = query.trim().toLocaleLowerCase()
  const shown = result === null
    ? []
    : result.skills.filter(skill => matchesSkill(skill, needle))

  return (
    <div className="dsh_market_page dsh_market_fixedPage">
      <div className="dsh_market_controls">
      <p className="dsh_market_skillsTitle">{t('skills.title')}</p>

      {result !== null && result.skills.length > 0 && (
        <div className="dsh_market_bar dsh_market_dockable">
          <input
            className="dsh_market_search"
            type="search"
            spellCheck={false}
            placeholder={t('skills.search')}
            value={query}
            onChange={(event) => { setQuery(event.target.value) }}
          />
        </div>
      )}

      </div>
      <div className="dsh_market_results">
      {state.status === 'loading' || (result !== null && result.error === SESSIONS_PENDING)
        ? (
          <div className="dsh_market_notice" aria-busy="true" aria-live="polite">
            <p className="dsh_market_noticeBody">{t('skills.loading')}</p>
          </div>
          )
        : (
          <p className="dsh_market_status" data-error={state.status === 'error' || (result !== null && result.error !== '' && result.error !== NO_SESSION) ? 'true' : undefined}>
            {state.status === 'error'
              ? t('skills.failed', { reason: state.message })
              : result !== null && result.error === NO_SESSION
                ? t('skills.noSession')
                : result !== null && result.error !== ''
                  ? t('skills.failed', { reason: result.error })
                  : shown.length === 0
                    ? t('skills.empty')
                    : t('skills.count', { count: String(shown.length) })}
          </p>
          )}

      {folderError !== '' && <p className="dsh_market_status" data-error="true">{folderError}</p>}

      {result !== null && !result.complete && result.error === '' && (
        <p className="dsh_market_status" data-error="true">{t('skills.incomplete')}</p>
      )}

      {shown.length > 0 && (
        <ul className="dsh_market_cards">
          {shown.map(skill => (
            <li key={skill.name} className="dsh_market_card">
              <div className="dsh_market_head">
                <span className="dsh_market_name" title={skill.name}>{skill.name}</span>
              </div>
              <p className="dsh_market_meta dsh_market_skillSource" title={skill.sourceDirectory}>
                {skill.sourceDirectory
                  ? t('skills.provider', { provider: skill.sourceDirectory })
                  : t('skills.sourceUnavailable')}
                {folderAvailable && skill.sourcePath !== undefined && (
                  <button
                    type="button"
                    className="dsh_market_folderButton"
                    aria-label={`${t('skills.openFolder')}: ${skill.sourcePath}`}
                    title={`${t('skills.openFolder')}: ${skill.sourcePath}`}
                    onClick={() => { open(skill.sourcePath!) }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2.2h8.7A1.5 1.5 0 0 1 21 8.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
                    </svg>
                  </button>
                )}
              </p>
              {skill.description !== '' && <p className="dsh_market_desc">{skill.description}</p>}
              {skill.whenToUse !== '' && <p className="dsh_market_meta">{skill.whenToUse}</p>}
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  )
}
