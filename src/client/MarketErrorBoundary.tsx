import { MarketButton } from './MarketButton.tsx'
import { Component, Fragment, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import type { MarketLocale } from './copy.ts'

interface BoundaryProps {
  readonly t: MarketLocale
  /** Which entry crashed, so a pasted report names the surface. */
  readonly surface: string
  readonly children: ReactNode
}

interface BoundaryState {
  readonly crash: { readonly error: unknown; readonly componentStack: string } | null
  /** Bumped by Retry so the subtree remounts from scratch. */
  readonly attempt: number
}

/**
 * The Host serves every client plugin through one combo URL that lists all of
 * them, repeated on each frame; the origin carries no signal either.
 */
function compactStack(stack: string): string {
  return stack
    .replace(/https?:\/\/[^\s()]*?\/plugins\/\?\?[^\s()]*?(?=:\d+:\d+)/g, 'plugins-bundle')
    .replace(/https?:\/\/[^/\s()]+/g, '')
}

/** Plain-text report a user can paste into an issue; nothing here is secret. */
export function describeCrash(surface: string, error: unknown, componentStack: string): string {
  const head = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const stack = error instanceof Error && typeof error.stack === 'string' ? compactStack(error.stack) : ''
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  return [
    `[dsh-market-pro] ${surface}`,
    head,
    agent && `UA: ${agent}`,
    stack && `\n${stack}`,
    componentStack && `\nComponent stack:${compactStack(componentStack)}`,
  ].filter(Boolean).join('\n')
}

/**
 * The Host's own slot boundary renders an empty anchor when an entry throws
 * and logs to a console that mobile WebViews never expose, so the page goes
 * blank with nothing to report. This boundary sits inside the entry and keeps
 * a crash visible, retryable and copyable.
 */
export class MarketErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { crash: null, attempt: 0 }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { crash: { error, componentStack: '' } }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[dsh-market-pro] ${this.props.surface} crashed:`, error)
    this.setState({ crash: { error, componentStack: info.componentStack ?? '' } })
  }

  private readonly retry = (): void => {
    this.setState(previous => ({ crash: null, attempt: previous.attempt + 1 }))
  }

  override render(): ReactNode {
    const { crash, attempt } = this.state
    if (crash === null) return <Fragment key={attempt}>{this.props.children}</Fragment>
    return <CrashNotice t={this.props.t} onRetry={this.retry}
      message={crash.error instanceof Error ? crash.error.message : String(crash.error)}
      report={describeCrash(this.props.surface, crash.error, crash.componentStack)} />
  }
}

function CrashNotice({ t, report, message, onRetry }: {
  t: MarketLocale
  report: string
  message: string
  onRetry: () => void
}) {
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle')
  const pre = useRef<HTMLPreElement>(null)
  const copyReport = async (): Promise<void> => {
    try {
      // Clipboard is missing outside secure contexts (a LAN address over
      // plain HTTP); fall back to a selection the user can copy by hand.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report)
        setCopy('done')
        return
      }
    } catch {
      // Fall through to the manual selection.
    }
    const node = pre.current
    const selection = window.getSelection()
    if (node && selection) {
      const details = node.closest('details')
      if (details) details.open = true
      const range = document.createRange()
      range.selectNodeContents(node)
      selection.removeAllRanges()
      selection.addRange(range)
      try {
        if (document.execCommand('copy')) {
          setCopy('done')
          return
        }
      } catch {
        // The selection stays for a manual copy.
      }
    }
    setCopy('failed')
  }
  return (
    <div className="dsh_market_section">
      <div className="dsh_market_notice">
        <div role="alert">
          <h3>{t('crash.title')}</h3>
          <p className="dsh_market_noticeBody">{t('crash.hint')}</p>
          <p className="dsh_market_noticeBody">{message}</p>
        </div>
        <div className="dsh_market_introActions">
          <MarketButton intent="primary" onClick={onRetry}>{t('retry')}</MarketButton>
          <MarketButton intent="secondary" onClick={() => { void copyReport() }}>{t('crash.copy')}</MarketButton>
          {copy !== 'idle' && <span className="dsh_market_noticeBody" role="status">
            {t(copy === 'done' ? 'crash.copied' : 'crash.copyFailed')}
          </span>}
        </div>
        <details className="dsh_market_installDetails">
          <summary>{t('skills.diagnostic')}<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></summary>
          <pre className="dsh_market_directMessage" ref={pre}>{report}</pre>
        </details>
      </div>
    </div>
  )
}
