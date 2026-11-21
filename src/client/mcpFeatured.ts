/**
 * Browser-side helpers over the shared curated MCP catalog: matching against
 * live `McpRow`s, validating modal inputs, and building {@link McpDraft}s with
 * credential-store templates.
 *
 * Kept free of React and JSX so `node --test` can exercise every rule directly.
 * @module dsh-market-pro/client/mcpFeatured
 */
import type { McpUnmanagedServer } from '../contract.ts'
import {
  FEATURED_MCP_CATEGORIES,
  FEATURED_MCP_SERVERS,
  featuredRuntimeBadge,
  featuredTargetPreview,
  findFeaturedMcpById,
  hasRequiredInputs,
  hasSecretInputs,
  matchesFeaturedMcp,
  mcpIdentityKey,
  pickAvailableServerName,
  type FeaturedMcpCategory,
  type FeaturedMcpInput,
  type FeaturedMcpServer,
} from '../mcpFeatured.ts'
import { SERVER_NAME_PATTERN, isExactCredentialTemplate, malformedTemplate } from '../mcpShapes.ts'
import {
  credentialTemplate, emptyDraft, suggestRef,
  type McpDraft, type McpPair, type McpPendingSecret, type McpRow,
} from './mcpModel.ts'

export {
  FEATURED_MCP_CATEGORIES,
  FEATURED_MCP_SERVERS,
  featuredRuntimeBadge,
  featuredTargetPreview,
  findFeaturedMcpById,
  hasRequiredInputs,
  hasSecretInputs,
  matchesFeaturedMcp,
  mcpIdentityKey,
  pickAvailableServerName,
  type FeaturedMcpCategory,
  type FeaturedMcpInput,
  type FeaturedMcpServer,
}

/** Where an existing configured server matches a curated catalog item. */
export interface FeaturedMcpMatch {
  readonly name: string
  readonly source: 'managed' | 'static'
}

/** Field-level validation error for the curated install modal. */
export type FeaturedMcpError =
  | { readonly field: 'name'; readonly code: 'required' | 'pattern' | 'taken' }
  | { readonly field: 'input'; readonly key: string; readonly code: 'required' | 'malformed' }

/** Find whether a curated server is already configured as a managed or static row. */
export function findInstalledFeatured(
  item: FeaturedMcpServer,
  rows: readonly McpRow[],
  unmanaged: readonly McpUnmanagedServer[],
): FeaturedMcpMatch | null {
  const key = mcpIdentityKey(item)
  if (key !== '') {
    for (const row of rows) {
      if (row.entry !== undefined && mcpIdentityKey(row.entry) === key) {
        return { name: row.name, source: 'managed' }
      }
    }
    for (const server of unmanaged) {
      if (mcpIdentityKey(server) === key) {
        return { name: server.serverName || server.entryId, source: 'static' }
      }
    }
  }
  // Plugin-registered rows carry no Settings entry, so fall back to exact name match for them.
  const registered = rows.find(row => row.source === 'registered' && row.name === item.id)
  if (registered !== undefined) return { name: registered.name, source: 'managed' }
  return null
}

/** Validate the server name, required inputs, and credential template syntax before building a draft. */
export function validateFeaturedValues(
  item: FeaturedMcpServer,
  rawName: string,
  values: Readonly<Record<string, string>>,
  takenNames: ReadonlySet<string>,
): FeaturedMcpError[] {
  const errors: FeaturedMcpError[] = []
  const name = rawName.trim()
  if (name === '') errors.push({ field: 'name', code: 'required' })
  else if (!SERVER_NAME_PATTERN.test(name)) errors.push({ field: 'name', code: 'pattern' })
  else if (takenNames.has(name)) errors.push({ field: 'name', code: 'taken' })
  for (const input of item.inputs) {
    const raw = (values[input.key] ?? '').trim()
    if (raw === '') {
      if (input.required) errors.push({ field: 'input', key: input.key, code: 'required' })
      continue
    }
    if (malformedTemplate(raw) !== undefined) {
      errors.push({ field: 'input', key: input.key, code: 'malformed' })
    }
  }
  return errors
}

function upsertPair(list: McpPair[], key: string, value: string): McpPair[] {
  const index = list.findIndex(pair => pair.key === key)
  if (index >= 0) return list.map((pair, at) => at === index ? { key, value } : pair)
  return [...list, { key, value }]
}

/** Strip a duplicated static prefix when the field format already prepends it (e.g. `Bearer {}`). */
function stripRepeatedFormatPrefix(raw: string, format: string | undefined): string {
  if (!format || !format.endsWith('{}')) return raw
  const prefix = format.slice(0, -2)
  if (prefix === '') return raw
  return raw.toLowerCase().startsWith(prefix.toLowerCase()) ? raw.slice(prefix.length).trim() : raw
}

/**
 * Build a ready-to-save {@link McpDraft} from a curated server and user inputs.
 *
 * Secret inputs are moved into `draft.pending` with generated `${credential:REF}`
 * templates so `controller.save` writes them to the credential store before
 * mutating Settings.
 */
export function draftFromFeatured(
  item: FeaturedMcpServer,
  values: Readonly<Record<string, string>>,
  options: {
    readonly name: string
    readonly enabled: boolean
    readonly takenRefs?: ReadonlySet<string>
  },
): McpDraft {
  const name = options.name.trim() || item.id
  const base = emptyDraft()
  const args = [...(item.args ?? [])]
  let env: McpPair[] = Object.entries(item.env ?? {}).map(([key, value]) => ({ key, value }))
  let headers: McpPair[] = Object.entries(item.headers ?? {}).map(([key, value]) => ({ key, value }))
  const pending: McpPendingSecret[] = []
  const refsTaken = new Set(options.takenRefs ?? [])

  for (const input of item.inputs) {
    const trimmed = (values[input.key] ?? '').trim()
    if (trimmed === '') continue
    const raw = input.where === 'header' ? stripRepeatedFormatPrefix(trimmed, input.format) : trimmed
    if (raw === '') continue
    let resolved = raw
    if (input.secret && !isExactCredentialTemplate(raw)) {
      const ref = suggestRef(name, input.key, refsTaken)
      refsTaken.add(ref)
      pending.push({ ref, value: raw })
      resolved = credentialTemplate(ref)
    }
    if (input.where === 'env') {
      env = upsertPair(env, input.key, resolved)
    } else if (input.where === 'header') {
      const template = input.format && input.format.includes('{}') ? input.format : '{}'
      headers = upsertPair(headers, input.key, template.replace('{}', resolved))
    } else if (input.flag) {
      args.push(input.flag, resolved)
    } else {
      args.push(resolved)
    }
  }

  return {
    ...base,
    name,
    transport: item.transport,
    command: item.transport === 'stdio' ? (item.command ?? '') : '',
    args: item.transport === 'stdio' ? args : [],
    env: item.transport === 'stdio' ? env : [],
    url: item.transport === 'streamable-http' ? (item.url ?? '') : '',
    headers: item.transport === 'streamable-http' ? headers : [],
    enabled: options.enabled,
    pending,
  }
}
