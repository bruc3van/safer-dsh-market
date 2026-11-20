import { useState, type ReactNode } from 'react'
import { Menu, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'

/** One external destination offered from the header's More menu. */
export interface MarketMoreLink { id: string; label: string; href: string; icon?: ReactNode }

/**
 * The header's overflow control: an icon-only trigger opening the host `Menu`,
 * whose rows open their destination in a new browsing context.
 */
export function MarketMoreActions({ label, links }: { label: string; links: readonly MarketMoreLink[] }) {
  const [open, setOpen] = useState(false)
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const close = () => { setOpen(false); setFocusOnOpen(false) }
  return <div className="dsh_market_more">
    <Menu open={open} onClose={close} portal align="end" autoFocus={focusOnOpen}
      items={links.map(link => ({ id: link.id, label: link.label, icon: link.icon }))}
      onSelect={(id) => {
        close()
        const link = links.find(entry => entry.id === id)
        if (link) window.open(link.href, '_blank', 'noopener,noreferrer')
      }}
      anchor={<Tooltip label={label} side="bottom" align="end" portal disabled={open}>
        <button type="button" className="dsh_market_iconButton" aria-label={label} aria-haspopup="menu" aria-expanded={open}
          onClick={() => { setFocusOnOpen(false); setOpen(!open) }}
          onKeyDown={event => { if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); setFocusOnOpen(true); setOpen(true) } }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />
          </svg>
        </button>
      </Tooltip>} />
  </div>
}
