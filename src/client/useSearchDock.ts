import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Move the existing search controls, retaining their value and keyboard focus. */
export function useSearchDock(page: string) {
  const root = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const before = useRef<DOMRect | null>(null)
  const bar = () => root.current?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) .dsh_market_dockable')
  useEffect(() => {
    setCompact(false)
    const element = root.current
    if (!element) return
    let previous = 0
    let height = 0
    let distance = 0
    let current = false
    const change = (next: boolean) => {
      if (next === current || bar()?.contains(document.activeElement)) return
      before.current = bar()?.getBoundingClientRect() ?? null
      current = next
      setCompact(next)
    }
    const geometry = () => {
      const tabs = element.querySelector<HTMLElement>('.dsh_market_tabs')
      if (tabs) element.querySelectorAll<HTMLElement>('.dsh_market_dockable').forEach(control => {
        control.style.top = `${tabs.offsetTop}px`
      })
      if (element.clientWidth < 440) change(false)
    }
    const observer = new ResizeObserver(geometry)
    observer.observe(element)
    const tabs = element.querySelector('.dsh_market_tabs')
    if (tabs) observer.observe(tabs)
    geometry()
    const scroll = (event: Event) => {
      const list = event.target
      if (!(list instanceof HTMLElement) || !list.matches('.dsh_market_results') || !bar()) return
      const delta = list.scrollTop - previous
      previous = list.scrollTop
      if (height && height !== list.clientHeight) { height = list.clientHeight; return }
      height = list.clientHeight
      if (list.scrollTop <= 4) { distance = 0; change(false); return }
      if (Math.sign(delta) !== Math.sign(distance)) distance = 0
      distance += delta
      if (distance > 40 && element.clientWidth >= 440) { change(true); distance = 0 }
      if (distance < -16) { change(false); distance = 0 }
    }
    element.addEventListener('scroll', scroll, true)
    return () => { observer.disconnect(); element.removeEventListener('scroll', scroll, true) }
  }, [page])
  useLayoutEffect(() => {
    const control = bar()
    const old = before.current
    before.current = null
    if (!control || !old || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const next = control.getBoundingClientRect()
    const animation = control.animate([
      { transform: `translate(${old.left - next.left}px, ${old.top - next.top}px)`, width: `${old.width}px` },
      { transform: 'translate(0, 0)', width: `${next.width}px` },
    ], { duration: 180, easing: 'ease-out' })
    return () => animation.cancel()
  }, [compact])
  return { root, compact }
}
