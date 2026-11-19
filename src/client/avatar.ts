// GitHub login: 1-39 alphanumerics or single hyphens, no leading/trailing hyphen.
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/

/**
 * Presentation-only fallback artwork for a plugin that declares no icon: the
 * owner's GitHub avatar, derived from the repository slug (`owner/name`).
 * npm-only plugins without a repository slug get no avatar.
 */
export function ownerAvatarUrl(fullName: string | undefined): string | undefined {
  const owner = /^([^/]+)\/[^/]+$/.exec(fullName ?? '')?.[1]
  return owner && GITHUB_LOGIN.test(owner) ? `https://avatars.githubusercontent.com/${owner}?s=96` : undefined
}
