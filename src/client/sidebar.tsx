import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime, PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { MarketSection, type MarketSectionInjected } from './MarketSection.tsx'

export const MARKET_TAB_ID = 'safer-dsh-market'
const NS = 'settings.saferMarket'

type MarketSidebarProps = PropsRuntime<'sidebar.right.pane.tab'>
  & InjectFace<MarketSectionInjected> & PropsLocale<typeof NS>

/** Reuse the market face; the tab owns dismissal after a successful hand-off. */
export function MarketSidebar({ useTabInfo, ...props }: MarketSidebarProps) {
  const { tab } = useTabInfo()
  return <div className="dsh_market_sidebar">
    <MarketSection {...props} close={() => tab.actions.close()} />
  </div>
}

type MarketMainProps = PropsRuntime<'main'>
  & InjectFace<MarketSectionInjected & { close: () => void }> & PropsLocale<typeof NS>

/** The global page shares the shared install hand-off. */
export function MarketMain(props: MarketMainProps) {
  return <div className="dsh_market_main"><MarketSection {...props} /></div>
}

/** Publish the navigation row only while its destination slot is available. */
export function registerMarketNavigation(ctx: Context, injectMarket: () => MarketSectionInjected): void {
  ctx.inject(['layout'], (panelCtx) => {
    const t = panelCtx.locale.bind(NS)
    panelCtx.effect(() => panelCtx.slots.inject('main', () => {
      const disposeMain = panelCtx.slots.register({
        name: 'main', key: MARKET_TAB_ID, locale: NS,
        inject: () => ({ ...injectMarket(), close: () => panelCtx.layout.selectPanel(null) }),
      }, MarketMain)
      const disposeRow = panelCtx.slots.inject('sidebar.panellist', () => panelCtx.slots.register({
        name: 'sidebar.panellist', id: MARKET_TAB_ID, order: 60, label: () => t('nav'),
      }, MarketIcon))
      return () => { disposeRow(); disposeMain() }
    }), 'safe-market: left navigation')
  })
}

function MarketIcon({ size = 24, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} className={className} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M9 20v-6h6v6" />
  </svg>
}

/** An optional child fiber keeps left navigation available without the right Sidebar. */
export function registerMarketSidebar(ctx: Context, injectMarket: () => MarketSectionInjected): void {
  ctx.inject(['sidebarRightTabs'], (sidebarCtx) => {
    const t = sidebarCtx.locale.bind(NS)
    const definition: SidebarRightTabDefinition = {
      id: MARKET_TAB_ID,
      kind: MARKET_TAB_ID,
      title: () => t('nav'),
      guide: [{ id: MARKET_TAB_ID, order: 60, title: () => t('nav'), description: () => t('sidebar.description'), icon: MarketIcon }],
    }
    sidebarCtx.effect(() => sidebarCtx.sidebarRightTabs.register(definition), 'safe-market: sidebar type')
    sidebarCtx.effect(() => sidebarCtx.slots.inject('sidebar.right.pane.tab', () => sidebarCtx.slots.register({
      name: 'sidebar.right.pane.tab', key: MARKET_TAB_ID, locale: NS, inject: injectMarket,
    }, MarketSidebar)), 'safe-market: sidebar body')
  })
}
