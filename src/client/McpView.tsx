/**
 * The MCP page: every MCP server this Host runs, one card each.
 *
 * Managed servers come from the official `dsh-mcp-manager` (status streamed
 * live, configuration written through Settings, secrets kept in the
 * credential store). Static `dsh-mcp-client` rows the manager cannot govern
 * are listed below them, read-only, so the page never claims "no servers" on
 * a machine that runs several. All state and I/O live in ./mcpController.ts;
 * the rules this view renders from live in ./mcpModel.ts.
 */
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import type { McpToolGroup, McpUnmanagedServer } from '../contract.ts'
import type { MarketLocale } from './copy.ts'
import { staticKey, type McpController, type McpProbeState, type McpSnapshot } from './mcpController.ts'
import {
  canProbe, canRestart, commandLine, commandRisks, convertToCredential, draftFromEntry, draftPlaintext, emptyDraft,
  isConfigured, isEnabled, pendingToStore, splitCommandLine, statusError, statusKind, suggestRef, summarize, targetOf,
  transportOf, validateDraft,
  type McpDraft, type McpDraftError, type McpPair, type McpRow, type McpStatus,
} from './mcpModel.ts'

type Filter = 'all' | 'connected' | 'issue' | 'disabled'

/** Above this many connected tools, the page notes the context cost. */
const TOOL_HEAVY = 40

/** Translate the controller's fixed reason tokens; pass Host text through. */
function reasonText(t: MarketLocale, raw: string): string {
  switch (raw) {
    case 'settings-unavailable': return t('mcp.reason.settings')
    case 'namespace-missing': return t('mcp.reason.namespace')
    case 'manager-unavailable': return t('mcp.reason.manager')
    case 'credentials-unavailable': return t('mcp.reason.credentials')
    case 'plugins-unavailable': return t('mcp.reason.plugins')
    case 'name-conflict': return t('mcp.reason.nameConflict')
    default: return raw
  }
}

function statusLabel(t: MarketLocale, status: McpStatus | undefined): string {
  if (status === undefined) return t('mcp.state.unknown')
  switch (status.state) {
    case 'connected': return t('mcp.state.connected', { count: String(status.toolCount) })
    case 'connecting': return t('mcp.state.connecting')
    case 'reconnecting': return t('mcp.state.reconnecting', { attempt: String(status.attempt), max: String(status.maxAttempts) })
    case 'waiting-credentials': return t('mcp.state.waiting')
    case 'disabled': return t('mcp.state.disabled')
    case 'closed': return statusKind(status) === 'locked' ? t('mcp.state.locked') : t('mcp.state.closed')
    case 'failed':
      switch (status.reason) {
        case 'gave-up': return t('mcp.state.gaveUp')
        case 'reconnect-disabled': return t('mcp.state.reconnectDisabled')
        case 'load': return t('mcp.state.load')
        default: return t('mcp.state.locked')
      }
  }
}

function transportLabel(t: MarketLocale, transport: string): string {
  return transport === 'stdio' ? t('mcp.transport.stdio')
    : transport === 'streamable-http' ? t('mcp.transport.http') : t('mcp.transport.unknown')
}

function matchesFilter(row: McpRow, filter: Filter): boolean {
  const kind = statusKind(row.status)
  switch (filter) {
    case 'all': return true
    case 'connected': return kind === 'connected'
    case 'issue': return kind === 'issue' || kind === 'locked'
    case 'disabled': return kind === 'disabled'
  }
}

/** The editor's open state: a fresh server, or one existing row. */
type Editing = { readonly row: McpRow | null } | null

/** The MCP page. */
export function McpView({ t, controller, onBrowsePlugins }: {
  t: MarketLocale
  controller: McpController
  onBrowsePlugins?: () => void
}): ReactElement {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => controller.attach(), [controller])
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const needle = query.trim().toLocaleLowerCase()
  const toolsOf = useMemo(() => new Map((snapshot.host?.tools ?? []).map(group => [group.server, group])), [snapshot.host])
  const unmanaged = snapshot.host?.unmanaged ?? []
  const managedNames = new Set(snapshot.rows.map(row => row.name))
  const search = (texts: readonly string[], tools?: McpToolGroup) => needle === ''
    || texts.some(text => text.toLocaleLowerCase().includes(needle))
    || (tools?.tools.some(tool => tool.name.toLocaleLowerCase().includes(needle)) ?? false)
  const rows = snapshot.rows.filter(row => matchesFilter(row, filter) && search([row.name, targetOf(row.entry)], toolsOf.get(row.name)))
  const statics = unmanaged.filter(server => filter === 'all' && search(
    [server.serverName, server.command, ...server.args, server.url], toolsOf.get(server.serverName)))
  const managed = summarize(snapshot.rows, unmanaged.length)
  // A static row's tools are its own only while it runs and no managed
  // server shares its namespace — otherwise the group belongs to the managed
  // card (already counted through its toolCount) or to nobody.
  const ownsTools = (server: McpUnmanagedServer) => server.enabled && server.phase === 'active' && !managedNames.has(server.serverName)
  const liveStatics = unmanaged.filter(ownsTools)
  const staticTools = liveStatics.reduce((sum, server) => sum + (toolsOf.get(server.serverName)?.tools.length ?? 0), 0)
  const counts = { servers: managed.servers, connected: managed.connected + liveStatics.length, tools: managed.tools + staticTools }
  const totalTools = counts.tools
  const writable = snapshot.mode === 'full'
  const loading = snapshot.mode === 'loading'
  const filterCount = (value: Filter) => snapshot.rows.filter(row => matchesFilter(row, value)).length
    + (value === 'all' ? unmanaged.length : 0)

  return (
    <div className="dsh_market_page dsh_market_fixedPage">
      <div className="dsh_market_controls">
        <div className="dsh_market_skillsHeading">
          <h2>{t('mcp.title')}</h2>
          <button className="dsh_market_headerAction" type="button" disabled={loading} onClick={() => { void controller.refresh() }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4v6h-6M20 10a8 8 0 1 0-1.7 7" /></svg>
            {t('mcp.refresh')}
          </button>
          {writable && (
            <button className="dsh_market_install dsh_market_mcpAdd" type="button" onClick={() => setEditing({ row: null })}>
              {t('mcp.add')}
            </button>
          )}
        </div>
        {!loading && (
          <p className="dsh_market_meta">{t('mcp.summary', {
            servers: String(counts.servers), connected: String(counts.connected), tools: String(totalTools),
          })}</p>
        )}
        {!loading && (
          <div className="dsh_market_filterBar">
            <div className="dsh_market_scope dsh_market_skillsOrigins" role="group" aria-label={t('mcp.filter.aria')}>
              {(['all', 'connected', 'issue', 'disabled'] as const).map(value => (
                <button key={value} className="dsh_market_scopeButton" type="button" aria-pressed={filter === value}
                  onClick={() => setFilter(value)}>
                  {t(`mcp.filter.${value}`)} <span>{filterCount(value)}</span>
                </button>
              ))}
            </div>
            <input className="dsh_market_search dsh_market_skillSearch" type="search" spellCheck={false} value={query}
              aria-label={t('mcp.search')} placeholder={t('mcp.search')} onChange={event => setQuery(event.target.value)} />
          </div>
        )}
      </div>
      <div className="dsh_market_results" aria-busy={loading}>
        {loading && <p className="dsh_market_status" role="status">{t('mcp.loading')}</p>}
        <PageNotices t={t} snapshot={snapshot} totalTools={totalTools} />
        {!loading && snapshot.mode !== 'legacy' && snapshot.mode !== 'error' && snapshot.rows.length === 0 && unmanaged.length === 0 && (
          <div className="dsh_market_notice">
            <p className="dsh_market_noticeBody">{t('mcp.empty')}</p>
            {onBrowsePlugins && <button type="button" className="dsh_market_ghost" onClick={onBrowsePlugins}>{t('mcp.emptyBrowse')}</button>}
          </div>
        )}
        {!loading && (snapshot.rows.length > 0 || unmanaged.length > 0) && rows.length === 0 && statics.length === 0 && (
          <p className="dsh_market_status">{t('mcp.noMatch')}</p>
        )}
        {rows.length > 0 && (
          <ul className="dsh_market_cards">
            {rows.map(row => (
              <McpCard key={row.name} t={t} row={row} snapshot={snapshot} controller={controller} writable={writable}
                tools={toolsOf.get(row.name)} onEdit={() => setEditing({ row })} />
            ))}
          </ul>
        )}
        {statics.length > 0 && (
          <section className="dsh_market_skillGroup" aria-label={t('mcp.static.title')}>
            <h3>{t('mcp.static.title')}</h3>
            <p className="dsh_market_meta">{t('mcp.static.hint')}</p>
            <ul className="dsh_market_cards">
              {statics.map(server => (
                <StaticCard key={server.entryId} t={t} server={server} tools={ownsTools(server) ? toolsOf.get(server.serverName) : undefined}
                  conflict={managedNames.has(server.serverName)} snapshot={snapshot} controller={controller} />
              ))}
            </ul>
          </section>
        )}
      </div>
      {editing !== null && (
        <McpEditor t={t} row={editing.row} snapshot={snapshot} controller={controller} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function PageNotices({ t, snapshot, totalTools }: { t: MarketLocale; snapshot: McpSnapshot; totalTools: number }): ReactElement {
  return (
    <>
      {snapshot.mode === 'legacy' && <div className="dsh_market_notice"><p className="dsh_market_noticeBody">{t('mcp.legacy')}</p></div>}
      {snapshot.mode === 'readonly' && <p className="dsh_market_status" role="status">{t('mcp.readonly')}</p>}
      {snapshot.hostError !== '' && snapshot.mode !== 'legacy' && (
        <p className="dsh_market_status" role="alert" data-error="true">{t('mcp.hostError', { reason: snapshot.hostError })}</p>
      )}
      {snapshot.settingsError !== '' && (
        <p className="dsh_market_status" role="alert" data-error="true">
          {t('mcp.settingsError', { reason: reasonText(t, snapshot.settingsError) })}
        </p>
      )}
      {snapshot.watchError !== '' && (
        <p className="dsh_market_status" role="alert" data-error="true">
          {t('mcp.watchError', { reason: reasonText(t, snapshot.watchError) })}
        </p>
      )}
      {totalTools > TOOL_HEAVY && <p className="dsh_market_status" role="status">{t('mcp.tokenHeavy', { tools: String(totalTools) })}</p>}
    </>
  )
}

function ToolList({ t, tools }: { t: MarketLocale; tools: McpToolGroup | undefined }): ReactElement | null {
  const [open, setOpen] = useState(false)
  if (tools === undefined || tools.tools.length === 0) return null
  return (
    <div className="dsh_market_mcpTools">
      <button type="button" className="dsh_market_chip" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {open ? t('mcp.tools.hide') : t('mcp.tools.show', { count: String(tools.tools.length) })}
      </button>
      {open && (
        <ul className="dsh_market_mcpToolList">
          {tools.tools.map(tool => (
            <li key={tool.name}>
              <code>{tool.name}</code>
              {tool.description !== '' && <span>{tool.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProbeResult({ t, probe }: { t: MarketLocale; probe: McpProbeState | undefined }): ReactElement | null {
  if (probe === undefined || probe.status === 'running') return null
  if (probe.status === 'error') return <p className="dsh_market_cardError">{t('mcp.probe.error', { reason: probe.message })}</p>
  const { result } = probe
  return (
    <div className="dsh_market_mcpProbe" role="status">
      {result.ok
        ? (
          <>
            <p>{t('mcp.probe.ok', { duration: String(Math.round(result.durationMs)), count: String(result.toolNames.length) })}</p>
            {result.serverInfo && <p className="dsh_market_meta">{t('mcp.probe.server', { name: result.serverInfo.name, version: result.serverInfo.version })}</p>}
            {result.toolNames.length > 0 && <p className="dsh_market_mcpCode">{result.toolNames.join(', ')}</p>}
            {result.truncated && <p className="dsh_market_meta">{t('mcp.probe.truncated', { count: String(result.toolNames.length) })}</p>}
          </>
          )
        : (
          <p className="dsh_market_cardError">{t('mcp.probe.failed', {
            stage: t(`mcp.probe.stage.${result.stage}`), duration: String(Math.round(result.durationMs)), reason: result.message,
          })}</p>
          )}
      {(!result.closeConfirmed || result.cleanupError !== undefined) && (
        <p className="dsh_market_cardNotice">{t('mcp.probe.cleanup', { reason: result.cleanupError ?? '—' })}</p>
      )}
    </div>
  )
}

function Credentials({ t, row, snapshot, controller }: {
  t: MarketLocale; row: McpRow; snapshot: McpSnapshot; controller: McpController
}): ReactElement | null {
  const [editingRef, setEditingRef] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (row.refs.length === 0) return null
  const save = async (ref: string) => {
    if (value === '' || saving) return
    setSaving(true)
    setError('')
    const failure = await controller.setCredential(ref, value)
    setSaving(false)
    if (failure === '') {
      setValue('')
      setEditingRef(null)
    } else {
      setError(t('mcp.cred.failed', { reason: reasonText(t, failure) }))
    }
  }
  return (
    <div className="dsh_market_mcpCreds">
      <span className="dsh_market_meta">{t('mcp.cred.needed')}</span>
      <ul>
        {row.refs.map((ref) => {
          const info = snapshot.credentials[ref]
          const configured = info?.configured === true
          return (
            <li key={ref}>
              <code>{ref}</code>
              <span className="dsh_market_mcpCredState" data-configured={configured ? 'true' : 'false'}>
                {configured ? (info?.masked ? `${t('mcp.cred.configured')} · ${info.masked}` : t('mcp.cred.configured')) : t('mcp.cred.missing')}
              </span>
              {info?.writable === true && editingRef !== ref && (
                <button type="button" className="dsh_market_chip" disabled={saving}
                  onClick={() => { setEditingRef(ref); setValue(''); setError('') }}>
                  {configured ? t('mcp.cred.update') : t('mcp.cred.set')}
                </button>
              )}
              {info?.writable === false && <span className="dsh_market_meta">{t('mcp.cred.readonly')}</span>}
              {editingRef === ref && (
                <form className="dsh_market_mcpCredForm" onSubmit={(event) => { event.preventDefault(); void save(ref) }}>
                  <input type="password" autoComplete="off" spellCheck={false} value={value} autoFocus
                    aria-label={t('mcp.cred.placeholder', { ref })} placeholder={t('mcp.cred.placeholder', { ref })}
                    onChange={event => setValue(event.target.value)} />
                  <button type="submit" className="dsh_market_install" disabled={value === '' || saving}>
                    {saving ? t('mcp.cred.saving') : t('mcp.cred.save')}
                  </button>
                  <button type="button" className="dsh_market_ghost" disabled={saving} onClick={() => { setEditingRef(null); setValue('') }}>
                    {t('mcp.cancel')}
                  </button>
                </form>
              )}
            </li>
          )
        })}
      </ul>
      {error !== '' && <p className="dsh_market_cardError" role="alert">{error}</p>}
    </div>
  )
}

function McpCard({ t, row, snapshot, controller, writable, tools, onEdit }: {
  t: MarketLocale; row: McpRow; snapshot: McpSnapshot; controller: McpController; writable: boolean
  tools: McpToolGroup | undefined; onEdit: () => void
}): ReactElement {
  const [confirming, setConfirming] = useState(false)
  const busy = snapshot.busy[row.name]
  const probe = snapshot.probes[row.name]
  const actionError = snapshot.errors[row.name]
  const kind = statusKind(row.status)
  const lastError = statusError(row.status)
  const configured = isConfigured(row)
  const enabled = isEnabled(row)
  const removable = row.source === 'user' || row.source === 'overridden'
  const target = targetOf(row.entry)
  // A missing credential is spelled out by the credential list below; its
  // diagnostic would only repeat it.
  const showError = lastError !== '' && kind !== 'connected' && !(row.status?.state === 'waiting-credentials' && row.refs.length > 0)
  return (
    <li className="dsh_market_card dsh_market_mcpCard">
      <div className="dsh_market_head">
        <span className="dsh_market_name" title={row.name}>{row.name}</span>
        <span className="dsh_market_mcpState" data-kind={kind}>{statusLabel(t, row.status)}</span>
      </div>
      <div className="dsh_market_meta dsh_market_skillBadges">
        <span className="dsh_market_categoryTag">{t(`mcp.source.${row.source}`)}</span>
        {row.entry && <span className="dsh_market_categoryTag">{transportLabel(t, transportOf(row.entry))}</span>}
      </div>
      {target !== '' && <p className="dsh_market_mcpCode" title={target}>{target}</p>}
      {row.source === 'registered' && <p className="dsh_market_cardNotice">{t('mcp.registeredHint')}</p>}
      {row.source === 'retained' && <p className="dsh_market_cardNotice">{t('mcp.retainedHint')}</p>}
      {kind === 'locked' && row.source !== 'retained' && <p className="dsh_market_cardError">{t('mcp.lockedHint')}</p>}
      {showError && <p className="dsh_market_cardError" title={lastError}>{t('mcp.lastError', { reason: lastError })}</p>}
      {row.plaintext.length > 0 && <p className="dsh_market_cardNotice" data-warning="true">{t('mcp.plaintext', { fields: row.plaintext.join(', ') })}</p>}
      <Credentials t={t} row={row} snapshot={snapshot} controller={controller} />
      <ToolList t={t} tools={tools} />
      <ProbeResult t={t} probe={probe} />
      {actionError !== undefined && (
        <p className="dsh_market_cardError" role="alert">
          {/conflict/i.test(actionError) ? t('mcp.conflict') : t('mcp.actionFailed', { reason: reasonText(t, actionError) })}
        </p>
      )}
      <div className="dsh_market_foot">
        {confirming
          ? (
            <>
              <span className="dsh_market_cardNotice" aria-live="polite">
                {row.source === 'overridden' ? t('mcp.confirmRestore', { name: row.name }) : t('mcp.confirmRemove', { name: row.name })}
              </span>
              <button type="button" className="dsh_market_danger" disabled={busy !== undefined}
                onClick={() => { void controller.remove(row.name).then(() => setConfirming(false)) }}>
                {busy === 'remove' ? t('mcp.removing') : t('mcp.confirm')}
              </button>
              <button type="button" className="dsh_market_ghost" disabled={busy !== undefined} onClick={() => setConfirming(false)}>
                {t('mcp.cancel')}
              </button>
            </>
            )
          : (
            <>
              {canProbe(row) && (
                <button type="button" className="dsh_market_ghost" disabled={probe?.status === 'running' || snapshot.mode === 'legacy'}
                  onClick={() => { void controller.probe(row.name) }}>
                  {probe?.status === 'running' ? t('mcp.probing') : t('mcp.probe')}
                </button>
              )}
              {canRestart(row) && (
                <button type="button" className="dsh_market_ghost" disabled={busy !== undefined}
                  onClick={() => { void controller.restart(row.name) }}>
                  {busy === 'restart' ? t('mcp.restarting') : t('mcp.restart')}
                </button>
              )}
              {writable && configured && (
                <>
                  <button type="button" className="dsh_market_ghost" disabled={busy !== undefined}
                    onClick={() => { void controller.setEnabled(row.name, !enabled) }}>
                    {busy === 'enable' ? t('mcp.enabling') : busy === 'disable' ? t('mcp.disabling')
                      : enabled ? t('mcp.disable') : t('mcp.enable')}
                  </button>
                  <button type="button" className="dsh_market_ghost" disabled={busy !== undefined} onClick={onEdit}>{t('mcp.edit')}</button>
                  {removable && (
                    <button type="button" className="dsh_market_danger" disabled={busy !== undefined} onClick={() => setConfirming(true)}>
                      {row.source === 'overridden' ? t('mcp.restore') : t('mcp.remove')}
                    </button>
                  )}
                </>
              )}
            </>
            )}
      </div>
    </li>
  )
}

function StaticCard({ t, server, tools, conflict, snapshot, controller }: {
  t: MarketLocale; server: McpUnmanagedServer; tools: McpToolGroup | undefined; conflict: boolean
  snapshot: McpSnapshot; controller: McpController
}): ReactElement {
  const key = staticKey(server.loaderId)
  const toggle = snapshot.staticToggles?.[server.loaderId]
  const busy = snapshot.busy[key]
  const error = snapshot.errors[key]
  const notice = snapshot.notices[key]
  // Starting a static row over an enabled managed server of the same name
  // would fail both; the controller refuses it too, this only explains why.
  const blocked = !server.enabled && snapshot.rows.some(row => row.name === server.serverName && row.entry?.enabled !== false)
  const state = !server.enabled ? 'disabled'
    : server.phase === 'active' ? 'connected'
      : server.phase === 'failed' ? 'issue'
        : server.phase === 'pending' || server.phase === 'loading' ? 'pending' : 'disabled'
  const label = !server.enabled ? t('mcp.state.disabled')
    : server.phase === 'active' ? t('mcp.static.running')
      : server.phase === 'failed' ? t('mcp.static.failed')
        : server.phase === 'pending' || server.phase === 'loading' ? t('mcp.static.loading') : t('mcp.static.stopped')
  const target = server.transport === 'stdio' ? commandLine(server.command, server.args) : server.url
  return (
    <li className="dsh_market_card dsh_market_mcpCard">
      <div className="dsh_market_head">
        <span className="dsh_market_name" title={server.entryId}>{server.serverName || server.entryId}</span>
        <span className="dsh_market_mcpState" data-kind={state}>{label}</span>
      </div>
      <div className="dsh_market_meta dsh_market_skillBadges">
        <span className="dsh_market_categoryTag">{t('mcp.source.static')}</span>
        <span className="dsh_market_categoryTag">{transportLabel(t, server.transport)}</span>
      </div>
      {target !== '' && <p className="dsh_market_mcpCode" title={target}>{target}</p>}
      {server.envKeys.length > 0 && <p className="dsh_market_meta">{t('mcp.static.env', { keys: server.envKeys.join(', ') })}</p>}
      {server.headerKeys.length > 0 && <p className="dsh_market_meta">{t('mcp.static.headers', { keys: server.headerKeys.join(', ') })}</p>}
      {conflict && <p className="dsh_market_cardError">{t('mcp.static.conflict', { name: server.serverName })}</p>}
      {server.plaintextSecrets.length > 0 && (
        <p className="dsh_market_cardNotice" data-warning="true">{t('mcp.static.plaintext', { fields: server.plaintextSecrets.join(', ') })}</p>
      )}
      <ToolList t={t} tools={tools} />
      {toggle?.available === false && <p className="dsh_market_meta">{t(`mcp.static.readonly.${toggle.reason}`)}</p>}
      {notice === 'restart-required' && <p className="dsh_market_cardNotice" role="status">{t('mcp.static.restartRequired')}</p>}
      {error !== undefined && (
        <p className="dsh_market_cardError" role="alert">
          {error === 'overridden' ? t('mcp.static.overridden') : t('mcp.actionFailed', { reason: reasonText(t, error) })}
        </p>
      )}
      {toggle?.available === true && snapshot.mode !== 'readonly' && (
        <div className="dsh_market_foot">
          <button type="button" className="dsh_market_ghost" disabled={busy !== undefined || blocked}
            title={blocked ? t('mcp.reason.nameConflict') : undefined}
            onClick={() => { void controller.setStaticEnabled(server.loaderId, !server.enabled) }}>
            {busy === 'enable' ? t('mcp.enabling') : busy === 'disable' ? t('mcp.disabling')
              : server.enabled ? t('mcp.disable') : t('mcp.enable')}
          </button>
        </div>
      )}
    </li>
  )
}

function errorText(t: MarketLocale, error: McpDraftError): string {
  switch (error.field) {
    case 'name': return t(`mcp.error.name.${error.code}`)
    case 'command': return t('mcp.error.command.required')
    case 'url': return t(`mcp.error.url.${error.code}`)
    case 'env':
    case 'headers': return t(`mcp.error.pairs.${error.code}`)
    case 'template': return t('mcp.error.template', { where: error.where })
    case 'startupTimeoutMs':
    case 'toolCallTimeoutMs': return t('mcp.error.number')
  }
}

function PairsField({ t, label, pairs, onChange, error }: {
  t: MarketLocale; label: string; pairs: readonly McpPair[]; onChange: (next: McpPair[]) => void; error?: string
}): ReactElement {
  const update = (index: number, patch: Partial<McpPair>) => onChange(pairs.map((pair, at) => at === index ? { ...pair, ...patch } : pair))
  return (
    <fieldset className="dsh_market_mcpField">
      <legend>{label}</legend>
      {pairs.map((pair, index) => (
        <div key={index} className="dsh_market_mcpPair">
          <input value={pair.key} spellCheck={false} aria-label={`${label} ${t('mcp.field.key')}`} placeholder={t('mcp.field.key')}
            onChange={event => update(index, { key: event.target.value })} />
          <input value={pair.value} spellCheck={false} aria-label={`${label} ${t('mcp.field.value')}`} placeholder={t('mcp.field.value')}
            onChange={event => update(index, { value: event.target.value })} />
          <button type="button" className="dsh_market_chip" onClick={() => onChange(pairs.filter((_, at) => at !== index))}>
            {t('mcp.field.removePair')}
          </button>
        </div>
      ))}
      <button type="button" className="dsh_market_chip" onClick={() => onChange([...pairs, { key: '', value: '' }])}>{t('mcp.field.addPair')}</button>
      {error && <p className="dsh_market_cardError">{error}</p>}
    </fieldset>
  )
}

/** The credential name a plaintext field suggests: its env/header name, or the flag before an argument. */
function fieldLabel(draft: McpDraft, where: string): string {
  const arg = /^args\[(\d+)\]$/.exec(where)
  if (arg !== null) {
    const index = Number(arg[1])
    const own = draft.args[index] ?? ''
    const flag = own.startsWith('-') && own.includes('=') ? own.slice(0, own.indexOf('=')) : draft.args[index - 1] ?? ''
    return flag.startsWith('-') ? flag.replace(/^-+/, '') : 'TOKEN'
  }
  return where === 'url' ? 'URL_TOKEN' : where.slice(where.indexOf('.') + 1)
}

function McpEditor({ t, row, snapshot, controller, onClose }: {
  t: MarketLocale; row: McpRow | null; snapshot: McpSnapshot; controller: McpController; onClose: () => void
}): ReactElement {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const original = row?.entry !== undefined ? draftFromEntry(row.name, row.entry) : emptyDraft()
  const [draft, setDraft] = useState<McpDraft>(original)
  const [argsText, setArgsText] = useState(original.args.join('\n'))
  const [pasteLine, setPasteLine] = useState('')
  // Trust is given to one exact command line; any edit to it asks again.
  const [trustedLine, setTrustedLine] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [advanced, setAdvanced] = useState(original.startupTimeoutMs !== '' || original.toolCallTimeoutMs !== '')
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])
  const taken = new Set([
    ...snapshot.rows.map(item => item.name),
    ...(snapshot.host?.unmanaged ?? []).map(server => server.serverName),
  ])
  if (row !== null) taken.delete(row.name)
  const errors = validateDraft(draft, taken)
  const errorOf = (field: McpDraftError['field']) => {
    const found = errors.find(error => error.field === field)
    const live = field === 'name' && draft.name !== ''
    return (touched || live) && found !== undefined ? errorText(t, found) : undefined
  }
  const line = draft.transport === 'stdio' ? commandLine(draft.command, draft.args) : ''
  const commandChanged = draft.transport === 'stdio' && (row === null || line !== commandLine(original.command, original.args)
    || original.transport !== 'stdio')
  const risks = draft.transport === 'stdio' ? commandRisks(draft.command, draft.args) : []
  const plaintext = draftPlaintext(draft)
  const refsTaken = new Set([...draft.pending.map(secret => secret.ref), ...Object.keys(snapshot.credentials)])
  const trusted = trustedLine === line
  const needsTrust = commandChanged && draft.command.trim() !== ''
  // An empty command is not gated here: the click runs validation, which
  // names the missing field instead of leaving a silently disabled button.
  const canSave = !saving && (!needsTrust || trusted)
  const set = (patch: Partial<McpDraft>) => setDraft(current => ({ ...current, ...patch }))
  const setArgs = (text: string) => {
    setArgsText(text)
    set({ args: text.split('\n').filter(item => item !== '') })
  }
  const close = () => {
    if (saving) return
    dialog.current?.close()
    onClose()
  }
  const applyPaste = () => {
    const words = splitCommandLine(pasteLine)
    if (words.length === 0) return
    set({ command: words[0]!, args: words.slice(1) })
    setArgsText(words.slice(1).join('\n'))
    setPasteLine('')
  }
  const convert = (where: string) => {
    const ref = suggestRef(draft.name || 'server', fieldLabel(draft, where), refsTaken)
    const next = convertToCredential(draft, where, ref)
    setDraft(next)
    setArgsText(next.args.join('\n'))
  }
  const save = async () => {
    setTouched(true)
    if (errors.length > 0 || !canSave) return
    setSaving(true)
    setSaveError('')
    const outcome = await controller.save({ ...draft, name: draft.name.trim() }, row?.name)
    setSaving(false)
    if (outcome.ok) {
      dialog.current?.close()
      onClose()
    } else {
      setConflict(outcome.conflict)
      setSaveError(outcome.conflict ? t('mcp.editor.conflict') : t('mcp.saveFailed', { reason: reasonText(t, outcome.message) }))
    }
  }
  /** Replace the form with the entry as it now stands; the user's edits are dropped on request only. */
  const latest = row === null ? undefined : snapshot.rows.find(item => item.name === row.name)?.entry
  const reloadLatest = () => {
    if (latest === undefined || row === null) return
    const next = draftFromEntry(row.name, latest)
    setDraft(next)
    setArgsText(next.args.join('\n'))
    setTrustedLine(null)
    setConflict(false)
    setSaveError('')
  }
  const nameEditable = row === null || row.source === 'user'
  return (
    <dialog ref={dialog} className="dsh_market_directPanel dsh_market_mcpEditor" aria-labelledby={id}
      onCancel={(event) => { event.preventDefault(); close() }}>
      <div className="dsh_market_directHead">
        <div className="dsh_market_installHeading">
          <h3 id={id}>{row === null ? t('mcp.editor.add') : t('mcp.editor.edit', { name: row.name })}</h3>
        </div>
        <button type="button" className="dsh_market_directClose" aria-label={t('mcp.editor.close')} disabled={saving} onClick={close}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
      <form className="dsh_market_mcpForm" onSubmit={(event) => { event.preventDefault(); void save() }}>
        {(row?.source === 'inherited' || row?.source === 'overridden') && <p className="dsh_market_cardNotice">{t('mcp.editor.inherited')}</p>}
        <label className="dsh_market_mcpField">
          <span>{t('mcp.field.name')}</span>
          <input value={draft.name} spellCheck={false} disabled={!nameEditable} maxLength={32}
            onChange={event => set({ name: event.target.value })} />
          <small className="dsh_market_meta">{t('mcp.field.nameHint')}</small>
          {errorOf('name') && <span className="dsh_market_cardError">{errorOf('name')}</span>}
        </label>
        <div className="dsh_market_mcpField" role="radiogroup" aria-label={t('mcp.field.transport')}>
          <span>{t('mcp.field.transport')}</span>
          <div className="dsh_market_scope">
            {(['stdio', 'streamable-http'] as const).map(transport => (
              <button key={transport} type="button" className="dsh_market_scopeButton" role="radio"
                aria-checked={draft.transport === transport} aria-pressed={draft.transport === transport}
                onClick={() => set({ transport })}>
                {transportLabel(t, transport)}
              </button>
            ))}
          </div>
        </div>
        {draft.transport === 'stdio'
          ? (
            <>
              <div className="dsh_market_mcpField">
                <span>{t('mcp.field.paste')}</span>
                <div className="dsh_market_mcpPair">
                  <input value={pasteLine} spellCheck={false} placeholder="npx -y @modelcontextprotocol/server-everything"
                    aria-label={t('mcp.field.paste')} onChange={event => setPasteLine(event.target.value)} />
                  <button type="button" className="dsh_market_chip" disabled={pasteLine.trim() === ''} onClick={applyPaste}>
                    {t('mcp.field.pasteApply')}
                  </button>
                </div>
              </div>
              <label className="dsh_market_mcpField">
                <span>{t('mcp.field.command')}</span>
                <input value={draft.command} spellCheck={false} onChange={event => set({ command: event.target.value })} />
                {errorOf('command') && <span className="dsh_market_cardError">{errorOf('command')}</span>}
              </label>
              <label className="dsh_market_mcpField">
                <span>{t('mcp.field.args')}</span>
                <textarea rows={Math.min(8, Math.max(3, draft.args.length + 1))} spellCheck={false} value={argsText}
                  onChange={event => setArgs(event.target.value)} />
              </label>
              <label className="dsh_market_mcpField">
                <span>{t('mcp.field.cwd')}</span>
                <input value={draft.cwd} spellCheck={false} onChange={event => set({ cwd: event.target.value })} />
              </label>
              <PairsField t={t} label={t('mcp.field.env')} pairs={draft.env} onChange={env => set({ env })} error={errorOf('env')} />
            </>
            )
          : (
            <>
              <label className="dsh_market_mcpField">
                <span>{t('mcp.field.url')}</span>
                <input value={draft.url} spellCheck={false} placeholder="https://example.com/mcp" onChange={event => set({ url: event.target.value })} />
                {errorOf('url') && <span className="dsh_market_cardError">{errorOf('url')}</span>}
              </label>
              <PairsField t={t} label={t('mcp.field.headers')} pairs={draft.headers} onChange={headers => set({ headers })} error={errorOf('headers')} />
            </>
            )}
        {plaintext.length > 0 && (
          <div className="dsh_market_mcpSecrets" role="status">
            <p>{t('mcp.field.secrets')}</p>
            <ul>
              {plaintext.map(where => (
                <li key={where}>
                  <code>{where}</code>
                  <button type="button" className="dsh_market_chip" onClick={() => convert(where)}>{t('mcp.field.convert')}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pendingToStore(draft).length > 0 && (
          <ul className="dsh_market_mcpPending">
            {pendingToStore(draft).map(secret => <li key={secret.ref} className="dsh_market_meta">{t('mcp.field.pending', { ref: secret.ref })}</li>)}
          </ul>
        )}
        {touched && errors.filter(error => error.field === 'template').map(error => (
          <p key={(error as { where: string }).where} className="dsh_market_cardError">{errorText(t, error)}</p>
        ))}
        <label className="dsh_market_optionCheck dsh_market_mcpCheck">
          <input type="checkbox" checked={draft.enabled} onChange={event => set({ enabled: event.target.checked })} />
          <span>{t('mcp.field.enabled')}</span>
        </label>
        {!draft.enabled && <small className="dsh_market_meta">{t('mcp.field.enabledHint')}</small>}
        <details className="dsh_market_installDetails" open={advanced} onToggle={event => setAdvanced((event.target as HTMLDetailsElement).open)}>
          <summary>{t('mcp.field.advanced')}</summary>
          <div className="dsh_market_installDetailsBody dsh_market_mcpForm">
            <label className="dsh_market_mcpField">
              <span>{t('mcp.field.startup')}</span>
              <input inputMode="numeric" value={draft.startupTimeoutMs} onChange={event => set({ startupTimeoutMs: event.target.value })} />
              {errorOf('startupTimeoutMs') && <span className="dsh_market_cardError">{errorOf('startupTimeoutMs')}</span>}
            </label>
            <label className="dsh_market_mcpField">
              <span>{t('mcp.field.toolCall')}</span>
              <input inputMode="numeric" value={draft.toolCallTimeoutMs} onChange={event => set({ toolCallTimeoutMs: event.target.value })} />
              {errorOf('toolCallTimeoutMs') && <span className="dsh_market_cardError">{errorOf('toolCallTimeoutMs')}</span>}
            </label>
          </div>
        </details>
        {needsTrust && (
          <div className="dsh_market_mcpRisk" role="note">
            <p>{t('mcp.risk.title')}</p>
            <pre className="dsh_market_directMessage">{line}</pre>
            {risks.includes('fetch') && <p className="dsh_market_cardNotice" data-warning="true">{t('mcp.risk.fetch')}</p>}
            {risks.includes('shell') && <p className="dsh_market_cardNotice" data-warning="true">{t('mcp.risk.shell')}</p>}
            <label className="dsh_market_optionCheck dsh_market_mcpCheck">
              <input type="checkbox" checked={trusted} onChange={event => setTrustedLine(event.target.checked ? line : null)} />
              <span>{t('mcp.risk.confirm')}</span>
            </label>
          </div>
        )}
        {row !== null && isEnabled(row) && draft.enabled && <p className="dsh_market_cardNotice">{t('mcp.rebuild')}</p>}
        {saveError !== '' && <p className="dsh_market_cardError" role="alert">{saveError}</p>}
        {conflict && latest !== undefined && (
          <button type="button" className="dsh_market_ghost dsh_market_mcpReload" disabled={saving} onClick={reloadLatest}>
            {t('mcp.editor.reload')}
          </button>
        )}
        <div className="dsh_market_installFooter">
          <button type="button" className="dsh_market_ghost" disabled={saving} onClick={close}>{t('mcp.cancel')}</button>
          <button type="submit" className="dsh_market_primary" disabled={!canSave}>{saving ? t('mcp.saving') : t('mcp.save')}</button>
        </div>
      </form>
    </dialog>
  )
}
