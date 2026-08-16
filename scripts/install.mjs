/**
 * dsh-notion local install script (development convenience).
 *
 * Usage: node scripts/install.mjs
 *
 * Copies the built plugin into ~/.dsh/profiles/node_modules/dsh-notion — the
 * hoisted store the web profile resolves out-of-tree plugins from. For normal
 * installs use `dsh plugin --profile web add github:zhengjy01/dsh-notion`.
 *
 * A GUI restart is still required afterwards: the host scans the plugin set
 * at boot ("plugin-set changes take effect on restart").
 */

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(root, '..')

const sourceLib = join(pkgRoot, 'lib/index.js')
if (!existsSync(sourceLib)) {
  throw new Error(`missing ${sourceLib}; run \`pnpm build\` first`)
}

const profileStore = join(homedir(), '.dsh/profiles/node_modules/dsh-notion')
mkdirSync(profileStore, { recursive: true })
cpSync(join(pkgRoot, 'lib'), join(profileStore, 'lib'), { recursive: true })
cpSync(join(pkgRoot, 'package.json'), join(profileStore, 'package.json'))
cpSync(join(pkgRoot, 'cordis.patch.yml'), join(profileStore, 'cordis.patch.yml'))

const installed = readFileSync(join(profileStore, 'lib/index.js'), 'utf8')
const built = readFileSync(sourceLib, 'utf8')
if (installed !== built) throw new Error('install mismatch: lib/index.js differs after copy')
console.log(`✔ installed dsh-notion -> ${profileStore}`)
console.log('重启 dsh web 后生效（host 只在启动时扫描插件集）。')
