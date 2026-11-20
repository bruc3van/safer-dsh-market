/**
 * Stand-in for `@deepseek-ai/dsh-client-ui-primitives` in tests that bundle a
 * client module with esbuild only to transform JSX. Production resolves the
 * real package from the host's module table; these tests never render it.
 */
import { forwardRef, type ReactNode } from 'react'

type Props = { children?: ReactNode } & Record<string, unknown>

const passthrough = ({ children }: Props) => <>{children}</>
const icon = () => null

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ children }, ref) {
  return <button ref={ref} type="button">{children}</button>
})
export const Switch = () => null
export const Menu = ({ anchor }: { anchor?: ReactNode }) => <>{anchor}</>
export const Modal = ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? <>{children}</> : null)
export const Tooltip = passthrough
export const IconChevronDownOutlineRegular = icon
export const IconCloseOutlineRegular = icon
export const IconInfoOutlineRegular = icon
