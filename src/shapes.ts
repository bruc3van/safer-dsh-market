/**
 * The shapes this market keeps: its own name, and every pattern a value is
 * checked against before it is allowed to travel.
 *
 * DELIBERATELY FREE OF DEPENDENCIES. These constants live apart from
 * `./contract.ts` — which they belong to by subject — for one mechanical
 * reason: the contract builds its zod codecs at module scope, so importing a
 * single constant from it evaluates the whole of zod. `./index.ts` is the
 * package entry whose entire job is to be the smallest, safest thing a
 * foreign runtime can import (see the note there), and it needs the package
 * name; `./catalog.ts` needs two patterns and nothing else. Reaching them
 * through the contract cost the entry bundle ~550 KB of eagerly evaluated
 * schema code, which is exactly what the entry split exists to avoid.
 *
 * Anything added here must stay importable by the entry: no dependencies, no
 * module-scope work beyond a literal.
 * @module safer-dsh-market/shapes
 */

/**
 * This package's name, and with it the cordis plugin name, the client bundle
 * id, and the bundle entry a profile lists. Both halves of the entry split
 * need it and neither may import the other: the body would drag the entry's
 * bundle in behind it, and the entry must stay free of anything the body
 * reaches.
 */
export const PACKAGE_NAME = 'safer-dsh-market'

/**
 * The only `owner/name` shape the market keeps. The repository link is
 * rebuilt on the Host from a slug matching this pattern, and the wire codec
 * enforces the same shape, so the "host rebuilds the href" invariant is held
 * by the contract rather than by a comment.
 */
export const REPOSITORY_SLUG_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

/**
 * The only branch-name shape the review prompt may interpolate. Branches are
 * remote text from a public snapshot: anything outside this pattern (no
 * whitespace, no punctuation beyond `._/-`) could inject instructions into
 * the prompt or steer the tarball path, so the Host falls back to `main` for
 * it. The trailing checks mirror the git ref rules GitHub enforces: no `..`
 * anywhere, no segment may be `.` or end in `.`/`.lock`, and the name must
 * not end in `/` or `.`.
 */
export const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/

/**
 * The only version shape the upgrade prompt may interpolate.
 *
 * An installed package's `version` is read from a manifest on this machine,
 * but it is still text this plugin did not write: the package that authored
 * it is exactly the one the upgrade prompt is about. Anything with a space in
 * it could carry a sentence into an instruction the user is one keystroke
 * from sending, so the prompt names the version only when it looks like one
 * (and says "the installed version" otherwise).
 */
export const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/

/**
 * The only npm package-name shape the installed-panel verbs accept. The
 * membership check against the profile's bundle list is the real gate; this
 * codec just keeps wire text in the shape of a name at all.
 */
export const PACKAGE_NAME_PATTERN = /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/

/**
 * The only profile name the market will run against.
 *
 * `resolveProfileDir` mirrors the launcher's own rules, which are about what
 * can be a directory — they admit names with spaces and dashes. But the
 * profile is also interpolated into the review prompt's `--profile` argument,
 * an instruction the user is one keystroke from sending, so it is held to the
 * same "cannot carry a second word" standard every other interpolated value
 * is. It is plugin config rather than remote text, so this is defence in
 * depth: the entry refuses to start rather than staging a malformed command.
 */
export const PROFILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/** Whether a version string is safe to interpolate into the prompt. */
export function isSafeVersion(value: string): boolean {
  return VERSION_PATTERN.test(value)
}

/** Whether a trimmed branch name is safe to interpolate into the prompt. */
export function isSafeBranchName(value: string): boolean {
  if (!BRANCH_PATTERN.test(value)) return false
  if (value.includes('..') || value.includes('//') || value.endsWith('/') || value.endsWith('.')) return false
  return !value.split('/').some(segment => segment === '.' || segment.endsWith('.lock'))
}

/**
 * The category key of the feed's editorial picks. The Host places it first in
 * the category list and the browser renders it from the catalog's `featured`
 * section rather than by filtering rows on their own `category`. The key is
 * fixed by the feed contract, not chosen here.
 */
export const FEATURED_CATEGORY = 'featured'
