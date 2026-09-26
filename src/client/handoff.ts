/** Stage a review draft while the host owns the new main-view Session reference. */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InstallOutcome } from './MarketSection.tsx'
import type { MarketUiWorkspace, WorkspaceTarget } from './workspaceCompat.ts'

/** Host navigation cancels superseded opens and releases references if draft preparation fails. */
export async function stageReviewPrompt(
  sessions: Pick<ISessions, 'scope'>,
  navigation: Pick<MarketUiWorkspace, 'openWorkspace'>,
  conversation: Pick<IConversation, 'input'>,
  workspaceId: WorkspaceTarget,
  prompt: string,
): Promise<InstallOutcome> {
  let staged = false
  try {
    await navigation.openWorkspace(workspaceId, sessionId => {
      const scope = sessions.scope(sessionId)
      if (scope === undefined) throw new Error('the new session did not open')
      conversation.input.for(scope).setDraft(prompt)
      staged = true
    })
    return staged ? { ok: true } : { ok: false, reason: 'cancelled' }
  } catch (error) {
    return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}
