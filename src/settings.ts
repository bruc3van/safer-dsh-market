/** The market switch is a volatile Config field persisted by DSH Settings. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { Config } from './index.ts'
import type { SafeMarketSettings } from './contract.ts'

/** Bind the custom market page to its actual Loader entry and live Config. */
export function registerSafeMarketSettings(ctx: Context, config: Config): {
  get(): SafeMarketSettings
  update(patch: SafeMarketSettings): Promise<void>
} {
  const entryId = ctx.fiber.entry?.options.id
  if (entryId === undefined) throw new Error('Safe Market settings require a profile entry')
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber), 'safe-market: settings page')
  return {
    get: () => ({ enabled: config.enabled.get() }),
    update: patch => ctx.settings.update(entryId, patch),
  }
}
