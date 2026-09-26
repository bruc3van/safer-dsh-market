/**
 * The hand-written Host Typert manifest for the saferMarket Remote. Registered
 * through `ctx.typert.register` in the plugin body, it claims the wire
 * endpoints through the strict registry — the same path generated `./typert`
 * artifacts use — so the Host Gateway resolves the market's calls without
 * consulting the `@Remote` marker table. That marker independence matters in
 * the harness's source-launch development environment, where the tsx-loaded
 * gateway and a profile-loaded plugin bundle can hold separate copies of the
 * decorator module state.
 */
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { SAFE_MARKET_INVOCATIONS } from './contract.ts'

/** The saferMarket namespace's host manifest (strict codecs shared with the client). */
export const TYPERT_MANIFEST: TypertContribution = {
  package: 'safer-dsh-market',
  face: 'host',
  schemas: [],
  model: {
    services: [
      {
        key: 'saferMarket',
        exportName: 'SafeMarketRuntime',
        description: 'The reduced community plugin catalog and the market\'s durable settings.',
        tags: [],
        members: [
          {
            kind: 'method',
            name: 'getCatalog',
            signature: 'getCatalog(force: boolean, signal: AbortSignal): Promise<MarketCatalogResult>',
          },
          {
            kind: 'method',
            name: 'listSkills',
            signature: 'listSkills(agent: Agent, signal: AbortSignal): Promise<MarketSkillsResult>',
          },
          {
            kind: 'method',
            name: 'describe',
            signature: 'describe(): MarketEnvironment',
          },
          {
            kind: 'method',
            name: 'getSettings',
            signature: 'getSettings(): SafeMarketSettings',
          },
          {
            kind: 'method',
            name: 'updateSettings',
            signature: 'updateSettings(update: SafeMarketSettingsUpdate): Promise<SafeMarketSettings>',
          },
          {
            kind: 'method',
            name: 'listInstalled',
            signature: 'listInstalled(): Promise<MarketInstalledResult>',
          },
          {
            kind: 'method',
            name: 'setInstalledEnabled',
            signature: 'setInstalledEnabled(update: SetInstalledEnabledUpdate): Promise<MarketInstalledResult>',
          },
          {
            kind: 'method',
            name: 'uninstallInstalled',
            signature: 'uninstallInstalled(update: UninstallInstalledUpdate): Promise<MarketInstalledResult>',
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: SAFE_MARKET_INVOCATIONS,
}
