import { MarketButton } from './MarketButton.tsx'
import { useEffect, useState, type ReactElement } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { MarketSkill, MarketSkillsResult } from '../contract.ts'
import { watchSkills, type SkillsSessionSource } from './skillsSubscription.ts'
import type { MarketLocale } from './copy.ts'
import { matchesSkill } from './rows.ts'

export const NO_SESSION = 'no-session'
export const SESSIONS_PENDING = 'sessions-pending'

type SkillsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: MarketSkillsResult }
  | { readonly status: 'error'; readonly message: string }

interface SkillsActions {
  listSkills: () => Promise<MarketSkillsResult>
  skillsSession: SkillsSessionSource
  canOpenFolder: () => Promise<boolean>
  openFolder: (path: string) => Promise<void>
}

const origins = ['project', 'user', 'custom', 'bundled', 'other'] as const
type Origin = typeof origins[number]

function originOf(skill: MarketSkill): Origin {
  switch (skill.source) {
    case 'project-dsh':
    case 'project-agents': return 'project'
    case 'user-dsh':
    case 'user-agents': return 'user'
    case 'custom': return 'custom'
    case 'bundled': return 'bundled'
    default: return 'other'
  }
}

export function ProjectSkillsView(props: SkillsActions & PropsLocale<'settings.dshMarketPro'>): ReactElement {
  return <SkillsView {...props} project />
}

export function SkillsView({ t, listSkills, skillsSession, canOpenFolder, openFolder, project = false }:
  SkillsActions & { t: MarketLocale; project?: boolean }): ReactElement {
  const [state, setState] = useState<SkillsState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [origin, setOrigin] = useState<Origin | 'all'>('all')
  const [refresh, setRefresh] = useState(0)
  const [folderAvailable, setFolderAvailable] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let live = true
    void canOpenFolder().then(ok => { if (live) setFolderAvailable(ok) }, () => undefined)
    return () => { live = false }
  }, [canOpenFolder])

  useEffect(() => watchSkills(skillsSession, listSkills, {
    loading: () => {
      setActionError('')
      setState({ status: 'loading' })
    },
    result: result => setState({ status: 'ready', result }),
    error: error => setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
  }), [listSkills, skillsSession, refresh])

  const result = state.status === 'ready' ? state.result : null
  const busy = state.status === 'loading' || result?.error === SESSIONS_PENDING
  const available = result?.error === ''
  const failure = state.status === 'error' ? state.message
    : !busy && result?.error !== NO_SESSION ? result?.error : undefined
  const writerHeld = failure?.startsWith('session/writer-held:')
  const retry = () => setRefresh(value => value + 1)
  const needle = query.trim().toLocaleLowerCase()
  const groups = origins.map(id => ({ id, items: [] as MarketSkill[], total: 0 }))
  for (const skill of result?.skills ?? []) {
    const group = groups[origins.indexOf(originOf(skill))]
    group.total += 1
    if (origin !== 'all' && origin !== group.id) continue
    if (matchesSkill(skill, needle)) group.items.push(skill)
  }
  const count = groups.reduce((sum, group) => sum + group.items.length, 0)

  const openSkillFolder = async (path: string) => {
    setActionError('')
    try {
      await openFolder(path)
    } catch (error) {
      setActionError(t('skills.openFailed', { reason: error instanceof Error ? error.message : String(error) }))
    }
  }

  const refreshButton = !failure ? (
    <button
      className={project ? 'dsh_market_headerAction' : 'dsh_market_headerAction dsh_market_refreshMarket'}
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={retry}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 4v6h-6M20 10a8 8 0 1 0-1.7 7" />
      </svg>
      {busy ? t('refreshing') : t('skills.refresh')}
    </button>
  ) : null

  return (
    <div className={project ? 'dsh_market_projectSkills' : 'dsh_market_page dsh_market_fixedPage'}>
      <div className="dsh_market_controls dsh_market_skillsControls">
        {!project && refreshButton}
        <div className="dsh_market_skillsHeading">
          <h2>{t('skills.title')}</h2>
          {project && refreshButton}
        </div>
        {(available || busy) && (
          <div className="dsh_market_filterBar">
            <div className="dsh_market_scope dsh_market_skillsOrigins" role="group" aria-label={t('skills.origin')}>
              <button className="dsh_market_scopeButton" type="button" aria-pressed={origin === 'all'} onClick={() => setOrigin('all')}>
                {t('skills.origin.all')} {available && <span>{result.skills.length}</span>}
              </button>
              {groups.map(group => (
                <button key={group.id} className="dsh_market_scopeButton" type="button"
                  aria-pressed={origin === group.id} onClick={() => setOrigin(group.id)}>
                  {t(`skills.origin.${group.id}`)} {available && <span>{group.total}</span>}
                </button>
              ))}
            </div>
            <input className="dsh_market_search dsh_market_skillSearch" type="search" spellCheck={false} value={query}
              aria-label={t('skills.search')} placeholder={t('skills.search')} onChange={event => setQuery(event.target.value)} />
          </div>
        )}
      </div>
      <div className={project ? 'dsh_market_projectSkillsResults' : 'dsh_market_results'} aria-busy={busy}>
        {busy && <p className="dsh_market_status" role="status">{t('skills.loading')}</p>}
        {result?.error === NO_SESSION && <p className="dsh_market_status">{t('skills.noSession')}</p>}
        {failure && (
          <div className="dsh_market_notice dsh_market_skillsNotice">
            <div role="alert">
              <h3>{t(writerHeld ? 'skills.writerHeld' : 'skills.failed')}</h3>
              <p className="dsh_market_noticeBody">{t(writerHeld ? 'skills.writerHeldHint' : 'skills.failedHint')}</p>
            </div>
            <MarketButton intent="primary" onClick={retry}>{t('skills.retry')}</MarketButton>
            <details className="dsh_market_installDetails" key={failure}>
              <summary>{t('skills.diagnostic')}<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></summary>
              <pre className="dsh_market_directMessage">{failure}</pre>
            </details>
          </div>
        )}
        {available && !result.complete && <p className="dsh_market_status" role="status" data-error="true">{t('skills.incomplete')}</p>}
        {actionError && <p className="dsh_market_status" role="alert" data-error="true">{actionError}</p>}
        {available && (
          <p className="dsh_market_status" role="status">
            {count > 0 ? t('skills.count', { count: String(count) })
              : origin === 'project' && groups[0].total === 0 && result.complete ? t('skills.noProject')
                : result.skills.length === 0 && result.complete ? t('skills.empty') : t('skills.noMatches')}
          </p>
        )}
        {groups.filter(group => group.items.length > 0).map(group => (
          <section key={group.id} className="dsh_market_skillGroup" aria-label={t(`skills.origin.${group.id}`)}>
            <h3>{t(`skills.origin.${group.id}`)}</h3>
            <ul className="dsh_market_cards dsh_market_skillCards">
              {group.items.map(skill => {
                const { sourcePath } = skill
                const source = skill.sourceDirectory ?? skill.provider
                return (
                  <li key={skill.name} className="dsh_market_card dsh_market_skillCard">
                    <div className="dsh_market_head">
                      <span className="dsh_market_name">{skill.name}</span>
                    </div>
                    <div className="dsh_market_meta dsh_market_skillBadges">
                      {skill.modelInvocable && <span className="dsh_market_categoryTag">{t('skills.model')}</span>}
                      {skill.userInvocable && <span className="dsh_market_categoryTag" title={'/' + skill.name}>{t('skills.user')}</span>}
                      {!skill.modelInvocable && !skill.userInvocable && <span className="dsh_market_categoryTag">{t('skills.invocation.restricted')}</span>}
                    </div>
                    {skill.description && <p className="dsh_market_desc" title={skill.description}>{skill.description}</p>}
                    {skill.whenToUse && <p className="dsh_market_meta">{skill.whenToUse}</p>}
                    <div className="dsh_market_foot dsh_market_skillFooter">
                      <span className="dsh_market_meta dsh_market_skillSource" title={sourcePath ?? source}>{source}</span>
                      {folderAvailable && sourcePath && (
                        <button type="button" className="dsh_market_folderButton" aria-label={t('skills.openFolder') + ' ' + skill.name}
                          title={t('skills.openFolder') + ' · ' + sourcePath}
                          onClick={() => void openSkillFolder(sourcePath)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2.2h8.7A1.5 1.5 0 0 1 21 8.7v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.7z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
