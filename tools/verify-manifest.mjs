import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const checks = []
checks.push(['main', pkg.main, existsSync(join(root, pkg.main))])
for (const [key, target] of Object.entries(pkg.exports)) {
  if (target.includes('*')) continue
  checks.push(['exports ' + key, target, existsSync(join(root, target))])
}
for (const patch of pkg.dsh.bundle.patch) checks.push(['patch ' + patch, patch, existsSync(join(root, patch))])
checks.push(['client platform', pkg.dsh.client.platform, pkg.dsh.client.platform === 'web'])
for (const [name, path, ok] of checks) console.log(ok ? 'OK  ' : 'MISS', name, '->', path)
JSON.parse(readFileSync(join(root, 'locale/zh.json'), 'utf8'))
JSON.parse(readFileSync(join(root, 'locale/en.json'), 'utf8'))
console.log('OK   locale json')
