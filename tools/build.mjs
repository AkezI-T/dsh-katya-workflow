/** Copy the hand-written halves into lib/ and syntax-check each output. */

import { copyFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const halves = [
  ['src/index.js', 'lib/index.js'],
  ['src/client.js', 'lib/client.js'],
  ['src/leaderpro.js', 'lib/leaderpro.js'],
]

mkdirSync(join(root, 'lib'), { recursive: true })
for (const [source, output] of halves) {
  copyFileSync(join(root, source), join(root, output))
  execFileSync(process.execPath, ['--check', join(root, output)], { stdio: 'inherit' })
}
console.log('katya-steps: lib rebuilt')
