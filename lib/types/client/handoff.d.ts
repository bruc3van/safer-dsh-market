/** Stage a review draft while the host owns the new main-view Session reference. */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { InstallOutcome } from './MarketSection.tsx';
import type { MarketUiWorkspace, WorkspaceTarget } from './workspaceCompat.ts';
/** Host navigation cancels superseded opens and releases references if draft preparation fails. */
export declare function stageReviewPrompt(sessions: Pick<ISessions, 'scope'>, navigation: Pick<MarketUiWorkspace, 'openWorkspace'>, conversation: Pick<IConversation, 'input'>, workspaceId: WorkspaceTarget, prompt: string): Promise<InstallOutcome>;
