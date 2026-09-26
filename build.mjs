/**
 * Single-file client + ESM host build for safer-dsh-market.
 *
 * The web server serves exactly one file per plugin
 * (/plugins/safer-dsh-market/client.js), so the client half is one CJS
 * bundle wrapped in the ModuleLoader factory handshake; @deepseek-ai/dsh-* and
 * react stay external (the profile's healed node_modules and the app's module
 * system provide them). The host half is plain ESM for Node, externalizing
 * @deepseek-ai/dsh-* plus cordis while bundling schemastery (the Loader
 * validates Config against the schema).
 */
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// The version lives in two seats (package.json and dsh.plugin.json) and
// nothing syncs them but this gate: a drifted manifest would ship a release
// that misnames itself in the plugin list. Fail before any artifact lands.
const { version: packageVersion } = JSON.parse(readFileSync('package.json', 'utf8'))
const { version: manifestVersion } = JSON.parse(readFileSync('dsh.plugin.json', 'utf8'))
if (packageVersion !== manifestVersion) {
  throw new Error(`version drift: package.json is ${packageVersion} but dsh.plugin.json is ${manifestVersion} — bump both`)
}

mkdirSync('lib', { recursive: true })

const dshExternal = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*']

/**
 * Minify every artifact, but never the names.
 *
 * The Typert manifest names its service class as a string (`exportName:
 * 'SafeMarketRuntime'`), and cordis reads constructor names for diagnostics;
 * `minifyIdentifiers` would rename the class out from under both. `keepNames`
 * restores `.name` on every function and class, which is the only thing those
 * readers look at — so the rename stays invisible to them and the bytes still
 * come off.
 */
const minified = { minify: true, keepNames: true }

/**
 * A bundled CommonJS dependency keeps its own `require` calls, and esbuild
 * rewrites them to a shim that throws unless a real `require` is in scope —
 * which, in an ESM output, there is not. `yaml` reaches for `process` while
 * its module body evaluates, so the throw lands at IMPORT time and takes the
 * whole plugin tree down with it (0.2.0 shipped exactly that). Hand the shim
 * the real thing instead of hunting the next dependency that needs it.
 */
const esmRequireBanner = {
  js: "import { createRequire as __createRequire } from 'node:module'\nconst require = __createRequire(import.meta.url)\n",
}

// `src/plugin.ts` is its own artifact, not a chunk of the entry: the entry
// reaches it with `import('./plugin.js')` precisely so that the modules whose
// absence throws at import time are evaluated inside a guard. Bundling it in
// would inline the body and evaluate it eagerly, quietly undoing the split —
// so the specifier is external for the entry's build, and the plugin body is
// built separately under that exact name.
const hostEntries = ['src/index.ts', 'src/plugin.ts', 'src/invariant.ts']
for (const entry of hostEntries) {
  await build({
    entryPoints: [entry],
    outfile: entry.replace('src/', 'lib/').replace('.ts', '.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: ['node22'],
    sourcemap: true,
    ...minified,
    external: entry === 'src/index.ts' ? [...dshExternal, './plugin.js'] : dshExternal,
    banner: esmRequireBanner,
    logLevel: 'info',
  })
}

// The banner above is only half the fix: nothing else in this pipeline ever
// imports the host bundle, so a module-eval throw reaches the user as "the
// marketplace vanished" rather than as a failed build. Import it here, which
// is exactly what the Loader does with it.
for (const entry of hostEntries) {
  const outfile = entry.replace('src/', 'lib/').replace('.ts', '.js')
  try {
    await import(pathToFileURL(resolve(outfile)).href)
  } catch (error) {
    throw new Error(`${outfile} does not import under ESM: ${error instanceof Error ? error.message : String(error)}`)
  }
}

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  ...minified,
  jsx: 'automatic',
  external: [...dshExternal, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'safer-dsh-market', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

// Run tsc through node itself: the `.bin` shims are platform-specific (a
// POSIX script on Unix, a `.cmd` on Windows) and some sandboxes refuse to
// exec command interpreters, while spawning the current node binary with the
// typescript entry works everywhere.
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' })
