/**
 * The entry split, and the property it exists for.
 *
 * The market is copied into `<DSH_HOME>/profiles/node_modules` so its
 * `@deepseek-ai/*` imports resolve to whichever runtime is serving — which is
 * what lets one copy work under the bundled runtime, a dsh on PATH and an
 * npx-cached one alike. The cost of that reach is that the market can meet a
 * runtime it was never built against, with no desktop client present to
 * withdraw it.
 *
 * Two of the body's imports are evaluated at import time and throw when
 * absent: `defineDomain(...)` and the `TypertRemoteService` a class extends.
 * A throw during import fails the
 * WHOLE plugin tree — the deployment's own plugins and any CLI sharing the
 * profile go down with the market. So `lib/index.js` must reach the body
 * through a runtime `import()` inside a guard, and must not touch any of the
 * two itself.
 *
 * These tests read the BUILT artifacts, because the property belongs to the
 * artifacts: a bundler setting that inlines the body would satisfy every
 * source-level reading of the code and still destroy the guarantee.
 *
 * Run with `pnpm test` after `pnpm run build` (which `pnpm run check` does).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entryFile = join(root, 'lib', 'index.js')

/** The catalog base the entry's schema fills in, mirrored from `src/index.ts`. */
const DEFAULT_CATALOG_BASE = 'https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-v2.json'

/** The symbols whose evaluation at import time is what the split defers. */
const DEFERRED = ['TypertRemoteService', 'defineDomain'] as const

test('the built entry never reaches the imports that can throw on a foreign runtime', async () => {
  const entry = await readFile(entryFile, 'utf8')
  for (const symbol of DEFERRED) {
    assert.ok(
      !entry.includes(symbol),
      `lib/index.js mentions ${symbol}: the body has been inlined into the entry, so an incompatible `
      + 'runtime would throw during import and take the whole plugin tree down with it',
    )
  }
  assert.match(
    entry,
    /import\("\.\/plugin\.js"\)/,
    'lib/index.js must reach the body through a runtime import() — a bundled-in body is evaluated eagerly',
  )
})

test('the body keeps the deferred imports (the split is not merely cosmetic)', async () => {
  const body = await readFile(join(root, 'lib', 'plugin.js'), 'utf8')
  for (const symbol of DEFERRED) {
    assert.ok(body.includes(symbol), `lib/plugin.js should carry ${symbol}; the split moved it here`)
  }
})

test('a runtime that cannot load the body loses the market and nothing else', async () => {
  // The entry alone, with no sibling body to import: the same shape a runtime
  // missing one of the required modules presents — the dynamic import rejects.
  const dir = await mkdtemp(join(tmpdir(), 'safe-market-entry-'))
  try {
    await copyFile(entryFile, join(dir, 'index.js'))
    const module = await import(pathToFileURL(join(dir, 'index.js')).href) as {
      name: string
      inject: string[]
      apply: (ctx: unknown, config?: unknown) => void
    }
    assert.equal(module.name, 'safer-dsh-market')
    // The Loader reads these before deciding to load anything; they must
    // survive on a runtime whose body will not load.
    assert.deepEqual(module.inject, ['typert', 'settings', 'skills', 'storageDomain', 'loader'])

    let seat: Promise<unknown> | undefined
    const warnings: unknown[] = []
    const realWarn = console.warn
    console.warn = (...args: unknown[]) => { warnings.push(args[0]) }
    try {
      // `apply` must not throw: the Loader calls it inside the plugin tree's
      // own load, and a throw here is the failure the split exists to prevent.
      module.apply({ effect: (fn: () => unknown) => { seat = Promise.resolve().then(fn) } })
      const disposer = await seat
      assert.equal(typeof disposer, 'function', 'the effect seat must still yield a disposer')
    } finally {
      console.warn = realWarn
    }
    assert.equal(warnings.length, 1, 'the market should say once that it is not loading, and no more')
    assert.match(String(warnings[0]), /cannot load the marketplace/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a fault in the market itself is not reported as a runtime incompatibility', async () => {
  // The body loads and then throws — the market's own bug, not the runtime's
  // fault. Reporting it as "this runtime cannot load the marketplace" sends
  // whoever reads the log hunting a compatibility problem that is not there,
  // and the successful import has already ruled that out.
  const dir = await mkdtemp(join(tmpdir(), 'safe-market-entry-'))
  try {
    await copyFile(entryFile, join(dir, 'index.js'))
    await writeFile(
      join(dir, 'plugin.js'),
      'export function applyMarket() { throw new Error("boom from the body") }\n',
    )
    const module = await import(pathToFileURL(join(dir, 'index.js')).href) as {
      apply: (ctx: unknown, config?: unknown) => void
    }
    let seat: Promise<unknown> | undefined
    const warnings: unknown[] = []
    const errors: unknown[] = []
    const realWarn = console.warn
    const realError = console.error
    console.warn = (...args: unknown[]) => { warnings.push(args[0]) }
    console.error = (...args: unknown[]) => { errors.push(args) }
    try {
      module.apply({ effect: (fn: () => unknown) => { seat = Promise.resolve().then(fn) } })
      const disposer = await seat
      assert.equal(typeof disposer, 'function', 'a failed body must still yield a disposer')
    } finally {
      console.warn = realWarn
      console.error = realError
    }
    assert.equal(warnings.length, 0, 'a body fault is not the compatibility warning')
    assert.equal(errors.length, 1)
    const [message, thrown] = errors[0] as [string, unknown]
    assert.match(message, /fault in the marketplace, not in the runtime/)
    assert.ok(thrown instanceof Error && thrown.message === 'boom from the body',
      'the whole error travels, so nobody has to reproduce it to see the stack')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a body that loads and starts hands its own disposer back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'safe-market-entry-'))
  try {
    await copyFile(entryFile, join(dir, 'index.js'))
    await writeFile(
      join(dir, 'plugin.js'),
      'export const seen = []\n'
      + 'export function applyMarket(ctx, config) { seen.push(config); return () => { seen.push("disposed") } }\n',
    )
    const module = await import(pathToFileURL(join(dir, 'index.js')).href) as {
      apply: (ctx: unknown, config?: unknown) => void
    }
    let seat: Promise<unknown> | undefined
    module.apply({ effect: (fn: () => unknown) => { seat = Promise.resolve().then(fn) } })
    const disposer = await seat as () => void
    const body = await import(pathToFileURL(join(dir, 'plugin.js')).href) as { seen: unknown[] }
    // The entry, not the body, is what applies the schema defaults.
    const { enabled, ...ordinary } = body.seen[0] as { enabled: { get(): boolean }; [key: string]: unknown }
    assert.deepEqual(ordinary, { catalogBase: DEFAULT_CATALOG_BASE, marketSize: 1000, profile: 'web' })
    assert.equal(enabled.get(), false)
    disposer()
    assert.equal(body.seen[1], 'disposed', 'the body owns teardown; the entry only passes it through')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

/**
 * The entry's weight, which is the other half of the same property.
 *
 * `src/contract.ts` builds every wire codec at module scope, so importing a
 * single constant from it evaluates the whole of zod — and the entry needs
 * exactly one constant (the package name) plus two patterns. Reaching them
 * through the contract cost the entry ~550 KB of eagerly evaluated schema
 * code, in the one file whose entire job is to be the smallest thing a
 * foreign runtime can import. `src/shapes.ts` exists to keep them apart; this
 * test is what stops an innocent-looking import from quietly undoing it.
 */
test('the entry stays light: no wire codecs are pulled into it', async () => {
  const entry = await readFile(entryFile, 'utf8')
  for (const marker of ['ZodString', 'ZodObject', '$ZodType']) {
    assert.ok(
      !entry.includes(marker),
      `lib/index.js carries ${marker}: something it imports reaches src/contract.ts, which evaluates `
      + 'every zod codec at module scope. Take the value from src/shapes.ts instead.',
    )
  }
  const kb = Buffer.byteLength(entry) / 1024
  assert.ok(kb < 100, `lib/index.js is ${kb.toFixed(0)} KB; the entry is meant to stay under 100 KB`)
})
