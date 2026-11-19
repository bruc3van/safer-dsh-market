import type { Context } from '@deepseek-ai/cordis';
import type { MarketSkillsResult } from './contract.ts';
/** Show conventional skill roots; abbreviate verified workspace/home ancestors. */
export declare function skillDirectory(directory: string, cwd?: string, home?: string): string;
/** A live Agent, structurally: its Session header and its own context. */
export interface SkillReadAgent {
    readonly session: {
        readonly header: {
            readonly cwd?: string;
        };
    };
}
/**
 * Read the merged skill list one Session's scope chain selects.
 * @param ctx - the plugin context carrying the skill registry and optional Host services.
 * @param sessionId - the Session from the `sessionId` wire field.
 * @param signal - caller lifetime; discovery races it.
 * @returns the reduced list, whether it is complete, and any failure reason.
 */
export declare function readSkills(ctx: Context, sessionId: string, signal: AbortSignal): Promise<MarketSkillsResult>;
