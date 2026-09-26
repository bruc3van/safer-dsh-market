import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { en, zh } from '../src/client/locales.ts'

test('unified drafts preserve artifact pinning, zero execution, and stop gates', () => {
  for (const dictionary of [en, zh]) {
    for (const key of ['prompt', 'prompt.upgrade'] as const) {
      const prompt = dictionary[key]
      for (const anchor of ['dist.integrity', 'latest', 'monorepo', 'allowBuilds',
        '$env:DSH_WEB_URL', 'Get-NetTCPConnection -State Listen',
        '$DSH_HOME/profiles/{profile}/node_modules/.pnpm/lock.yaml']) {
        assert.ok(prompt.includes(anchor), `${key} missing ${anchor}`)
      }
      assert.match(prompt, /禁止版本范围|No version ranges/)
      assert.match(prompt, /不得运行被审产物的任何脚本|Do not run any script from the artifact/)
      assert.match(prompt, /不要卸载\/重装\/再试|do not uninstall\/reinstall\/retry/)
      assert.match(prompt, /不要写进任何文件、不要绕过|Do not write it into any file or bypass/)
      assert.match(prompt, /不为验证启动任何 dsh 实例|Do not start any dsh instance/)
      assert.match(prompt, /默认只有 3 段|exactly 3 sections/)
      assert.match(prompt, /这一行不能省|never omit this line/)
    }
  }
})

test('unified templates preserve custom profiles and upgrade version comparison', () => {
  for (const dictionary of [zh, en]) {
    for (const key of ['prompt', 'prompt.upgrade'] as const) {
      const rendered = dictionary[key].replaceAll('{profile}', 'custom-profile')
      assert.ok(rendered.includes('$DSH_HOME/profiles/custom-profile/node_modules/.pnpm/lock.yaml'))
      assert.equal(rendered.includes('{profile}'), false)
      assert.equal(rendered.includes('{installed}'), key === 'prompt.upgrade')
    }
    assert.match(dictionary['prompt.upgrade'], /已是最新|Already up to date/)
    assert.deepEqual(Object.keys(dictionary).filter(key => key.startsWith('prompt')), ['prompt', 'prompt.upgrade'])
    assert.equal(Object.keys(dictionary).some(key => key.startsWith('review.')), false)
  }
})

test('the built market no longer presents a review mode selector', async () => {
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const removed of ['ReviewSelector', 'review-mode', 'prompt.compact', '精简审查', '完整审查']) {
    assert.equal(bundle.includes(removed), false, `obsolete UI in bundle: ${removed}`)
  }
})

test('all AI entry points render the shared channel policy in both languages and every profile', async () => {
  const { buildReviewPrompt } = await import('../src/client/reviewPrompt.ts')
  const { reviewChannelZh, reviewChannelEn } = await import('../src/client/reviewPolicy.ts')
  const requests = [
    { entry: 'new third-party install', url: 'https://github.com/acme/plugin' },
    { entry: 'catalog installed-card upgrade', url: 'https://github.com/acme/plugin', installed: 'demo-plugin 1.0.0' },
    { entry: 'installed-list upgrade', url: 'https://github.com/acme/plugin', installed: '@acme/plugin 1.0.0' },
    { entry: 'market self-upgrade', url: 'https://github.com/bruc3van/safer-dsh-market', installed: 'safer-dsh-market 0.7.3' },
  ]
  for (const [dictionary, policy] of [[zh, reviewChannelZh], [en, reviewChannelEn]] as const) {
    for (const profile of ['desktop', 'DeSkToP', 'web', 'research-team']) {
      for (const request of requests) {
        const prompt = buildReviewPrompt((key, params) => Object.entries(params ?? {}).reduce(
          (text, [key, value]) => text.replaceAll(`{${key}}`, value), dictionary[key]), { ...request, profile })
        assert.ok(prompt.includes(policy.replaceAll('{profile}', profile)), request.entry)
        assert.ok(prompt.includes(request.url))
        assert.ok(!/\{(?:profile|url|installed)\}/.test(prompt))
        assert.match(prompt, /pendingBuilds/)
        assert.match(prompt, /approvedBuilds/)
        assert.match(prompt, /restart-required/)
        assert.match(prompt, /overridden/)
        if (request.installed) {
          assert.ok(prompt.includes(request.installed))
          assert.match(prompt, /已是最新|Already up to date/)
        }
      }
    }
  }
})
