import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'

/** Workspace identities are opaque to this adapter and only passed back to DSH services. */
export type WorkspaceTarget = Parameters<UiWorkspace['openWorkspace']>[0]

/** Workspace facts exposed by the DSH Workspace Controller. */
export interface WorkspaceState {
  readonly phase: 'pending' | 'ready'
  readonly items: readonly {
    readonly workspaceId: WorkspaceTarget
    readonly sessionIds: readonly string[]
    readonly createdAt?: string
  }[]
}

/** Session-list facts needed to select the current or most recent Workspace. */
export interface SessionListState {
  readonly phase: 'pending' | 'ready'
  readonly byId: Readonly<Record<string, Pick<SessionSummary, 'id' | 'updatedAt' | 'retainedBy'>>>
}

/** Workspace Controller face consumed by the market. */
export type MarketWorkspaces = Pick<IWorkspaces, 'list' | 'create'>

/** Cross-Controller navigation supplied by the DSH Web profile. */
export type MarketUiWorkspace = Pick<UiWorkspace, 'openWorkspace' | 'pickDirectory'>

/** The main conversation owns a mainView reference; other references do not select it. */
export function currentSessionOf(sessions: SessionListState): SessionSummary['id'] | undefined {
  return Object.values(sessions.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id
}

/** Whether the active DSH generation has received both Workspace and Session baselines. */
export function workspaceReady(state: WorkspaceState, sessions: SessionListState): boolean {
  return state.phase === 'ready' && sessions.phase === 'ready'
}

/**
 * Select the same Workspace target used by DSH New Session: current first,
 * then recency derived from the split Controllers.
 */
export function workspaceTargetOf(
  state: WorkspaceState,
  sessions: SessionListState,
): WorkspaceTarget | undefined {
  const current = currentSessionOf(sessions)
  const currentWorkspaceId = current === undefined
    ? undefined
    : state.items.find(item => item.sessionIds.includes(current))?.workspaceId
  if (currentWorkspaceId !== undefined) return currentWorkspaceId
  let selected: WorkspaceTarget | undefined
  let selectedTime = Number.NEGATIVE_INFINITY
  for (const workspace of state.items) {
    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of workspace.sessionIds) {
      const updatedAt = sessions.byId[sessionId]?.updatedAt
      if (updatedAt !== undefined) latest = Math.max(latest, updatedAt)
    }
    if (latest === Number.NEGATIVE_INFINITY && workspace.createdAt !== undefined) {
      latest = Date.parse(workspace.createdAt)
    }
    if (selected === undefined || latest > selectedTime) {
      selected = workspace.workspaceId
      selectedTime = latest
    }
  }
  return selected
}
