/**
 * Presentation-only fallback artwork for a plugin that declares no icon: the
 * owner's GitHub avatar, derived from the repository slug (`owner/name`).
 * npm-only plugins without a repository slug get no avatar.
 */
export declare function ownerAvatarUrl(fullName: string | undefined): string | undefined;
