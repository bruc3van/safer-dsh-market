/**
 * The installed-plugin manager: the host half of the market's "已安装" panel.
 *
 * It answers three verbs over the plugins a user installed into this profile,
 * plus the in-box seats the desktop client marked as its own. Shipped
 * template layers, and unmarked in-box bundles, are the deployment itself and
 * are never listed. A marked seat IS listed, because otherwise nothing could
 * remove it: the official CLI will not touch a name that is not a profile
 * dependency, and the client that seated it may be uninstalled by now.
 *
 * - **list** reads the profile manifest's user bundles (and any plugin still
 *   in `dependencies` but missing from `dsh.profile.bundles`, so a failed
 *   reconcile cannot hide from uninstall), joins each bundle's patch-declared
 *   entry ids against the live Loader tree, and reports the package-level
 *   enable state the panel toggles.
 * - **setEnabled** writes (or removes) `disabled: true` rows in the profile's
 *   own patch layer — the durable seat the launcher recomposes from on every
 *   boot — and then nudges the live entries directly, so the change takes
 *   effect now even on a launcher without the patch-file watcher. The two
 *   paths are idempotent against each other: whichever lands second finds no
 *   diff left to apply.
 * - **uninstall** stops the entries for the rest of this session (same
 *   disable-row mechanism, so a mid-session patch-file recompose cannot
 *   revive them) and records the rows it wrote so the next boot's
 *   {@link InstalledManager.sweep} can take them back out of the user's
 *   patch file. For a user plugin it then runs `pnpm remove` in the profile
 *   directory — the same primitive official `dsh plugin remove` forwards to
 *   — so the lockfile and `node_modules` go with the manifest edit; an
 *   in-box seat has no pnpm tree and is removed by deleting its copy. A
 *   failed pnpm run still drops the name from the manifest (next boot will
 *   not compose it) and the result `notice` carries the leftover fault
 *   details so the panel can wrap them in localized copy.
 *
 * Listing, enable, disable, and in-box uninstall stay local file edits plus
 * an in-process Loader call. User-plugin uninstall is the one verb that
 * spawns: `pnpm remove` against the profile directory, never the network
 * as an install.
 */
import type { Entry, Loader } from '@deepseek-ai/cordis-plugin-loader'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { PACKAGE_NAME_PATTERN } from './shapes.ts'
import {
  type MarketInstalledEntry,
  type MarketInstalledPackage,
  type MarketInstalledResult,
} from './contract.ts'
import {
  PROFILE_PATCH_FILENAME,
  atomicWrite,
  desktopSeatBundles,
  desktopSeatDir,
  readBundleInfo,
  readManifest,
  removeBundle,
  removePackageInstallGate,
  resolveDshHome,
  resolveProfileDir,
  setEntryDisabled,
  seatHasOtherReferences,
  unregisteredPlugins,
  userBundles,
  writeManifest,
  type ProfileManifest,
} from './profile.ts'

/** Fiber state names, indexed by the cordis `FiberState` enum's numeric values. */
const FIBER_PHASE = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading'] as const

/** One uninstall the manager still has disable rows out for. */
export interface PendingUninstall {
  readonly packageName: string
  readonly entryIds: readonly string[]
  readonly at: string
  /** False until removal from the manifest has been verified; absent in legacy records. */
  readonly completed?: boolean
}

/** The manager's construction facts. */
export interface InstalledManagerOptions {
  /** The active profile name reported by the host launcher. */
  readonly profile: string
  /** Actual launcher-owned directory, including application-owned profiles. */
  readonly profileDir?: string
  /** This plugin's own package name: the one row the panel must not disable. */
  readonly selfName: string
  /** The live Loader (the `loader` service). */
  readonly loader: Loader
  /** Harness home override; defaults to the environment's resolution. */
  readonly home?: string
  /**
   * The pending-uninstall seat file: one small JSON array per profile under
   * the harness home (see {@link pendingFilePath}). A file, not the storage
   * domain, so the boot sweep still runs when the domain is unavailable —
   * losing the record is what strands stop rows in the user's patch file.
   */
  readonly pendingFile?: string
  /**
   * Drop a user-plugin dependency from the profile install tree. Defaults to
   * `pnpm remove` in the profile directory (what official `dsh plugin remove`
   * forwards to). Tests inject a stub so they do not need a real pnpm project.
   * In-box seats never call this: they are not dependencies.
   */
  readonly removeDependency?: (packageName: string) => Promise<RemoveDependencyResult>
}

/** Outcome of pruning one user-plugin dependency (pnpm remove, or a test stub). */
export interface RemoveDependencyResult {
  readonly ok: boolean
  readonly detail: string
}

/** The manager face the Remote service delegates to. */
export interface InstalledManager {
  list(): Promise<MarketInstalledResult>
  setEnabled(packageName: string, enabled: boolean): Promise<MarketInstalledResult>
  uninstall(packageName: string): Promise<MarketInstalledResult>
  /** Take back disable rows of finished uninstalls; run once at plugin start. */
  sweep(): Promise<void>
  /**
   * Seed the file seat from a record an older version kept in the storage
   * domain (one-time migration). The file wins when it already holds
   * records; the caller then forgets the legacy field.
   */
  adoptPending(records: readonly PendingUninstall[]): Promise<void>
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The harness-home directory holding every pending-uninstall seat. */
// Keep the legacy storage path so pending removals survive the package rename.
const PENDING_DIR = 'dsh-desktop-safe-market'

/**
 * The pending-uninstall seat for one profile: a small JSON file under the
 * harness home (`$DSH_HOME` or `~/.dsh`), owned by this plugin and per
 * profile — a sweep must only ever touch its own profile's rows. Profile
 * names are validated (no separators) before they reach this path.
 */
export function pendingFilePath(profile: string, home: string = resolveDshHome()): string {
  return join(home, PENDING_DIR, 'pending-' + profile + '.json')
}

/**
 * Read a pending-uninstall seat. A missing seat is an empty list; an
 * unreadable or corrupt one is too — but loudly, because a lost record is
 * what strands stop rows in the user's patch file (they then hold a
 * reinstall down until someone notices).
 */
async function readPendingFile(file: string): Promise<PendingUninstall[]> {
  let content: string
  try {
    content = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    console.warn('[safer-dsh-market] pending-uninstall seat unreadable:', file, messageOf(error))
    return []
  }
  try {
    const parsed: unknown = JSON.parse(content)
    if (!Array.isArray(parsed)) throw new TypeError('seat does not hold an array')
    return parsed
      .filter(row => row !== null && typeof row === 'object' && !Array.isArray(row))
      .map(row => ({
        packageName: String((row as { packageName?: unknown }).packageName ?? ''),
        entryIds: (Array.isArray((row as { entryIds?: unknown }).entryIds) ? (row as { entryIds: unknown[] }).entryIds : [])
          .map(id => String(id)),
        at: String((row as { at?: unknown }).at ?? ''),
        completed: (row as { completed?: unknown }).completed !== false,
      }))
  } catch (error) {
    console.warn('[safer-dsh-market] pending-uninstall seat corrupt, treating as empty:', file, messageOf(error))
    return []
  }
}

/** Write a pending-uninstall seat (atomic, directory created on demand). */
async function writePendingFile(file: string, next: readonly PendingUninstall[]): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await atomicWrite(file, JSON.stringify(next, undefined, 2) + '\n')
}

/** How long `pnpm remove` may run before the uninstall notice names a timeout. */
const PNPM_REMOVE_MS = 180_000

/** Cap captured pnpm output so a failed remove cannot flood the panel notice. */
const PNPM_OUTPUT_LIMIT = 8_192

/**
 * Run `pnpm remove <name>` in the profile directory. The package name is
 * shape-checked again here so a future caller cannot turn the spawn into a
 * shell string; Windows uses an explicit command interpreter with a validated package name. Network is not required for a remove of an already-fetched tree.
 */
export function pnpmRemoveCommand(packageName: string, platform: NodeJS.Platform = process.platform): { command: string; args: string[] } {
  if (!PACKAGE_NAME_PATTERN.test(packageName) || /^[.-]/.test(packageName)) throw new Error('invalid npm package name')
  // The command text contains only a fixed verb and a validated package name.
  return platform === 'win32'
    ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `pnpm.cmd remove ${packageName}`] }
    : { command: 'pnpm', args: ['remove', packageName] }
}

export function spawnPnpmRemove(profileDir: string, packageName: string): Promise<RemoveDependencyResult> {
  if (!PACKAGE_NAME_PATTERN.test(packageName) || /^[.-]/.test(packageName)) {
    return Promise.resolve({ ok: false, detail: 'refusing to spawn pnpm with a name that is not an npm package' })
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: RemoveDependencyResult): void => {
      if (settled) return
      settled = true
      resolve(result)
    }
    const launch = pnpmRemoveCommand(packageName)
    const child = spawn(launch.command, launch.args, {
      cwd: profileDir,
      env: { ...process.env, CI: process.env.CI ?? 'true' },
      windowsHide: true,
    })
    let output = ''
    const append = (chunk: Buffer): void => {
      if (output.length >= PNPM_OUTPUT_LIMIT) return
      output += chunk.toString('utf8')
      if (output.length > PNPM_OUTPUT_LIMIT) output = output.slice(-PNPM_OUTPUT_LIMIT)
    }
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    const timer = setTimeout(() => {
      child.kill()
      finish({ ok: false, detail: `pnpm remove timed out after ${String(PNPM_REMOVE_MS / 1000)}s` })
    }, PNPM_REMOVE_MS)
    child.once('error', (error) => {
      clearTimeout(timer)
      const code = (error as NodeJS.ErrnoException).code
      finish({
        ok: false,
        detail: code === 'ENOENT' ? 'pnpm not found on PATH' : messageOf(error),
      })
    })
    child.once('close', (status) => {
      clearTimeout(timer)
      if (status === 0) {
        finish({ ok: true, detail: '' })
        return
      }
      const clipped = output.replace(/\s+/g, ' ').trim()
      finish({
        ok: false,
        detail: clipped !== '' ? clipped : `pnpm remove exited ${String(status)}`,
      })
    })
  })
}

/**
 * Create the manager over one profile directory.
 * @param options - profile identity, the live Loader, and the durable record seat.
 */
export function createInstalledManager(options: InstalledManagerOptions): InstalledManager {
  const profileDir = options.profileDir ?? resolveProfileDir(options.profile, options.home)
  const patchPath = join(profileDir, PROFILE_PATCH_FILENAME)
  const pendingPath = options.pendingFile ?? pendingFilePath(options.profile, options.home ?? resolveDshHome())
  const readPending = (): Promise<PendingUninstall[]> => readPendingFile(pendingPath)
  const writePending = (next: readonly PendingUninstall[]): Promise<void> => writePendingFile(pendingPath, next)
  const removeDependency = options.removeDependency
    ?? ((packageName: string) => spawnPnpmRemove(profileDir, packageName))

  /** The live entry map, keyed by the ids the Loader reports (`include:<id>` for composed rows). */
  const liveEntries = (): Map<string, Entry> => {
    const map = new Map<string, Entry>()
    for (const entry of options.loader.entries()) map.set(entry.id, entry)
    return map
  }

  /** Composed rows carry the root include's prefix; accept the bare form too for other boot shapes. */
  const findLive = (map: Map<string, Entry>, id: string): Entry | undefined =>
    map.get(`include:${id}`) ?? map.get(id)

  /**
   * What the panel manages: packages in both `dependencies` and `bundles`,
   * plugin deps that never joined the bundle stack (so uninstall can reach
   * them), plus any in-box seat the desktop client marked as its own.
   */
  const readUserBundles = async (): Promise<{
    manifest: ProfileManifest
    bundles: string[]
    unregistered: string[]
    seats: string[]
  }> => {
    const manifest = await readManifest(profileDir)
    return {
      manifest,
      bundles: userBundles(manifest),
      unregistered: unregisteredPlugins(manifest, profileDir),
      seats: desktopSeatBundles(manifest, profileDir),
    }
  }

  const assertInstalled = (bundles: readonly string[], packageName: string): void => {
    if (!bundles.includes(packageName)) {
      throw new Error(`${packageName} is not an installed plugin package of profile ${options.profile}`)
    }
  }

  // The mutating verbs read-modify-write two files (the manifest, the patch
  // layer). The panel serializes itself with its busy state, but two browser
  // tabs reach the same Remote, so the verbs serialize here too — a promise
  // chain, never a queue with its own failure semantics.
  let mutations: Promise<unknown> = Promise.resolve()
  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const run = mutations.then(task, task)
    mutations = run.then(() => {}, () => {})
    return run
  }

  /** Apply the live half of a disable/enable, entry by entry, collecting failures. */
  const applyLive = async (ids: readonly string[], enabled: boolean): Promise<void> => {
    const live = liveEntries()
    const failures: string[] = []
    for (const id of ids) {
      const entry = findLive(live, id)
      if (entry === undefined) continue
      try {
        await entry.update({ disabled: enabled ? null : true })
      } catch (error) {
        failures.push(`${id}: ${messageOf(error)}`)
      }
    }
    if (failures.length > 0) throw new Error(failures.join('; '))
  }

  async function list(): Promise<MarketInstalledResult> {
    let bundles: string[]
    let unregistered: string[]
    let seats: string[]
    try {
      ;({ bundles, unregistered, seats } = await readUserBundles())
    } catch (error) {
      return { packages: [], profile: options.profile, error: messageOf(error) }
    }
    // A record for a package that is back in the manifest means a same-session
    // uninstall's stop rows are still holding it down (the boot sweep has not
    // run yet): surface it so the panel can explain the disabled state.
    const pending = await readPending()
    const heldDown = (packageName: string): boolean =>
      pending.some(record => record.packageName === packageName && record.entryIds.length > 0)
    const live = liveEntries()
    const packages: MarketInstalledPackage[] = []
    const seen = new Set<string>()
    const pushPackage = async (packageName: string, flags: { inBox: boolean; unregistered: boolean }): Promise<void> => {
      if (seen.has(packageName)) return
      seen.add(packageName)
      const self = packageName === options.selfName
      try {
        const info = await readBundleInfo(profileDir, packageName)
        const entries: MarketInstalledEntry[] = info.entries.map(({ id, name }) => {
          const entry = findLive(live, id)
          return {
            id,
            name,
            present: entry !== undefined,
            enabled: entry !== undefined && !entry.disabled,
            phase: entry?.fiber === undefined ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
          }
        })
        packages.push({
          packageName,
          version: info.version,
          description: info.description,
          repository: info.repository,
          self,
          inBox: flags.inBox,
          unregistered: flags.unregistered,
          enabled: entries.some(entry => entry.enabled),
          entries,
          error: '',
          heldDown: heldDown(packageName),
        })
      } catch (error) {
        // A bundle whose package vanished from node_modules is still an
        // install fact: list it, say why it cannot be read, and let the user
        // uninstall the residue.
        packages.push({
          packageName, version: '', description: '', repository: '', self,
          inBox: flags.inBox, unregistered: flags.unregistered, enabled: false, entries: [],
          error: messageOf(error), heldDown: heldDown(packageName),
        })
      }
    }
    for (const packageName of bundles) await pushPackage(packageName, { inBox: false, unregistered: false })
    for (const packageName of unregistered) await pushPackage(packageName, { inBox: false, unregistered: true })
    for (const packageName of seats) await pushPackage(packageName, { inBox: true, unregistered: false })
    return { packages, profile: options.profile, error: '' }
  }

  async function setEnabled(packageName: string, enabled: boolean): Promise<MarketInstalledResult> {
    if (packageName === options.selfName) {
      // Disabling the market from inside the market is a one-way door: the
      // panel that would re-enable it goes down with the plugin.
      throw new Error('the marketplace cannot disable itself from its own panel')
    }
    // Seats count as installed here. Their entries are ordinary loader rows,
    // and the disable mechanism is the profile's own patch layer — neither
    // cares how the package arrived. Accepting only dependencies would leave
    // the panel showing a switch the Host refuses, which is worse than either
    // offering it or hiding it.
    const { bundles, unregistered, seats } = await readUserBundles()
    if (unregistered.includes(packageName) && !bundles.includes(packageName) && !seats.includes(packageName)) {
      throw new Error(
        `${packageName} is installed as a dependency but is not in the bundle stack — Enable cannot load it; Uninstall will remove it`,
      )
    }
    assertInstalled([...bundles, ...seats], packageName)
    const info = await readBundleInfo(profileDir, packageName)
    const ids = info.entries.map(entry => entry.id)
    // Durable first: the patch row holds the state across boots even when the
    // live nudge below finds nothing to nudge (a launcher without the watcher
    // still converges at the next recompose or boot).
    await setEntryDisabled(patchPath, ids, !enabled)
    // Whatever rows the patch layer now carries say what the user just asked
    // for, so a same-session uninstall's stop rows for this package are no
    // longer ours: an enable removed them, a deliberate disable is the user's
    // own and the boot sweep must not take it back. Drop the record.
    //
    // BEFORE the live nudge, not after. The nudge is the half that can fail
    // for reasons outside this profile (a loader that refuses, an entry mid
    // teardown), and a throw between the rows and this write would leave the
    // record standing over rows that now say the opposite — the next boot's
    // sweep would then take back the disable the user just asked for. Both
    // writes are idempotent, so a retry after either one costs nothing.
    const pending = await readPending()
    if (pending.some(record => record.packageName === packageName)) {
      await writePending(pending.filter(record => record.packageName !== packageName))
    }
    await applyLive(ids, enabled)
    return await list()
  }

  async function uninstall(packageName: string): Promise<MarketInstalledResult> {
    const { bundles, unregistered, seats } = await readUserBundles()
    const inBox = seats.includes(packageName)
    assertInstalled(inBox ? seats : [...bundles, ...unregistered], packageName)
    // An in-box seat has no dependency to drop and no pnpm-managed tree to
    // leave behind: the directory IS the install, and it was put there by a
    // client that may no longer exist to take it back. Removing the files is
    // therefore part of the uninstall, not litter for someone else to sweep.
    const seatDir = inBox ? desktopSeatDir(profileDir, packageName) : undefined
    const self = packageName === options.selfName
    const info = await readBundleInfo(profileDir, packageName).catch(() => ({ version: '', description: '', repository: '', entries: [] as { id: string; name: string }[] }))
    const ids = info.entries.map(entry => entry.id)
    const faults: string[] = []
    // Stop first: a live plugin holds files open, and on Windows that is
    // what makes `pnpm remove` fail EBUSY. Self-uninstall skips the stop —
    // this fiber is the one answering the call.
    if (!self && ids.length > 0) {
      let rowsWritten = false
      try {
        await setEntryDisabled(patchPath, ids, true)
        rowsWritten = true
      } catch (error) {
        faults.push('stop rows: ' + messageOf(error))
        console.warn('[safer-dsh-market] uninstall stop rows failed:', error)
      }
      if (rowsWritten) {
        try {
          const pending = (await readPending()).filter(record => record.packageName !== packageName)
          await writePending([...pending, { packageName, entryIds: ids, at: new Date().toISOString(), completed: false }])
        } catch (error) {
          faults.push('sweep record: ' + messageOf(error))
          console.warn('[safer-dsh-market] uninstall sweep record failed:', error)
        }
      }
      try {
        await applyLive(ids, false)
      } catch (error) {
        faults.push('live stop: ' + messageOf(error))
      }
    }
    if (inBox) {
      const manifest = await readManifest(profileDir)
      if (!removeBundle(manifest, packageName)) {
        throw new Error(`${packageName} is listed as a bundle but nothing removable was found`)
      }
      await writeManifest(profileDir, manifest)
      if (seatDir !== undefined) {
        try {
          if (!await seatHasOtherReferences(profileDir, packageName, seatDir)) {
            await rm(seatDir, { recursive: true, force: true })
          }
        } catch (error) {
          faults.push('seat directory: ' + messageOf(error))
        }
      }
    } else {
      // Official `dsh plugin remove` is `pnpm remove` then reconcile. Do the
      // same: prune the tree while the name is still a dependency, then drop
      // any leftover `bundles` seat against a fresh read. pnpm failure is
      // not a failed uninstall — the manifest edit still keeps the next boot
      // from composing it; the notice tells the user the tree was not pruned.
      try {
        const pruned = await removeDependency(packageName)
        if (!pruned.ok) faults.push('pnpm remove: ' + pruned.detail)
      } catch (error) {
        faults.push('pnpm remove: ' + messageOf(error))
        console.warn('[safer-dsh-market] uninstall pnpm remove failed:', error)
      }
      try {
        const after = await readManifest(profileDir)
        if (removeBundle(after, packageName)) await writeManifest(profileDir, after)
      } catch (error) {
        faults.push('manifest: ' + messageOf(error))
        console.warn('[safer-dsh-market] uninstall manifest edit failed:', error)
      }
      const verified = await readManifest(profileDir)
      if (Object.hasOwn(verified.dependencies ?? {}, packageName) || verified.dsh?.profile?.bundles?.includes(packageName)) {
        throw new Error(`uninstall incomplete for ${packageName}: ${faults.join('; ')}`)
      }
      try {
        await removePackageInstallGate(profileDir, packageName)
      } catch (error) {
        faults.push('install gate: ' + messageOf(error))
        console.warn('[safer-dsh-market] uninstall install-gate cleanup failed:', error)
      }
    }
    try {
      const pending = await readPending()
      if (pending.some(record => record.packageName === packageName)) {
        await writePending(pending.map(record =>
          record.packageName === packageName ? { ...record, completed: true } : record))
      }
    } catch (error) {
      faults.push('sweep record: ' + messageOf(error))
    }
    const result = await list()
    if (faults.length === 0) return result
    // `may-run` is specifically "the package was not stopped". A failed sweep
    // record is the opposite — the stop rows DID land and are now stranded in
    // the user's patch file with nothing scheduled to take them back — so it
    // belongs with the leftover work, not with the two faults that leave the
    // plugin running.
    const mayRun = faults.some(fault =>
      fault.startsWith('stop rows:') || fault.startsWith('live stop:'))
    return {
      ...result,
      notice: faults.join('; '),
      noticeKind: mayRun ? 'may-run' : 'faults',
    }
  }

  async function sweep(): Promise<void> {
    // The seat is a file precisely so a broken storage domain cannot strand
    // the rows; readPendingFile itself never rejects (it degrades to [] with
    // a warning), and a failed edit keeps the record for the next boot.
    const all = await readPending()
    if (all.length === 0) return
    try {
      const manifest = await readManifest(profileDir)
      const pending = all.filter(record => record.completed !== false
        || (!Object.hasOwn(manifest.dependencies ?? {}, record.packageName)
          && !manifest.dsh?.profile?.bundles?.includes(record.packageName)))
      if (pending.length === 0) return
      // Completed removals may release their stop rows, including after a reinstall.
      // An interrupted removal may only release them once the manifest no longer
      // references the package; otherwise it must stay disabled.
      await setEntryDisabled(patchPath, [...new Set(pending.flatMap(record => [...record.entryIds]))], false)
      await writePending(all.filter(record => !pending.includes(record)))
    } catch (error) {
      console.warn('[safer-dsh-market] uninstall sweep failed:', error)
    }
  }

  async function adoptPending(records: readonly PendingUninstall[]): Promise<void> {
    if (records.length === 0) return
    // The file wins: a seat that already holds records was written by the
    // current build, and the domain copy is older.
    if ((await readPending()).length > 0) return
    await writePending(records)
  }

  return {
    list,
    setEnabled: (packageName: string, enabled: boolean) => serialize(() => setEnabled(packageName, enabled)),
    uninstall: (packageName: string) => serialize(() => uninstall(packageName)),
    sweep: () => serialize(sweep),
    adoptPending: (records) => serialize(() => adoptPending(records)),
  }
}
