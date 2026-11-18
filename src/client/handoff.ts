/** Stage a review draft while the host owns the new main-view Session reference. */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InstallOutcome } from './MarketSection.tsx'
import type { MarketUiWorkspace, WorkspaceTarget } from './workspaceCompat.ts'

/** Host navigation cancels superseded opens and releases references if draft preparation fails. */
export async function stageReviewPrompt(
  sessions: Pick<ISessions, 'scope' | 'binding'>,
  navigation: Pick<MarketUiWorkspace, 'openWorkspace'>,
  conversation: Pick<IConversation, 'input'>,
  workspaceId: WorkspaceTarget,
  prompt: string,
): Promise<InstallOutcome> {
  let staged = false
  const draftExists = new Error('the session already has a draft')
  try {
    await navigation.openWorkspace(workspaceId, sessionId => {
      const input = conversation.input
      if (typeof input.requestDraftInitialization === 'function') {
        const binding = sessions.binding(sessionId)
        if (binding === undefined) throw new Error('the new session did not open')
        const result = input.requestDraftInitialization(binding, { prompt, whenDraftExists: 'keep' })
        if (result === 'preserved') throw draftExists
        if (result === 'blocked') throw new Error('the session is still processing a submission')
      } else {
        const scope = sessions.scope(sessionId)
        if (scope === undefined) throw new Error('the new session did not open')
        const target = input.for(scope)
        const draft = target.state?.getSnapshot()
        if (draft === undefined || !Array.isArray(draft.attachmentIds)) throw new Error('the host could not verify the existing draft')
        if (draft.draft !== '' || draft.attachmentIds.length !== 0) throw draftExists
        if (draft.phase !== 'plain') throw new Error('the session is still processing a submission')
        target.setDraft(prompt)
      }
      staged = true
    })
    return staged ? { ok: true } : { ok: false, reason: 'cancelled' }
  } catch (error) {
    if (error === draftExists) return { ok: false, reason: 'draft-exists' }
    return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}
