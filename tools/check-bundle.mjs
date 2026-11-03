/** Load lib/client.js behind a stub loader and report its registration shape. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
let captured = null
const windowStub = {
  __ModuleLoader__: { load(spec) { captured = spec } },
  localStorage: { getItem() { return null }, setItem() {} },
}
const documentStub = {
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  head: { appendChild() {} },
}
new Function('window', 'document', source)(windowStub, documentStub)
if (captured === null) throw new Error('bundle never called __ModuleLoader__.load')
const exportsObject = captured.factory((name) => name === 'react' ? { createElement() {}, Fragment: {} } : {})
console.log('id:', captured.id)
console.log('exports:', Object.keys(exportsObject).join(', '))
console.log('inject:', JSON.stringify(exportsObject.inject))
console.log('apply:', typeof exportsObject.apply)
