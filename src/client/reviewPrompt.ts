import type { MarketLocale } from './copy.ts'

/** Every AI install/update entry uses the same localized policy and target. */
export function buildReviewPrompt(t: MarketLocale, request: {
  profile: string
  url: string
  installed?: string
}): string {
  const { profile, url, installed } = request
  return installed === undefined
    ? t('prompt', { profile, url })
    : t('prompt.upgrade', { profile, url, installed })
}
