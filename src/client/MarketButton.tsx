import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * What a market action means, mapped onto the host's shared `Button`:
 * `primary` is the single filled verb of a card or dialog, `secondary` an
 * outlined peer, `quiet` a borderless toolbar action, and `danger` an outlined
 * destructive verb whose text and hover take the error color.
 */
export type MarketButtonIntent = 'primary' | 'secondary' | 'quiet' | 'danger'

type MarketButtonProps = {
  intent?: MarketButtonIntent
  /** `sm` (28px) inside cards and rows; `md` (36px) for page, dialog and empty-state actions. */
  size?: 'sm' | 'md'
  icon?: ReactNode
  className?: string | undefined
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const VARIANT = { primary: 'primary', secondary: 'outline', quiet: 'ghost', danger: 'outline' } as const

/**
 * Render a market action through the host's `Button`, so geometry, focus,
 * hover and disabled treatment follow the host Web UI in both themes.
 * @param props.intent - action role (default `secondary`).
 * @param props.size - control size (default `sm`).
 * @returns the native button element.
 */
export const MarketButton = forwardRef<HTMLButtonElement, MarketButtonProps>(function MarketButton({
  intent = 'secondary', size = 'sm', className, ...rest
}, ref) {
  const classes = ['dsh_market_button', intent === 'danger' ? 'dsh_market_dangerButton' : '', className ?? ''].filter(Boolean).join(' ')
  return <Button ref={ref} variant={VARIANT[intent]} size={size} className={classes || undefined} {...rest} />
})
