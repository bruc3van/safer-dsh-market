import { useEffect, useId, useRef, useState } from 'react'
import type { MarketLocale } from './copy.ts'

type Mode = 'direct' | 'prompt'
const modes: Mode[] = ['direct', 'prompt']

/** Theme-aware menu, retaining keyboard selection and dismissal. */
export function InstallModeSelector({ value, onChange, t }: { value: Mode; onChange: (mode: Mode) => void; t: MarketLocale }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const label = (mode: Mode) => t(mode === 'direct' ? 'direct.simple' : 'direct.prompt')
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return <div className="dsh_market_installMode" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <span id={`${id}-label`}>{t('direct.mode')}</span>
    <div className="dsh_market_modeControl">
      <button ref={trigger} type="button" className="dsh_market_modeTrigger" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? id : undefined} aria-label={`${t('direct.mode')}：${label(value)}`}
        onClick={() => setOpen(v => !v)}
        onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) } }}>
        {label(value)}
        <svg className="dsh_market_modeChevron" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div id={id} ref={menu} role="menu" aria-labelledby={`${id}-label`} className="dsh_market_modeMenu"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return }
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
          const index = buttons.findIndex(button => button === document.activeElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          buttons[next]?.focus()
        }}>
        {modes.map(mode => <button type="button" key={mode} role="menuitemradio" aria-checked={value === mode}
          onClick={() => { onChange(mode); setOpen(false); trigger.current?.focus() }}>
          <span>{label(mode)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ visibility: value === mode ? 'visible' : 'hidden' }}>
            <path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>)}
      </div>}
    </div>
  </div>
}
