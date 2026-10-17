/**
 * Package-owned invariant companion for `safer-dsh-market`.
 * @module safer-dsh-market/invariant
 */

import type { Context } from '@deepseek-ai/cordis'

// Legacy companion only: alpha.5 removed dsh-invariants. Keep this optional
// export loadable for older profiles without importing the retired package.
interface LegacyInvariants {
  register(name: string, install: () => void): () => void
}

const PACKAGE_NAME = 'safer-dsh-market'

/** Cordis companion plugin name. */
export const name = 'safer-dsh-market-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the catalog is derived per read from a public
 * snapshot and cached only in the reader's own closure, the settings
 * namespace and the strict Typert manifest are registry-owned registrations,
 * and the install hand-off writes one composer draft through the published
 * conversation face. None is a cross-plugin mutable relationship an
 * event-stream invariant could hold.
 */
const install = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve((ctx.reflect.get('invariants') as LegacyInvariants).register(PACKAGE_NAME, install))
