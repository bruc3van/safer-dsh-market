import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime, PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { MarketSection, type MarketSectionInjected } from './MarketSection.tsx'

export const MARKET_TAB_ID = 'dsh-market-pro'
const NS = 'settings.dshMarketPro'

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

type PluginTabInjected = Omit<MarketSectionInjected, 'install'> & {
  stageReview: MarketSectionInjected['install']
  close: () => void
}

/** The owner's install verb is distinct from the market's review-draft verb. */
export function MarketPluginTab({ install: _install, update: _update, openPackage: _openPackage, stageReview, ...props }:
  PropsRuntime<'plugins.tab'> & InjectFace<PluginTabInjected> & PropsLocale<typeof NS>) {
  return <div className="dsh_market_main"><MarketSection {...props} install={stageReview} /></div>
}

/** Optional on older hosts: wait for the actual Plugins page slot declaration. */
export function registerMarketPluginTab(ctx: Context, injectMarket: () => MarketSectionInjected): void {
  ctx.inject(['layout'], panelCtx => {
    const t = panelCtx.locale.bind(NS)
    panelCtx.effect(() => panelCtx.slots.inject('plugins.tab', () => panelCtx.slots.register({
      name: 'plugins.tab', id: MARKET_TAB_ID, order: 60, label: () => t('nav'), locale: NS,
      inject: () => {
        const { install, ...market } = injectMarket()
        return { ...market, stageReview: install, close: () => panelCtx.layout.selectPanel(null) }
      },
    }, MarketPluginTab)), 'dsh-market-pro: plugins tab')
  })
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
    }), 'dsh-market-pro: left navigation')
  })
}

function MarketIcon({ size = 24, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} className={className} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="6" height="6" rx="1.4" />
    <rect x="14" y="4" width="6" height="6" rx="1.4" />
    <rect x="4" y="14" width="6" height="6" rx="1.4" />
    <path d="M17 12.5 18.3 15.7 21.5 17 18.3 18.3 17 21.5 15.7 18.3 12.5 17 15.7 15.7Z" fill="currentColor" stroke="none" />
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
    sidebarCtx.effect(() => sidebarCtx.sidebarRightTabs.register(definition), 'dsh-market-pro: sidebar type')
    sidebarCtx.effect(() => sidebarCtx.slots.inject('sidebar.right.pane.tab', () => sidebarCtx.slots.register({
      name: 'sidebar.right.pane.tab', key: MARKET_TAB_ID, locale: NS, inject: injectMarket,
    }, MarketSidebar)), 'dsh-market-pro: sidebar body')
  })
}
