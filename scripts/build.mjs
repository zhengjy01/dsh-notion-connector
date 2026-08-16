/**
 * dsh-notion build script — zero-dependency build via esbuild.
 *
 * - Host half:  src/index.ts             → lib/index.js   (ESM, externals left
 *   to the runtime: @deepseek-ai/* resolves from the profile's node_modules)
 * - Browser half: src/client/index.ts    → lib/client.js  (CJS bundle wrapped
 *   in the web GUI's __ModuleLoader__ closure-factory contract: the loader
 *   calls factory(require) and expects the returned module.exports; externals
 *   react / react/jsx-runtime are resolved through the injected require)
 *
 * The wrapper mirrors the format the dsh-web-ui shared preset emits.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(root, '..')
const outDir = join(pkgRoot, 'lib')
mkdirSync(outDir, { recursive: true })

/** Packages the host half leaves to the runtime (peerDependencies). */
const HOST_EXTERNAL = [
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-llm',
]

/** Browser externals resolved through the loader's injected require. */
const CLIENT_EXTERNAL = ['react', 'react/jsx-runtime']

// ---------------------------------------------------------------- host half
await build({
  entryPoints: [join(pkgRoot, 'src/index.ts')],
  outfile: join(outDir, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: HOST_EXTERNAL,
  legalComments: 'inline',
  logLevel: 'info',
})

// ------------------------------------------------------------- browser half
const result = await build({
  entryPoints: [join(pkgRoot, 'src/client/index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: CLIENT_EXTERNAL,
  write: false,
  logLevel: 'info',
})

const bundle = result.outputFiles[0].text
const wrapper = `window.__ModuleLoader__.load({
\tid: "dsh-notion",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${indent(bundle, 2)}
\t\treturn module.exports;
\t}
});
`

writeFileSync(join(outDir, 'client.js'), wrapper)
console.log('✔ lib/index.js  (host, ESM)')
console.log('✔ lib/client.js (browser, __ModuleLoader__ closure factory)')

/** Indent every line of the bundle so the wrapper stays readable. */
function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line) => (line === '' ? line : pad + line))
    .join('\n')
}
