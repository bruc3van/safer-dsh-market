import { type ReactElement } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { MarketSkillsResult } from '../contract.ts';
import { type SkillsSessionSource } from './skillsSubscription.ts';
import type { MarketLocale } from './copy.ts';
export declare const NO_SESSION = "no-session";
export declare const SESSIONS_PENDING = "sessions-pending";
interface SkillsActions {
    listSkills: () => Promise<MarketSkillsResult>;
    skillsSession: SkillsSessionSource;
    canOpenFolder: () => Promise<boolean>;
    openFolder: (path: string) => Promise<void>;
}
export declare function ProjectSkillsView(props: SkillsActions & PropsLocale<'settings.dshMarketPro'>): ReactElement;
export declare function SkillsView({ t, listSkills, skillsSession, canOpenFolder, openFolder, project }: SkillsActions & {
    t: MarketLocale;
    project?: boolean;
}): ReactElement;
export {};
