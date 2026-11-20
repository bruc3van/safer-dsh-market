/**
 * The MCP shapes both halves agree on: the Host's own server-name and
 * credential-template grammar, and the heuristics that decide whether a
 * configured string looks like a secret someone pasted in the clear.
 *
 * Dependency-free on purpose: the Host scan masks static rows with these
 * before anything crosses the wire, and the browser runs the same rules over
 * the managed entries it already reads through Settings — one definition, so
 * the two never disagree about what "plaintext secret" means.
 * @module dsh-market-pro/mcpShapes
 */

/** `dsh-mcp-client`'s `serverName` (and the manager's `servers` key) grammar. */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** One credential reference name, as `${credential:REF}` accepts it. */
export const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** The Host package names whose Loader rows are MCP servers or their manager. */
export const MCP_CLIENT_PACKAGE = '@deepseek-ai/dsh-mcp-client'
export const MCP_MANAGER_PACKAGE = '@deepseek-ai/dsh-mcp-manager'

const TOKEN = /\$\{credential:([A-Za-z_][A-Za-z0-9_]*)\}/g
const SUSPECT = /\$\{[^}]*\}/g
const TOKEN_EXACT = /^\$\{credential:[A-Za-z_][A-Za-z0-9_]*\}$/

/** The `${credential:REF}` names one string carries, in order. */
export function credentialRefsIn(value: string): string[] {
  return [...value.matchAll(TOKEN)].map(match => match[1]!)
}

/** The first `${…}` occurrence that is not a well-formed credential token, if any. */
export function malformedTemplate(value: string): string | undefined {
  return [...value.matchAll(SUSPECT)].map(match => match[0]).find(occurrence => !TOKEN_EXACT.test(occurrence))
}

/** The template that stands in for one stored credential. */
export function credentialTemplate(ref: string): string {
  return '${credential:' + ref + '}'
}

const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH|BEARER|COOKIE|SESSION/i
const SECRET_FLAG = /^--?[\w-]*(?:key|token|secret|password|passwd|auth|credential)[\w-]*$/i
const KNOWN_SECRET = [
  /^sk-[A-Za-z0-9_-]{16,}/,
  /^(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/,
  /^xox[abprs]-[A-Za-z0-9-]{10,}/,
  /^ctx7sk-[A-Za-z0-9-]{8,}/,
  /^AKIA[0-9A-Z]{16}$/,
  /^AIza[0-9A-Za-z_-]{30,}$/,
  /^glpat-[A-Za-z0-9_-]{16,}/,
  /^(?:Bearer|Basic|token)\s+[^\s$]{12,}$/i,
  /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./,
]
const SECRET_QUERY = /[?&][^=&#]*(?:key|token|secret|password|auth)[^=&#]*=([^&#]+)/gi

/**
 * Whether a value, read on its own, looks like a credential: a well-known
 * token prefix, or a long opaque run of letters and digits that is neither a
 * path, a URL nor a package specifier.
 */
export function looksSecretValue(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '' || credentialRefsIn(trimmed).length > 0) return false
  if (KNOWN_SECRET.some(pattern => pattern.test(trimmed))) return true
  return /^[A-Za-z0-9_\-.+=]{32,}$/.test(trimmed) && /[0-9]/.test(trimmed) && /[A-Za-z]/.test(trimmed)
    && !/^[0-9a-f]{40}$/.test(trimmed)
}

/** Whether a named field (an env variable or a header) holds a secret in the clear. */
export function isSecretField(name: string, value: string): boolean {
  if (value.trim() === '' || credentialRefsIn(value).length > 0) return false
  return SECRET_NAME.test(name) ? !/^(?:true|false|0|1|on|off|yes|no)$/i.test(value.trim()) : looksSecretValue(value)
}

/** Whether a URL carries a secret in its query string. */
export function isSecretUrl(url: string): boolean {
  return [...url.matchAll(SECRET_QUERY)].some(match => credentialRefsIn(match[1]!).length === 0)
}

/**
 * Which argument positions carry a secret: one that looks like a credential
 * on its own, the value after a `--api-key`-style flag, or the right side of
 * a `--token=…` form.
 */
export function secretArgIndexes(args: readonly string[]): number[] {
  const indexes: number[] = []
  args.forEach((arg, index) => {
    const eq = arg.indexOf('=')
    const inline = arg.startsWith('-') && eq > 0 && SECRET_FLAG.test(arg.slice(0, eq)) && arg.slice(eq + 1) !== ''
      && credentialRefsIn(arg).length === 0
    const afterFlag = index > 0 && SECRET_FLAG.test(args[index - 1]!) && !arg.startsWith('-')
      && credentialRefsIn(arg).length === 0 && arg.trim() !== ''
    if (inline || afterFlag || looksSecretValue(arg)) indexes.push(index)
  })
  return indexes
}

/** What a masked value renders as. */
export const MASK = '••••••'

/** Mask one argument, keeping a `--flag=` prefix legible. */
export function maskArg(arg: string): string {
  const eq = arg.indexOf('=')
  return arg.startsWith('-') && eq > 0 ? `${arg.slice(0, eq + 1)}${MASK}` : MASK
}

/** Mask a URL's secret query values. */
export function maskUrl(url: string): string {
  return url.replace(/([?&][^=&#]*(?:key|token|secret|password|auth)[^=&#]*=)([^&#]+)/gi,
    (whole, prefix: string, value: string) => credentialRefsIn(value).length > 0 ? whole : `${prefix}${MASK}`)
}
