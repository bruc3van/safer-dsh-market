import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState, type RefObject } from 'react'

/** Minimal DOM surface used to resolve and reset the active scroll container. */
export interface ScrollHost {
  scrollTop: number
  clientHeight?: number
  scrollTo: (options?: ScrollToOptions) => void
  closest: (selector: string) => ScrollHost | null
  querySelector?: (selector: string) => ScrollHost | null
}

/**
 * Resolve the active scroll container for `BackToTop`.
 *
 * Inside `.dsh_market_pluginTab`, the plugin hands vertical scrolling to the
 * host's `[data-plugin-body]`; standalone surfaces keep scrolling inside the
 * active panel's `.dsh_market_results`.
 */
export function resolveBackToTopScroller<T extends ScrollHost>(root: T | null): T | null {
  if (!root || root.closest('[hidden]') !== null) return null
  if (root.closest('.dsh_market_pluginTab') !== null) {
    const hostBody = root.closest('[data-plugin-body]') as T | null
    if (hostBody) return hostBody
  }
  return (root.querySelector?.('[role="tabpanel"]:not([hidden]) .dsh_market_results') as T | null) ?? null
}

/**
 * Reset a results list to the top, falling back to `[data-plugin-body]` only
 * when the list is visible inside `.dsh_market_pluginTab`.
 */
export function scrollResultsContainerToTop(list: ScrollHost | null, behavior?: ScrollBehavior): void {
  if (!list) return
  if (list.scrollTop > 0) {
    list.scrollTo({ top: 0, behavior })
    return
  }
  if (list.closest('[hidden]') !== null || list.closest('.dsh_market_pluginTab') === null) return
  const hostBody = list.closest('[data-plugin-body]')
  if (hostBody && hostBody.scrollTop > 0) hostBody.scrollTo({ top: 0, behavior })
}

/** Return the active list to its start without scrolling the surrounding app. */
export function BackToTop({ root, page, label }: {
  root: RefObject<HTMLDivElement>
  page: string
  label: string
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = root.current
    if (!element) return
    const hostBody = element.closest('.dsh_market_pluginTab') !== null
      ? element.closest<HTMLElement>('[data-plugin-body]')
      : null
    const update = () => {
      const scroller = resolveBackToTopScroller(element)
      setVisible(Boolean(scroller && scroller.scrollTop > Math.max(240, scroller.clientHeight * .5)))
    }
    update()
    const scrollTarget: HTMLElement = hostBody ?? element
    const capture = hostBody === null
    scrollTarget.addEventListener('scroll', update, capture)
    const resize = new ResizeObserver(update)
    resize.observe(element)
    const scroller = hostBody ?? resolveBackToTopScroller(element)
    if (scroller && scroller !== element) resize.observe(scroller)
    return () => { scrollTarget.removeEventListener('scroll', update, capture); resize.disconnect() }
  }, [root, page])
  if (!visible) return null
  return <Tooltip label={label} side="top" portal><button type="button" className="dsh_market_backToTop" aria-label={label}
    onClick={() => {
      const element = root.current
      const scroller = resolveBackToTopScroller(element)
      if (!element || !scroller) return
      element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true })
      scroller.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h14M12 20V8M6 14l6-6 6 6" />
    </svg>
  </button></Tooltip>
}
