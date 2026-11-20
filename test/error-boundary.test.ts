import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { zh } from '../src/client/locales.ts'

// The host supplies the shared UI primitives at runtime; these bundles only need JSX transformed.
const primitivesStub = { '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(new URL('./support/primitives-stub.tsx', import.meta.url)) }

// Transform JSX for Node's test runner; there is no DOM renderer here, so the
// boundary's lifecycle methods are driven by hand.
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/MarketErrorBoundary.tsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', alias: primitivesStub,
})
const { MarketErrorBoundary, describeCrash } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
)

const t = (key: keyof typeof zh) => zh[key]

test('a crash report names the surface, the error and both stacks', () => {
  const error = new TypeError("Cannot read properties of undefined (reading 'list')")
  const report = describeCrash('main', error, '\n    at PluginsPage')
  assert.match(report, /^\[dsh-market-pro\] main\n/)
  assert.match(report, /TypeError: Cannot read properties of undefined \(reading 'list'\)/)
  assert.match(report, /at PluginsPage/)
  assert.match(describeCrash('sidebar', 'plain string', ''), /plain string/)
})

test('a crash report collapses the Host combo URL and drops the origin', () => {
  const error = new Error('boom')
  error.stack = [
    'Error: boom',
    '    at MarketSection (http://127.0.0.1:47822/plugins/??a/client.js,dsh-market-pro/client.js&rev=950de7ea:15723:27539)',
    '    at Dd (http://127.0.0.1:47822/assets/index-BgUyXZcc.js:57:17330)',
  ].join('\n')
  const report = describeCrash('main', error, '\n    at PluginsPage (http://127.0.0.1:47822/plugins/??x/client.js&rev=1:9:9)')
  assert.match(report, /at MarketSection \(plugins-bundle:15723:27539\)/)
  assert.match(report, /at PluginsPage \(plugins-bundle:9:9\)/)
  assert.match(report, /at Dd \(\/assets\/index-BgUyXZcc\.js:57:17330\)/)
  assert.doesNotMatch(report, /127\.0\.0\.1/)
})

test('the boundary swaps a crashed subtree for a visible notice and remounts on retry', () => {
  const child = { type: 'div', props: {}, key: null }
  const boundary = new MarketErrorBoundary({ t, surface: 'main', children: child })
  const healthy = boundary.render()
  assert.equal(healthy.props.children, child)
  assert.equal(healthy.key, '0')

  const error = new Error('boom')
  boundary.state = { ...boundary.state, ...MarketErrorBoundary.getDerivedStateFromError(error) }
  const notice = boundary.render()
  assert.equal(notice.props.message, 'boom')
  assert.match(notice.props.report, /\[dsh-market-pro\] main\nError: boom/)

  let next: any
  boundary.setState = (update: (previous: any) => any) => { next = update(boundary.state) }
  notice.props.onRetry()
  assert.equal(next.crash, null)
  assert.equal(next.attempt, 1, 'retry remounts the subtree under a fresh key')
})
