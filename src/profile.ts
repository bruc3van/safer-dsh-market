/**
 * The profile layer the installed-plugin manager reads and edits.
 *
 * A dsh profile is a directory under `$DSH_HOME/profiles/<name>` (default home
 * `~/.dsh`) holding a `package.json` — whose `dsh.profile.bundles` lists the
 * plugin bundle layers in composition order — and a `cordis.patch.yml`, the
 * user's own patch layer applied AFTER every bundle layer and hot-reloaded by
 * the launcher. That makes the user patch file the durable seat for a runtime
 * disable: a `- id: <entryId>` / `disabled: true` row stops the entry now
 * (the launcher's watcher recomposes the tree on save) and keeps stopping it
 * on every later boot, all without touching files the installation owns.
 *
 * The file is the user's own, comments and `!!js` expressions included, so
 * edits go through a CST-preserving yaml Document: rows the manager did not
 * touch keep their original text byte for byte. The one exception is a
 * `!!js` scalar the serializer cannot keep in its original spelling — it
 * re-emits quoted, which parses back to the same expression node the Loader
 * expects (the tests assert the semantic round-trip).
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { isMap, isScalar, isSeq, parse, parseDocument, type ScalarTag } from 'yaml'
import { REPOSITORY_SLUG_PATTERN } from './shapes.ts'

/** Environment variable overriding the default harness home. */
export const DSH_HOME_ENV = 'DSH_HOME'

/** Directory under the harness home holding every profile. */
export const PROFILES_DIR = 'profiles'

/** The user patch layer inside a profile directory. */
export const PROFILE_PATCH_FILENAME = 'cordis.patch.yml'

/**
 * Bundle layers every shipped profile template carries. The manager never
 * lists these: they are the deployment itself.
 *
 * A name in `dsh.profile.bundles` is not enough to treat a plugin as
 * user-installed. Official `dsh plugin` never touches a name that is not a
 * profile dependency, and the desktop client seats its in-box market the
 * same way — a bundle entry plus a copied directory, no dependency.
 *
 * Such a seat IS listed when it carries the client's ownership marker (see
 * {@link desktopSeatBundles}), because otherwise nothing could ever remove
 * it: the official CLI will not touch it, and the client that seated it may
 * be uninstalled by now. The old worry — that an uninstall would be silently
 * undone by the next bundled boot — is answered on the card instead, which
 * says so plainly. A seat with no marker is the deployment's own and stays
 * out.
 */
export const SHIPPED_BUNDLES: ReadonlySet<string> = new Set([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-headless',
])

/** Expand a leading `~` against the OS home, mirroring the harness's helper. */
function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

/** Resolve the harness home: `$DSH_HOME`, then `~/.dsh`. */
export function resolveDshHome(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env[DSH_HOME_ENV]
  return resolve(fromEnv !== undefined && fromEnv.trim() !== '' ? expandHome(fromEnv) : join(homedir(), '.dsh'))
}

/**
 * Resolve a profile's directory. The name rules (and the `node_modules`
 * exclusion, the launcher's flat fallback path) mirror the harness's own
 * `resolveProfileDir`, so a profile the launcher accepts resolves identically
 * here.
 */
export function resolveProfileDir(name: string, home: string = resolveDshHome()): string {
  if (name === '' || name.includes('/') || name.includes('\\') || name === '.' || name === '..'
    || name === 'node_modules') {
    throw new Error(`invalid profile name ${JSON.stringify(name)}`)
  }
  return join(home, PROFILES_DIR, name)
}

/** The `!!js` scalar dialect: expression nodes the Loader evaluates lazily. */
interface JsExprNode {
  __jsExpr: string
}

function isJsExprNode(value: unknown): value is JsExprNode {
  return typeof value === 'object' && value !== null && '__jsExpr' in value
}

/**
 * The custom tag keeping `!!js process.platform === 'win32'` parseable and
 * re-emittable: resolved to the expression node the Loader's own dialect
 * uses, and stringified double-quoted — valid for any expression text, at
 * the cost of quotes the author may not have written.
 */
const jsExprTag: ScalarTag = {
  tag: 'tag:yaml.org,2002:js',
  identify: isJsExprNode,
  resolve: (text: string): JsExprNode => ({ __jsExpr: text }),
  stringify: (item: { value: unknown }): string =>
    `"${String(isJsExprNode(item.value) ? item.value.__jsExpr : item.value).replace(/(["\\])/g, '\\$1')}"`,
}

/** One entry row inside a patch's `insert` list. */
export interface PatchInsertRow {
  id?: string
  name?: string
  group?: boolean | null
  config?: unknown
  [key: string]: unknown
}

/** One row of a patch list: an `insert` list, or an id-targeted override. */
export interface PatchRow {
  id?: string
  insert?: PatchInsertRow[]
  [key: string]: unknown
}

/** The profile manifest's slices the manager reads and edits. */
export type ProfileManifest = Record<string, unknown> & {
  dependencies?: Record<string, string>
  dsh?: {
    bundle?: { patch?: string }
    profile?: { bundles?: string[] }
  }
}

/** Serial number distinguishing two in-flight writes from the same process. */
let atomicWriteSeq = 0

/**
 * Write a file atomically (tmp + rename), the include's own discipline.
 *
 * The scratch path carries the writer's pid and a serial, not a bare `.tmp`.
 * The manager serializes its own verbs, but a profile is shared — the web
 * GUI, a CLI and the desktop client can all be editing the same manifest —
 * and two writers sharing one scratch name interleave into a file that is
 * neither version. Distinct scratch names make the rename the only race, and
 * a rename is the atomic step this function exists for.
 */
export async function atomicWrite(file: string, content: string): Promise<void> {
  const scratch = `${file}.${String(process.pid)}.${String(atomicWriteSeq += 1)}.tmp`
  try {
    await writeFile(scratch, content, 'utf8')
    await rename(scratch, file)
  } catch (error) {
    // A failed rename would otherwise leave the scratch file behind for good.
    await rm(scratch, { force: true }).catch(() => {})
    throw error
  }
}

/** Read and parse the profile manifest. */
export async function readManifest(profileDir: string): Promise<ProfileManifest> {
  const file = join(profileDir, 'package.json')
  const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`profile manifest ${file} must hold a JSON object`)
  }
  return parsed as ProfileManifest
}

/** Write the manifest back (2-space JSON, trailing newline, atomic). */
export async function writeManifest(profileDir: string, manifest: ProfileManifest): Promise<void> {
  await atomicWrite(join(profileDir, 'package.json'), JSON.stringify(manifest, undefined, 2) + '\n')
}

/**
 * The marker the desktop client writes into a seat it copied in, naming
 * itself the owner. It is what makes an in-box seat removable from here: a
 * bundle with no dependency is normally untouchable (the deployment itself),
 * but a directory that says who put it there is a different thing — someone
 * seated it automatically, and the person living in this profile should be
 * able to un-seat it.
 */
export const DESKTOP_SEAT_MARKER = '.dsh-desktop-seat.json'

/** Owner tag inside {@link DESKTOP_SEAT_MARKER}. */
const DESKTOP_SEAT_OWNER = 'dsh-desktop'

/**
 * Whether this bundle is a desktop-client seat: listed, not a dependency, and
 * carrying the client's ownership marker in the directory the profile
 * resolves it from.
 */
export function isDesktopSeat(profileDir: string, packageName: string): boolean {
  const dir = packageDirFromProfile(profileDir, packageName)
  if (dir === undefined) return false
  try {
    const parsed = JSON.parse(readFileSync(join(dir, DESKTOP_SEAT_MARKER), 'utf8')) as { owner?: unknown }
    return parsed !== null && typeof parsed === 'object' && parsed.owner === DESKTOP_SEAT_OWNER
  } catch {
    return false
  }
}

/** The directory an in-box desktop seat occupies, for removal. */
export function desktopSeatDir(profileDir: string, packageName: string): string | undefined {
  return isDesktopSeat(profileDir, packageName) ? packageDirFromProfile(profileDir, packageName) : undefined
}

/** Keep a shared seat while another profile still resolves it. Fail closed on unreadable profiles. */
export async function seatHasOtherReferences(profileDir: string, packageName: string, seatDir: string): Promise<boolean> {
  const target = await realpath(seatDir)
  const profilesDir = resolve(profileDir, '..')
  // Only delete copies inside this profile or the harness's shared package directory.
  const allowed = [join(await realpath(profileDir), 'node_modules', packageName), join(await realpath(profilesDir), 'node_modules', packageName)]
  if (!allowed.includes(target)) return true
  for (const entry of await readdir(profilesDir, { withFileTypes: true })) {
    if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name === 'node_modules') continue
    const other = join(profilesDir, entry.name)
    if (other === profileDir) continue
    let manifest: ProfileManifest
    try { manifest = await readManifest(other) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    if (!manifest.dsh?.profile?.bundles?.includes(packageName)
      && !Object.hasOwn(manifest.dependencies ?? {}, packageName)) continue
    const candidate = packageDirFromProfile(other, packageName)
    if (candidate !== undefined && await realpath(candidate) === target) return true
  }
  return false
}

/**
 * Bundle names listed in the profile that are NOT dependencies and NOT
 * shipped template layers — the in-box seats. Only those carrying the desktop
 * client's marker are returned: an unmarked one is the deployment's own and
 * stays out of the panel, as before.
 */
export function desktopSeatBundles(manifest: ProfileManifest, profileDir: string): string[] {
  const bundles = manifest.dsh?.profile?.bundles
  if (!Array.isArray(bundles)) return []
  const dependencies = manifest.dependencies ?? {}
  return bundles.filter(name =>
    typeof name === 'string'
    && !SHIPPED_BUNDLES.has(name)
    && !Object.hasOwn(dependencies, name)
    && isDesktopSeat(profileDir, name))
}

/**
 * The bundles a user installed (`dsh plugin add`): names that sit in
 * `dsh.profile.bundles` and in `dependencies`. Shipped template layers and
 * in-box seats (a bundle name with no dependency) are not in this set.
 */
export function userBundles(manifest: ProfileManifest): string[] {
  const bundles = manifest.dsh?.profile?.bundles
  if (!Array.isArray(bundles)) return []
  const dependencies = manifest.dependencies ?? {}
  return bundles.filter(name =>
    typeof name === 'string' && !SHIPPED_BUNDLES.has(name) && Object.hasOwn(dependencies, name))
}

/**
 * Whether a resolvable dependency declares a `dsh.bundle` patch — i.e. is a
 * plugin, not a plain library sitting in `dependencies`.
 */
export function declaresBundle(profileDir: string, packageName: string): boolean {
  const dir = packageDirFromProfile(profileDir, packageName)
  if (dir === undefined) return false
  try {
    const parsed = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as ProfileManifest
    const declared = parsed.dsh?.bundle?.patch
    return typeof declared === 'string' && declared !== ''
  } catch {
    return false
  }
}

/**
 * Plugin packages that sit in `dependencies` but not in `dsh.profile.bundles`.
 * They are installed but not composed — the whale-girl shape: pnpm wrote the
 * dep, reconcile never registered the layer. Listed so the panel can uninstall
 * them; plain libraries (zod and friends) stay out.
 */
export function unregisteredPlugins(manifest: ProfileManifest, profileDir: string): string[] {
  const bundles = manifest.dsh?.profile?.bundles
  const inStack = new Set(Array.isArray(bundles) ? bundles.filter(name => typeof name === 'string') : [])
  const dependencies = manifest.dependencies ?? {}
  return Object.keys(dependencies).filter(name =>
    !SHIPPED_BUNDLES.has(name)
    && !inStack.has(name)
    && declaresBundle(profileDir, name))
}

/** The profile's pnpm workspace file: `allowBuilds` and `minimumReleaseAgeExclude`. */
export const PROFILE_WORKSPACE_FILENAME = 'pnpm-workspace.yaml'

/**
 * Drop one package's leftover install-gate entries from the profile's
 * `pnpm-workspace.yaml`: its `allowBuilds` key, and any
 * `minimumReleaseAgeExclude` row that names it. Other keys and comments stay.
 * A missing file is a no-op.
 * @returns true when the file changed.
 */
export async function removePackageInstallGate(profileDir: string, packageName: string): Promise<boolean> {
  const file = join(profileDir, PROFILE_WORKSPACE_FILENAME)
  let content = ''
  try {
    content = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
  const doc = parseDocument(content, { customTags: [jsExprTag] })
  if (doc.errors.length > 0) {
    throw new Error(`cannot edit workspace file ${file}: ${doc.errors[0]!.message}`)
  }
  if (doc.contents === null || !isMap(doc.contents)) return false
  let changed = false
  const allowBuilds = doc.contents.get('allowBuilds')
  if (isMap(allowBuilds) && allowBuilds.has(packageName)) {
    allowBuilds.delete(packageName)
    changed = true
  }
  const exclude = doc.contents.get('minimumReleaseAgeExclude')
  if (isSeq(exclude)) {
    const prefix = packageName + '@'
    for (let index = exclude.items.length - 1; index >= 0; index -= 1) {
      const item = exclude.items[index]
      if (!isScalar(item)) continue
      const value = String(item.value ?? '')
      if (value === packageName || value.startsWith(prefix)) {
        exclude.items.splice(index, 1)
        changed = true
      }
    }
  }
  if (!changed) return false
  let output = doc.toString()
  if (!output.endsWith('\n')) output += '\n'
  await atomicWrite(file, output)
  return true
}

/**
 * Remove one bundle from the manifest: its dependency entry and its
 * `dsh.profile.bundles` seat, the exact two facts the next boot's composition
 * and the CLI's reconcile read. For a user plugin the manager also runs
 * `pnpm remove` so the lockfile and `node_modules` go with them; this helper
 * is the manifest half, and the fallback when pnpm cannot run.
 * @returns true when the manifest changed.
 */
export function removeBundle(manifest: ProfileManifest, packageName: string): boolean {
  let changed = false
  if (manifest.dependencies !== undefined && Object.hasOwn(manifest.dependencies, packageName)) {
    delete manifest.dependencies[packageName]
    changed = true
  }
  const bundles = manifest.dsh?.profile?.bundles
  if (Array.isArray(bundles) && bundles.includes(packageName)) {
    bundles.splice(bundles.indexOf(packageName), 1)
    changed = true
  }
  return changed
}

/** Parse a patch-list file (a missing file is an empty list, per the launcher's own rule). */
export async function readPatchList(file: string): Promise<PatchRow[]> {
  let content: string
  try {
    content = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const data = parse(content, { customTags: [jsExprTag] }) as unknown
  if (data === null || data === undefined) return []
  if (!Array.isArray(data)) {
    throw new TypeError(`patch file ${file} must hold a top-level array`)
  }
  return data as PatchRow[]
}

/**
 * The loader entry rows a patch list introduces, in patch-addressable form:
 * top-level inserts, group children (a group row itself is always enabled and
 * never listed, but its children are real entries), and rows inserted into a
 * group another layer declared. These ids are what `{ id, disabled: true }`
 * override rows target.
 */
export function collectEntryRows(patches: readonly PatchRow[]): { id: string; name: string }[] {
  const rows: { id: string; name: string }[] = []
  const walk = (inserts: readonly PatchInsertRow[]): void => {
    for (const row of inserts) {
      if (typeof row.id !== 'string' || row.id === '') continue
      if (row.group === true) {
        if (Array.isArray(row.config)) walk(row.config as PatchInsertRow[])
        continue
      }
      rows.push({ id: row.id, name: typeof row.name === 'string' ? row.name : '' })
    }
  }
  for (const patch of patches) {
    if (Array.isArray(patch.insert)) walk(patch.insert)
  }
  return rows
}

/**
 * Resolve a package's root directory from the profile anchor: Node's own
 * node_modules lookup order (the profile's `node_modules` first, then the
 * launcher's healed `profiles/node_modules` fallback on the parent walk), so
 * the result matches what the Loader imports.
 */
export function packageDirFromProfile(profileDir: string, packageName: string): string | undefined {
  for (const searchPath of createRequire(join(profileDir, 'package.json')).resolve.paths(packageName) ?? []) {
    const candidate = join(searchPath, packageName)
    if (existsSync(join(candidate, 'package.json'))) return candidate
  }
  return undefined
}

/** One installed bundle's display facts plus the entry ids it introduces. */
export interface BundleInfo {
  version: string
  description: string
  /** `owner/name` when the manifest points at a GitHub repository; '' otherwise. */
  repository: string
  entries: { id: string; name: string }[]
}

/**
 * The GitHub `owner/name` a package manifest's `repository` field names.
 *
 * npm allows the field in several spellings — the object form, the shorthand
 * string (`owner/name`, `github:owner/name`), and a git URL in any of the
 * scheme flavours — and every one of them may also point somewhere that is
 * not GitHub at all. This reduces the ones that do to a bare slug and answers
 * '' for everything else, including a `directory` sub-path (a monorepo entry
 * whose repository is shared with other packages, so the slug would join the
 * wrong catalog row).
 * @param manifest - the parsed package manifest.
 * @returns the `owner/name` slug, or '' when the field names no GitHub repository.
 */
export function repositorySlugOf(manifest: unknown): string {
  const field = (manifest as { repository?: unknown } | null)?.repository
  let url: string
  if (typeof field === 'string') {
    url = field
  } else if (field !== null && typeof field === 'object') {
    const record = field as { url?: unknown; directory?: unknown }
    // A `directory` means several packages share one repository; the slug
    // cannot identify this one.
    if (typeof record.directory === 'string' && record.directory !== '') return ''
    if (typeof record.url !== 'string') return ''
    url = record.url
  } else {
    return ''
  }
  const trimmed = url.trim()
  // The shorthand forms: a bare `owner/name`, optionally with the `github:`
  // host prefix npm treats as the default.
  const shorthand = trimmed.startsWith('github:') ? trimmed.slice('github:'.length) : trimmed
  if (REPOSITORY_SLUG_PATTERN.test(shorthand)) return shorthand
  // The URL forms: git+https://, https://, git://, ssh://git@ and the scp-like
  // git@github.com:owner/name — all reduced by their host and path.
  const match = /^(?:git\+)?(?:https?|git|ssh):\/\/(?:[^@/]*@)?github\.com\/(.+)$/.exec(trimmed)
    ?? /^(?:git\+ssh:\/\/)?git@github\.com:(.+)$/.exec(trimmed)
  if (match === null) return ''
  // Trailing slashes come off FIRST: `owner/name.git/` is a real spelling,
  // and stripping the suffix before the slash leaves `.git` attached — which
  // the slug pattern accepts (it allows dots), so the wrong slug would travel
  // on and silently join nothing.
  const path = match[1]!.replace(/\/+$/, '').replace(/\.git$/, '')
  return REPOSITORY_SLUG_PATTERN.test(path) ? path : ''
}

/** Read one installed bundle: its manifest display facts and its patch's entry rows. */
export async function readBundleInfo(profileDir: string, packageName: string): Promise<BundleInfo> {
  const dir = packageDirFromProfile(profileDir, packageName)
  if (dir === undefined) {
    throw new Error(`package ${packageName} is not resolvable from the profile`)
  }
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as ProfileManifest
  const declared = manifest.dsh?.bundle?.patch
  if (typeof declared !== 'string' || declared === '') {
    throw new Error(`package ${packageName} declares no dsh.bundle patch`)
  }
  const entries = collectEntryRows(await readPatchList(join(dir, declared)))
  return {
    version: typeof (manifest as { version?: unknown }).version === 'string' ? (manifest as { version: string }).version : '',
    description: typeof manifest.description === 'string' ? manifest.description : '',
    repository: repositorySlugOf(manifest),
    entries,
  }
}

/** Whether one patch-list item is exactly the two-key disable row this manager writes. */
function isExactDisableRow(item: unknown, id: string): boolean {
  if (!isMap(item)) return false
  if (item.items.length !== 2) return false
  let sawId = false
  let sawDisabled = false
  for (const pair of item.items) {
    if (!isScalar(pair.key)) return false
    if (pair.key.value === 'id' && isScalar(pair.value) && pair.value.value === id) sawId = true
    else if (pair.key.value === 'disabled' && isScalar(pair.value) && pair.value.value === true) sawDisabled = true
    else return false
  }
  return sawId && sawDisabled
}

/**
 * Set or clear this manager's disable rows for the given entry ids in the
 * profile's user patch layer — the edit every enable/disable/uninstall funnel
 * through. Disable appends `- id: <id>` / `disabled: true` rows (skipping ids
 * already carrying one); enable removes exactly the rows this manager writes,
 * never a hand-written override (more keys, a `!!js` expression, a config
 * override), which keeps its own shape. The document round-trips through the
 * yaml CST, so comments and untouched rows keep their original text; the
 * launcher recomposes the tree on the save, which is what makes the edit live.
 * @returns the ids whose exact disable rows were added or removed.
 */
export async function setEntryDisabled(file: string, ids: readonly string[], disabled: boolean): Promise<string[]> {
  if (ids.length === 0) return []
  let content = ''
  try {
    content = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const doc = parseDocument(content, { customTags: [jsExprTag] })
  if (doc.errors.length > 0) {
    throw new Error(`cannot edit patch file ${file}: ${doc.errors[0]!.message}`)
  }
  if (doc.contents === null) {
    // No file (or an empty one): there is nothing to remove, and rows to add
    // are the whole content — written directly, JSON-quoted ids and all.
    if (!disabled) return []
    const rows = ids.map(id => `- id: ${JSON.stringify(id)}\n  disabled: true\n`).join('')
    await atomicWrite(file, rows)
    return [...ids]
  }
  const seq = doc.contents
  if (!isSeq(seq)) {
    throw new TypeError(`patch file ${file} must hold a top-level array`)
  }
  const changed = new Set<string>()
  if (disabled) {
    // A template file's `[]` is a flow sequence; rows append in block style —
    // the file is the user's own and block rows read as the harness writes
    // them elsewhere.
    seq.flow = false
    for (const id of ids) {
      if (seq.items.some(item => isExactDisableRow(item, id))) continue
      const node = doc.createNode({ id, disabled: true })
      node.flow = false
      // The created node lacks a source range until serialized, which is all
      // it is used for — the seq types it as parsed, hence the cast.
      seq.add(node as Parameters<typeof seq.add>[0])
      changed.add(id)
    }
  } else {
    for (let index = seq.items.length - 1; index >= 0; index -= 1) {
      const item = seq.items[index]!
      const id = ids.find(id => isExactDisableRow(item, id))
      if (id !== undefined) {
        seq.items.splice(index, 1)
        changed.add(id)
      }
    }
  }
  if (changed.size === 0) return []
  let output = doc.toString()
  if (!output.endsWith('\n')) output += '\n'
  await atomicWrite(file, output)
  return [...changed]
}
