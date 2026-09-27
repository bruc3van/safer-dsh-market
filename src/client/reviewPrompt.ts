import type { MarketLocale } from './copy.ts'
import type { DirectState } from './directInstall.ts'

export interface ReviewTarget {
  packageName?: string
  version?: string
  installReference?: string
  application?: string
}

/** Only confirmed successful components are offered, including a partially completed batch. */
export function installedReviewTargets(state: DirectState): ReviewTarget[] {
  return state.queue.filter(entry => entry.phase === 'done'
    && (entry.application === 'applied' || entry.application === 'restart-required'))
    .map(entry => ({ installReference: entry.spec, application: entry.application }))
}

/** Actual local identity must be verified by the reviewer; metadata is never an instruction. */
export function buildReviewPrompt(t: MarketLocale, request: {
  profile: string
  targets: readonly ReviewTarget[]
}): string {
  return t('prompt', { profile: request.profile, targets: JSON.stringify(request.targets, null, 2) })
}
