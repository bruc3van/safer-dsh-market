import { useState } from 'react'
import { IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'

interface MenuOption<T extends string = string> { value: T; label: string; count?: number }

/**
 * Single-choice filter control: a host selector trigger opening the host
 * `Menu`, which owns keyboard walking, outside dismissal, viewport fitting
 * and the shared translucent menu material.
 */
export function MarketSelector<T extends string = string>({ value, onChange, label, options, className }: {
  value: T
  onChange: (value: T) => void
  label: string
  options: readonly MenuOption<T>[]
  className: string
}) {
  const [open, setOpen] = useState(false)
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const close = () => { setOpen(false); setFocusOnOpen(false) }
  const selected = options.find(option => option.value === value) ?? options[0]!
  return <div className={className}>
    <Menu open={open} onClose={close} portal align="end" minWidthFromAnchor autoFocus={focusOnOpen} selectedId={value}
      items={options.map(option => ({
        id: option.value,
        label: option.count === undefined
          ? option.label
          : <span className="dsh_market_optionRow"><span className="dsh_market_optionLabel">{option.label}</span><span className="dsh_market_optionCount">{option.count}</span></span>,
      }))}
      onSelect={(next) => { close(); onChange(next as T) }}
      anchor={<button type="button" className="dsh_market_modeTrigger" aria-haspopup="menu" aria-expanded={open}
        aria-label={`${label}：${selected.label}`}
        onClick={() => { setFocusOnOpen(false); setOpen(!open) }}
        onKeyDown={event => { if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); setFocusOnOpen(true); setOpen(true) } }}>
        <span className="dsh_market_selectLabel">{selected.label}</span>
        <IconChevronDownOutlineRegular size={14} className="dsh_market_modeChevron" />
      </button>} />
  </div>
}
