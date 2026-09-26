import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  currentSessionOf,
  workspaceReady,
  workspaceTargetOf,
} from '../src/client/workspaceCompat.ts'

test('workspace readiness requires both split Controller baselines', () => {
  assert.equal(workspaceReady(
    { phase: 'pending', items: [] },
    { phase: 'ready', byId: {} },
  ), false)
  assert.equal(workspaceReady(
    { phase: 'ready', items: [] },
    { phase: 'pending', byId: {} },
  ), false)
  assert.equal(workspaceReady(
    { phase: 'ready', items: [] },
    { phase: 'ready', byId: {} },
  ), true)
})

test('workspace selection derives the latest target for split Controllers', () => {
  const state = {
    phase: 'ready' as const,
    items: [
      { workspaceId: 'older', sessionIds: ['s1'], createdAt: '2026-01-01T00:00:00Z' },
      { workspaceId: 'newer', sessionIds: ['s2'], createdAt: '2026-02-01T00:00:00Z' },
    ],
  }
  assert.equal(workspaceTargetOf(state, {
    phase: 'ready',
    byId: { s1: { id: 's1', updatedAt: 10, retainedBy: {} }, s2: { id: 's2', updatedAt: 20, retainedBy: {} } },
  }), 'newer')
  assert.equal(workspaceTargetOf(state, {
    phase: 'ready',
    byId: { s1: { id: 's1', updatedAt: 10, retainedBy: { mainView: 1 } }, s2: { id: 's2', updatedAt: 20, retainedBy: {} } },
  }), 'older')
})

test('current session follows main-view retention rather than sidebar or background ownership', () => {
  const byId = {
    side: { id: 'side', updatedAt: 30, retainedBy: { sidebar: 1 } },
    main: { id: 'main', updatedAt: 10, retainedBy: { mainView: 1 } },
  }
  assert.equal(currentSessionOf({ phase: 'ready', byId }), 'main')
  byId.main.retainedBy.mainView = 0
  assert.equal(currentSessionOf({ phase: 'ready', byId }), undefined)
  byId.side.retainedBy.mainView = 1
  assert.equal(currentSessionOf({ phase: 'ready', byId }), 'side')
})
