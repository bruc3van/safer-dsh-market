import { useEffect, useId, useRef, useState } from 'react'

interface MenuOption { value: string; label: string; count?: number }

/** Shared theme-aware single-choice menu for marketplace controls. */
export function MarketSelector({ value, onChange, label, options, className }: {
  value: string
  onChange: (value: string) => void
  label: string
  options: readonly MenuOption[]
  className: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const selected = options.find(option => option.value === value) ?? options[0]!
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return <div className={className} ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <span id={`${id}-label`}>{label}</span>
    <div className="dsh_market_modeControl">
      <button ref={trigger} type="button" className="dsh_market_modeTrigger" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? id : undefined} aria-label={`${label}：${selected.label}`}
        onClick={() => setOpen(v => !v)}
        onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) } }}>
        <span className="dsh_market_selectLabel">{selected.label}</span>
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
        {options.map(option => <button type="button" key={option.value} role="menuitemradio" aria-checked={value === option.value}
          onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus() }}>
          <span className="dsh_market_optionLabel">{option.label}</span>
          {option.count !== undefined && <span className="dsh_market_optionCount">{option.count}</span>}
          <svg className="dsh_market_optionCheck" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ visibility: value === option.value ? 'visible' : 'hidden' }}>
            <path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>)}
      </div>}
    </div>
  </div>
}
