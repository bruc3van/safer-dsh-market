/**
 * The version-consistency gate.
 *
 * A version bump has more seats than package.json: the plugin manifest, the
 * GitHub tarball URLs the READMEs still pin as the version-locked install,
 * and the npm package-name install that is now the default. This test is the
 * gate. The tag workflow (`.github/workflows/release.yml`) is what actually
 * publishes that version to npm — the last check below is so a release
 * cannot quietly drop that job.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as {
  name: string
  version: string
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}
const plugin = JSON.parse(await readFile(resolve(root, 'dsh.plugin.json'), 'utf8')) as { version: string }

const npmInstall = `dsh plugin --profile web add ${pkg.name}`

test('DSH dependencies keep the declared runtime and development baseline', () => {
  for (const [kind, expected] of [
    ['peerDependencies', '^0.1.7-rc.2'],
    ['devDependencies', '0.1.7-rc.2'],
  ] as const) {
    const dependencies = Object.entries(pkg[kind]).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
    assert.ok(dependencies.length > 0, `${kind} must declare DSH dependencies`)
    for (const [name, version] of dependencies) {
      assert.equal(version, expected, `${kind}.${name} must use the DSH baseline`)
    }
  }
})

/** Every release-tarball tag a README pins, e.g. `v0.2.2`. */
function tarballTags(markdown: string): string[] {
  return [...markdown.matchAll(/archive\/refs\/tags\/(v\d+\.\d+\.\d+)\.tar\.gz/g)].map(match => match[1]!)
}

test('dsh.plugin.json declares the same version as package.json', () => {
  assert.equal(
    plugin.version,
    pkg.version,
    `dsh.plugin.json says ${plugin.version} but package.json says ${pkg.version} — bump both together`,
  )
})

for (const name of ['README.md', 'README_EN.md'] as const) {
  test(`${name} offers the npm package-name install`, async () => {
    const markdown = await readFile(resolve(root, name), 'utf8')
    assert.ok(
      markdown.includes(npmInstall),
      `${name} must keep the npm install command \`${npmInstall}\` (the default install and the copyable agent prompt)`,
    )
  })

  test(`${name} pins the release tarball to the current version`, async () => {
    const markdown = await readFile(resolve(root, name), 'utf8')
    const tags = tarballTags(markdown)
    assert.ok(
      tags.length > 0,
      `${name} must keep at least one release-tarball install URL (the version-locked fallback)`,
    )
    for (const tag of tags) {
      assert.equal(
        tag,
        `v${pkg.version}`,
        `${name} references ${tag}, but the package version is ${pkg.version} — update the tarball install alongside the bump`,
      )
    }
  })

  test(`${name} states the DSH 0.1.7 compatibility baseline`, async () => {
    const markdown = await readFile(resolve(root, name), 'utf8')
    assert.match(markdown, /0\.1\.7-rc\.2/)
    assert.match(markdown, /0\.1\.1/)
    assert.match(
      markdown,
      name === 'README.md' ? /不兼容 DSH 0\.1\.1 和 0\.1\.2/ : /does not support the DSH 0\.1\.1 or 0\.1\.2/,
      `${name} must state that the current release does not support DSH 0.1.1 or 0.1.2`,
    )
    assert.match(markdown, /dsh-desktop-safe-market@0\.3\.0/)
    assert.match(markdown, /dsh-desktop-safe-market@0\.4\.3/)
  })
}

test('release workflow publishes to npm via Trusted Publishing', async () => {
  const yaml = await readFile(resolve(root, '.github/workflows/release.yml'), 'utf8')
  assert.match(
    yaml,
    /run:\s*npm publish --access public/,
    'release.yml must run `npm publish --access public` so a tag cannot ship GitHub-only',
  )
  assert.match(
    yaml,
    /^\s+id-token:\s*write\s*$/m,
    'release.yml must grant `id-token: write` for npm Trusted Publishing (OIDC)',
  )
})

test('workflows use the Node 24-compatible pnpm setup action', async () => {
  for (const name of ['check.yml', 'release.yml'] as const) {
    const yaml = await readFile(resolve(root, '.github/workflows', name), 'utf8')
    assert.match(
      yaml,
      /uses:\s*pnpm\/action-setup@v6/,
      `${name} must use pnpm/action-setup@v6 so GitHub Actions does not run the deprecated Node 20 action runtime`,
    )
    assert.doesNotMatch(
      yaml,
      /uses:\s*pnpm\/action-setup@v[1-5](?:\s|$)/,
      `${name} must not use a pnpm/action-setup release backed by the deprecated Node 20 action runtime`,
    )
  }
})
