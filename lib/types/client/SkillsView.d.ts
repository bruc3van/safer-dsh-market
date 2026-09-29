/**
 * The Skills page of the marketplace section: what the current session can
 * actually resolve right now.
 *
 * Read-only, and it needs neither the market switch nor the network. It is
 * addressed by the open session because skill discovery is layered by the
 * agent preset that session runs — a deployment-wide read would report "none"
 * to a user with plenty. Incomplete discovery is shown rather than smoothed
 * over: a short list that looks whole is a wrong answer, not a tidy one.
 */
import { type ReactElement } from 'react';
import type { MarketSkillsResult } from '../contract.ts';
import { type SkillsSessionSource } from './skillsSubscription.ts';
import type { MarketLocale } from './copy.ts';
/** The reader's sentinel for "nothing to address" (see client/index.ts). */
export declare const NO_SESSION = "no-session";
/** The reader's sentinel for "the session list has not landed yet". */
export declare const SESSIONS_PENDING = "sessions-pending";
/** The Skills page. */
export declare function SkillsView({ t, listSkills, skillsSession, canOpenFolder, openFolder }: {
    t: MarketLocale;
    listSkills: () => Promise<MarketSkillsResult>;
    skillsSession: SkillsSessionSource;
    canOpenFolder: () => Promise<boolean>;
    openFolder: (path: string) => Promise<void>;
}): ReactElement;
