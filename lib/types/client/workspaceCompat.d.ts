import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client';
/** Workspace identities are opaque to this adapter and only passed back to DSH services. */
export type WorkspaceTarget = Parameters<UiWorkspace['openWorkspace']>[0];
/** Workspace facts exposed by the DSH Workspace Controller. */
export interface WorkspaceState {
    readonly phase: 'pending' | 'ready';
    readonly items: readonly {
        readonly workspaceId: WorkspaceTarget;
        readonly sessionIds: readonly string[];
        readonly createdAt?: string;
    }[];
}
/** Session-list facts needed to select the current or most recent Workspace. */
export interface SessionListState {
    readonly phase: 'pending' | 'ready';
    readonly byId: Readonly<Record<string, Pick<SessionSummary, 'id' | 'updatedAt' | 'retainedBy'>>>;
}
/** Workspace Controller face consumed by the market. */
export type MarketWorkspaces = Pick<IWorkspaces, 'list' | 'create'>;
/** Cross-Controller navigation supplied by the DSH Web profile. */
export type MarketUiWorkspace = Pick<UiWorkspace, 'openWorkspace' | 'pickDirectory'>;
/** The main conversation owns a mainView reference; other references do not select it. */
export declare function currentSessionOf(sessions: SessionListState): SessionSummary['id'] | undefined;
/** Whether the active DSH generation has received both Workspace and Session baselines. */
export declare function workspaceReady(state: WorkspaceState, sessions: SessionListState): boolean;
/**
 * Select the same Workspace target used by DSH New Session: current first,
 * then recency derived from the split Controllers.
 */
export declare function workspaceTargetOf(state: WorkspaceState, sessions: SessionListState): WorkspaceTarget | undefined;
