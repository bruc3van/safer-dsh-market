/**
 * Regression tests for the skills read.
 *
 * The registry is reached structurally (`ctx.skills.snapshot`), so a plain
 * object stands in for it — these cover this module's own reduction: what it
 * asks the registry for, how it sanitizes the answer, and what it reports
 * when there is no answer at all.
 *
 * The read's honesty about incompleteness is the property worth pinning: a
 * list that quietly lost a provider's skills reads as "you have none of
 * those", which is a different and wrong statement.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import { readSkills, skillDirectory, type SkillReadAgent } from '../src/skills.ts'
import { marketSkillsResultSchema } from '../src/contract.ts'

/** One registry row in the shape `snapshot` returns. */
interface Row {
  name: string
  description?: string
  whenToUse?: string
  provider: string
  source?: string
  path?: string
  resourceBase?: { kind: 'directory'; path: string } | { kind: 'url'; url: string }
  invocation: { modelInvocable: boolean; userInvocable: boolean }
}

const row = (name: string, extra: Partial<Row> = {}): Row => ({
  name,
  provider: 'filesystem',
  invocation: { modelInvocable: true, userInvocable: false },
  ...extra,
})

/** A context whose skill registry answers with the given observation. */
function ctxWith(
  answer: { skills: Row[]; complete: boolean } | Error,
  seen?: { options?: unknown },
): Context {
  return {
    skills: {
      snapshot: (options: unknown) => {
        if (seen !== undefined) seen.options = options
        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
      },
    },
  } as unknown as Context
}

const agent = (cwd?: string): SkillReadAgent => ({ session: { header: { cwd } } })

/** Make `addressed` the live Agent of Session `s1` in `ctx`, then read that Session. */
function read(ctx: Context, addressed: SkillReadAgent, signal: AbortSignal) {
  Object.assign(ctx, { get: (name: string) => name === 'agents' ? { get: (id: string) => id === 's1' ? addressed : undefined } : undefined })
  return readSkills(ctx, 's1', signal)
}

test('new hosts discover and label skills in the committed working directory', async () => {
  const seen: { options?: unknown } = {}
  const ctx = ctxWith({ skills: [row('local', { resourceBase: { kind: 'directory', path: '/new/.agents/skills/local' } })], complete: true }, seen)
  const addressed = agent('/original')
  Object.assign(ctx, { reflect: { get: (name: string) => {
    assert.equal(name, 'workingDirectory')
    return { get: (session: unknown) => { assert.equal(session, addressed.session); return '/new' } }
  } } })
  const signal = new AbortController().signal
  const result = await read(ctx, addressed, signal)
  assert.deepEqual(seen.options, { cwd: '/new', signal, scope: addressed })
  assert.equal(result.skills[0]?.sourceDirectory, '.agents/skills')
})

test('a deployment with no skill registry says so instead of reporting an empty list', async () => {
  const result = await read({} as Context, agent('/w'), AbortSignal.abort())
  assert.deepEqual(result, { skills: [], complete: false, error: 'the skill registry is not mounted' })
})

test('the read is addressed by the agent: its cwd and its scope reach the registry', async () => {
  const seen: { options?: unknown } = {}
  const signal = new AbortController().signal
  const addressed = agent('/home/me/project')
  await read(ctxWith({ skills: [], complete: true }, seen), addressed, signal)
  // The scope IS the agent — that is what selects the layer chain that can
  // answer; a read from the plugin's root context sees the global layer alone.
  assert.deepEqual(seen.options, { cwd: '/home/me/project', signal, scope: addressed })
})

test('an agent with no cwd still reads (the registry gets undefined, not an empty path)', async () => {
  const seen: { options?: unknown } = {}
  await read(ctxWith({ skills: [], complete: true }, seen), agent(), AbortSignal.abort())
  assert.equal((seen.options as { cwd?: string }).cwd, undefined)
})

test('skills come back sorted by name, whatever order the registry returned', async () => {
  const result = await read(
    ctxWith({ skills: [row('zebra'), row('alpha'), row('Mango')], complete: true }),
    agent('/w'),
    AbortSignal.abort(),
  )
  assert.deepEqual(result.skills.map(skill => skill.name), ['alpha', 'Mango', 'zebra'])
  assert.equal(result.complete, true)
  assert.equal(result.error, '')
})

test('the invocation flags are carried per skill, not merged', async () => {
  const result = await read(
    ctxWith({
      skills: [
        row('model-only', { invocation: { modelInvocable: true, userInvocable: false } }),
        row('user-only', { invocation: { modelInvocable: false, userInvocable: true } }),
      ],
      complete: true,
    }),
    agent('/w'),
    AbortSignal.abort(),
  )
  assert.deepEqual(
    result.skills.map(skill => [skill.name, skill.modelInvocable, skill.userInvocable]),
    [['model-only', true, false], ['user-only', false, true]],
  )
})

test('text fields are collapsed and truncated, and a missing one becomes empty', async () => {
  const result = await read(
    ctxWith({
      skills: [row('a', { description: '  spread\n over\tlines  ', whenToUse: undefined })],
      complete: true,
    }),
    agent('/w'),
    AbortSignal.abort(),
  )
  assert.equal(result.skills[0]!.description, 'spread over lines')
  assert.equal(result.skills[0]!.whenToUse, '')
})

test('an over-long description is cut by code point, never splitting a surrogate pair', async () => {
  // 401 astral code points against the 400 limit: a UTF-16 cut would leave a
  // lone high surrogate at the end.
  const long = '𝄞'.repeat(401)
  const result = await read(
    ctxWith({ skills: [row('a', { description: long })], complete: true }),
    agent('/w'),
    AbortSignal.abort(),
  )
  const cut = result.skills[0]!.description
  assert.equal([...cut].length, 400)
  assert.ok(cut.endsWith('…'))
  assert.deepEqual([...cut].slice(0, -1), Array.from({ length: 399 }, () => '𝄞'))
})

test('incomplete discovery is carried through rather than smoothed over', async () => {
  const result = await read(
    ctxWith({ skills: [row('a')], complete: false }),
    agent('/w'),
    AbortSignal.abort(),
  )
  // The skills that DID resolve are still served — the flag is what tells the
  // page the list may be short.
  assert.equal(result.skills.length, 1)
  assert.equal(result.complete, false)
  assert.equal(result.error, '')
})

test('a registry that throws answers with the reason, not with a silent empty list', async () => {
  const result = await read(ctxWith(new Error('provider exploded')), agent('/w'), AbortSignal.abort())
  assert.deepEqual(result, { skills: [], complete: false, error: 'provider exploded' })
})

test('an error with no message still names itself', async () => {
  const result = await read(ctxWith(new Error('')), agent('/w'), AbortSignal.abort())
  assert.equal(result.error, 'unknown error')
  assert.equal(result.complete, false)
})


test('directory labels preserve workspace, home, custom and Windows provenance', () => {
  assert.equal(skillDirectory('/work/.agents/skills/design', '/work', '/home/me'), '.agents/skills')
  assert.equal(skillDirectory('/home/me/.agents/skills/design', '/work', '/home/me'), '~/.agents/skills')
  assert.equal(skillDirectory('/shared/skills/design', '/work', '/home/me'), '/shared/skills/design')
  assert.equal(skillDirectory('/work-other/design', '/work', '/home/me'), '/work-other/design')
  assert.equal(skillDirectory('C:/work/.agents/skills/design', 'C:/work', 'C:/Users/me'), '.agents/skills')
  assert.equal(skillDirectory('D:/skills/design', 'C:/work', 'C:/Users/me'), 'D:/skills/design')
})

test('skill reads carry actual resource directories without guessing from provider names', async () => {
  const result = await read(ctxWith({complete: true, skills: [
    row('disk', {provider: 'local', source: 'project-agents', path: '/work/.agents/skills/disk/SKILL.md',
      resourceBase: {kind: 'directory', path: '/work/.agents/skills/disk'}}),
    row('remote', {resourceBase: {kind: 'url', url: 'https://example.com/skill'}}),
    row('runtime'),
  ]}), agent('/work'), new AbortController().signal)
  assert.equal(result.skills[0]!.sourceDirectory, '.agents/skills')
  assert.equal(result.cwd, '/work')
  const [disk, remote] = marketSkillsResultSchema.parse(result).skills
  assert.equal(disk!.source, 'project-agents')
  assert.equal(disk!.instructionPath, '/work/.agents/skills/disk/SKILL.md')
  assert.equal(remote!.instructionPath, undefined)
  assert.equal(result.skills[1]!.sourceDirectory, undefined)
  assert.equal(result.skills[2]!.sourceDirectory, undefined)
  // The folder action opens the skill's own directory, verbatim; a skill
  // with no directory offers no folder to open.
  assert.equal(result.skills[0]!.sourcePath, '/work/.agents/skills/disk')
  assert.equal(result.skills[1]!.sourcePath, undefined)
  assert.equal(result.skills[2]!.sourcePath, undefined)
})

test('a skill directory unfit for the folder action is labelled but not offered', async () => {
  const result = await read(ctxWith({complete: true, skills: [
    row('spaced', {resourceBase: {kind: 'directory', path: 'C:/Program Files/My  Skills/spaced'}}),
    row('control', {resourceBase: {kind: 'directory', path: '/work/skills/bad\nname'}}),
    row('long', {resourceBase: {kind: 'directory', path: `/${'a'.repeat(5000)}`}}),
  ]}), agent('/work'), new AbortController().signal)
  const byName = new Map(result.skills.map(skill => [skill.name, skill]))
  // Runs of spaces are real path text and must not be collapsed.
  assert.equal(byName.get('spaced')!.sourcePath, 'C:/Program Files/My  Skills/spaced')
  assert.equal(byName.get('control')!.sourcePath, undefined)
  assert.equal(byName.get('long')!.sourcePath, undefined)
  assert.doesNotThrow(() => marketSkillsResultSchema.parse(result))
})

/** A host with no live Agent for the Session: only cold reads may answer. */
function coldHost(options: {
  observation?: { header: { cwd?: string }; projections?: { values: { workingDirectory?: string | null; agentPreset?: string | null } } } | Error
  presets?: boolean
  scopeFails?: boolean
  snapshotFails?: boolean
  seen: { options?: unknown; events: string[] }
}): Context {
  const { observation, seen } = options
  const services: Record<string, unknown> = {
    agents: { get: () => undefined },
    sessionQuery: { observeSession: async (id: string) => {
      seen.events.push(`observe:${id}`)
      if (observation instanceof Error) throw observation
      return { ...observation, [Symbol.dispose]: () => seen.events.push('observation-released') }
    } },
    workingDirectory: { defaultDirectory: '/default' },
    ...(options.presets ? { agentPresets: {
      serviceFor: () => { throw new Error('a cold read has no Agent to scope') },
      acquireScope: async (id?: string) => {
        seen.events.push(`scope:${id}`)
        if (options.scopeFails) throw new Error('unknown preset')
        return { key: `key:${id}`, [Symbol.asyncDispose]: async () => { seen.events.push('scope-released') } }
      },
    } } : {}),
  }
  return {
    get: (name: string) => services[name],
    skills: { snapshot: async (snapshot: unknown) => {
      seen.options = snapshot
      if (options.snapshotFails) throw new Error('provider exploded')
      return { skills: [row('cold')], complete: true }
    } },
  } as unknown as Context
}

test('a cold Session is read from its projections and preset scope without resuming it', async () => {
  const seen = { events: [] as string[] } as { options?: unknown; events: string[] }
  const ctx = coldHost({ seen, presets: true, observation: {
    header: { cwd: '/original' }, projections: { values: { workingDirectory: '/work', agentPreset: 'coder' } },
  } })
  const signal = new AbortController().signal
  const result = await readSkills(ctx, 'cold-1', signal)
  assert.equal(result.error, '')
  assert.equal(result.cwd, '/work')
  assert.deepEqual(result.skills.map(skill => skill.name), ['cold'])
  assert.deepEqual(seen.options, { cwd: '/work', signal, scope: 'key:coder' })
  assert.deepEqual(seen.events, ['observe:cold-1', 'observation-released', 'scope:coder', 'scope-released'])
})

test('a cold Session falls back to its header and then the default directory', async () => {
  const seen = { events: [] as string[] } as { options?: unknown; events: string[] }
  await readSkills(coldHost({ seen, observation: { header: { cwd: '/header' } } }), 's', AbortSignal.abort())
  assert.equal((seen.options as { cwd?: string }).cwd, '/header')
  assert.equal((seen.options as { scope?: unknown }).scope, undefined, 'no preset service: the global registry answers')
  await readSkills(coldHost({ seen, observation: { header: {} } }), 's', AbortSignal.abort())
  assert.equal((seen.options as { cwd?: string }).cwd, '/default')
})

test('an unknown Session is reported, not listed as having no skills', async () => {
  const seen = { events: [] as string[] } as { options?: unknown; events: string[] }
  const missing = Object.assign(new Error('gone'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' })
  const result = await readSkills(coldHost({ seen, observation: missing }), 'nope', AbortSignal.abort())
  assert.equal(result.complete, false)
  assert.match(result.error, /session "nope" not found/)
  assert.equal(seen.options, undefined)
})

test('a live Agent reads its preset-scoped skills service before the root registry', async () => {
  const addressed = agent('/w')
  const scoped = { snapshot: async () => ({ skills: [row('preset-only')], complete: true }) }
  const ctx = {
    get: (name: string) => name === 'agents' ? { get: () => addressed }
      : name === 'agentPresets' ? { serviceFor: (live: unknown, service: string) => live === addressed && service === 'skills' ? scoped : undefined }
      : undefined,
    skills: { snapshot: async () => ({ skills: [row('root')], complete: true }) },
  } as unknown as Context
  const result = await readSkills(ctx, 'live', AbortSignal.abort())
  assert.deepEqual(result.skills.map(skill => skill.name), ['preset-only'])
})

test('a host without Session reads asks for an open Session instead of resuming one', async () => {
  const ctx = { get: () => undefined, skills: { snapshot: async () => ({ skills: [], complete: true }) } } as unknown as Context
  const result = await readSkills(ctx, 'cold', AbortSignal.abort())
  assert.equal(result.complete, false)
  assert.match(result.error, /open the session first/)
})

test('an unusable recorded preset falls back to the global registry', async () => {
  const seen = { events: [] as string[] } as { options?: unknown; events: string[] }
  const ctx = coldHost({ seen, presets: true, scopeFails: true, observation: {
    header: {}, projections: { values: { workingDirectory: null, agentPreset: 'gone' } },
  } })
  const result = await readSkills(ctx, 's', AbortSignal.abort())
  assert.equal(result.error, '')
  assert.equal((seen.options as { cwd?: string }).cwd, '/default', 'a null projection falls through to the default')
  assert.equal((seen.options as { scope?: unknown }).scope, undefined)
})

test('the preset scope is released even when the registry read fails', async () => {
  const seen = { events: [] as string[] } as { options?: unknown; events: string[] }
  const ctx = coldHost({ seen, presets: true, snapshotFails: true, observation: { header: { cwd: '/w' } } })
  const result = await readSkills(ctx, 's', AbortSignal.abort())
  assert.match(result.error, /provider exploded/)
  assert.deepEqual(seen.events.slice(-2), ['scope:undefined', 'scope-released'])
})

test('a non-object observation failure is reported instead of crashing the read', async () => {
  const ctx = { get: (name: string) => name === 'sessionQuery' ? { observeSession: () => Promise.reject(undefined) } : undefined,
    skills: { snapshot: async () => ({ skills: [], complete: true }) } } as unknown as Context
  const result = await readSkills(ctx, 's', AbortSignal.abort())
  assert.equal(result.complete, false)
  assert.notEqual(result.error, '')
})
