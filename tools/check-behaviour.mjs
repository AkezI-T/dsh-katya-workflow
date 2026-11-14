/** Behaviour checks for the browser half: slot shape, stored preferences, the return flow and both rows. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = readFileSync(join(root, 'lib/client.js'), 'utf8')

let failures = 0
function check(name, ok, detail) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || detail === undefined ? '' : ' — ' + detail))
  if (!ok) failures += 1
}

const storage = new Map()

function element(type, props, ...children) {
  return { type, props: props || {}, children }
}
function classNameOf(node) {
  return node && node.props ? node.props.className : undefined
}
function findAll(node, predicate, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (predicate(node)) out.push(node)
  const kids = node.children ?? []
  for (const child of kids) {
    if (Array.isArray(child)) for (const inner of child) findAll(inner, predicate, out)
    else findAll(child, predicate, out)
  }
  return out
}
function render(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (typeof node.type === 'function') return render(node.type(node.props))
  if (node.type === 'Fragment') return render(node.children)
  const children = (node.children ?? []).map((child) => (Array.isArray(child) ? child.map(render) : render(child)))
  return { ...node, children }
}
function textOf(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (typeof node !== 'object') return ''
  return (node.children ?? []).map((child) => (Array.isArray(child) ? child.map(textOf).join('') : textOf(child))).join('')
}

function harness(options = {}) {
  const state = { running: options.running ?? true, clock: 0, frames: 0 }
  const writes = []
  const events = []
  const observers = []
  const box = {
    isConnected: true,
    scrollHeight: 20000,
    clientHeight: 800,
    getBoundingClientRect: () => ({ top: 100 }),
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent(event) { events.push(event.type); return true },
    querySelectorAll: () => [prompt],
  }
  let top = options.scrollTop ?? 19100
  Object.defineProperty(box, 'scrollTop', {
    get: () => top,
    set: (value) => { top = value; writes.push(Math.round(value)) },
  })
  const prompt = {
    getAttribute: (name) => (name === 'data-chat-turn' ? '3' : null),
    getBoundingClientRect: () => ({ top: options.promptTop ?? -3000 }),
  }
  const indicator = { isConnected: true }
  const documentStub = {
    body: {},
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    head: { appendChild() {} },
    querySelector: (selector) => {
      if (selector === '[data-chat-running]') return state.running ? indicator : null
      if (selector === '[data-conversation-scroll]') return options.noScroller ? null : box
      return null
    },
  }
  class MutationObserverStub {
    constructor(cb) { this.cb = cb; observers.push(this) }
    observe() {}
    disconnect() {}
  }
  const win = {
    __ModuleLoader__: { load(spec) { win.spec = spec } },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => { storage.set(key, String(value)) },
    },
    matchMedia: () => ({ matches: options.reducedMotion === true }),
  }
  const raf = (cb) => { state.frames += 1; state.clock += 16; cb(state.clock); return state.frames }
  const performanceStub = { now: () => state.clock }
  class EventStub { constructor(type) { this.type = type } }
  class WheelEventStub extends EventStub {}

  const react = {
    createElement: element,
    Fragment: 'Fragment',
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: () => ({ current: null }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
  }
  new Function(
    'window', 'document', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame',
    'setTimeout', 'clearTimeout', 'performance', 'WheelEvent', 'Event', source,
  )(
    win, documentStub, MutationObserverStub, raf, () => {}, (cb) => { cb(); return 0 }, () => {},
    performanceStub, WheelEventStub, EventStub,
  )

  const factory = win.spec.factory((name) => (name === 'react' ? react : {}))
  const registered = []
  factory.apply({
    effect(fn) { fn() },
    locale: {
      register: (ns, dicts) => { win.dicts = dicts; return () => {} },
      bind: (ns) => (key) => (win.dicts && win.dicts.zh && win.dicts.zh[key]) || key,
    },
    slots: {
      inject: (name, cb) => cb(),
      register: (opts, component) => { registered.push({ opts, component }); return () => {} },
    },
    configForms: {
      get: () => ({ set: () => {} }),
      describe: () => ({ ensure: async () => {}, getSnapshot: () => ({ status: 'ready' }), subscribe: () => () => {} }),
      whileServed: (name, cb) => cb(),
    },
  })

  function complete() {
    state.running = false
    indicator.isConnected = false
    const removal = { nodeType: 1, matches: (s) => s === '[data-chat-running]', querySelector: () => null }
    for (const observer of observers) observer.cb([{ removedNodes: [removal] }])
  }

  return { factory, registered, box, state, writes, events, complete }
}

function sectionOf(h) {
  return h.registered.find((entry) => entry.opts.name === 'settings.section')
}

// --- 槽注册 ---
{
  const h = harness()
  const names = h.registered.map((e) => e.opts.name + (e.opts.id ? '#' + e.opts.id : '') + (e.opts.key ? ':' + e.opts.key : ''))
  check('三个槽注册到位', JSON.stringify(names) === JSON.stringify([
    'tool.call.toolview:run_code',
    'settings.general.item#transcript-view',
    'settings.section#katya',
  ]), JSON.stringify(names))
}

// --- 偏好存储与设置页注入 ---
{
  const h = harness()
  const injected = sectionOf(h).opts.inject()
  check('默认滑行时长 1000ms', injected.hooks.returnDuration.getSnapshot() === 1000, String(injected.hooks.returnDuration.getSnapshot()))
  injected.setReturnDuration('700')
  check('时长可调到 700ms', injected.hooks.returnDuration.getSnapshot() === 700, String(injected.hooks.returnDuration.getSnapshot()))
  injected.setReturnDuration('123')
  check('非法时长被忽略', injected.hooks.returnDuration.getSnapshot() === 700, String(injected.hooks.returnDuration.getSnapshot()))
  check('默认回跳开启', injected.hooks.returnMode.getSnapshot() === 'on', String(injected.hooks.returnMode.getSnapshot()))
  injected.setReturnMode('off')
  check('回跳可关闭', injected.hooks.returnMode.getSnapshot() === 'off', String(injected.hooks.returnMode.getSnapshot()))
  check('时长写入本地存储', storage.get('katya-return.duration') === '700', String(storage.get('katya-return.duration')))
}

// --- 设置页组件 ---
{
  storage.clear()
  const h = harness()
  const section = sectionOf(h)
  const injected = section.opts.inject()
  const tree = section.component({
    translate: injected.translate,
    useReturnMode: (select) => select(injected.hooks.returnMode.getSnapshot()),
    useReturnDuration: (select) => select(injected.hooks.returnDuration.getSnapshot()),
    useFinalOnly: (select) => select(injected.hooks.finalOnly.getSnapshot()),
    useForm: (select) => select({ writable: true }),
    useMemberForm: (select) => select({ status: 'ready', writable: true, value: {}, revision: 1 }),
    useSettingsMirror: (select) => select({ status: 'ready' }),
    setFinalOnly: () => {},
    setReturnMode: injected.setReturnMode,
    setReturnDuration: injected.setReturnDuration,
  })
  const rendered = render(tree)
  const titles = findAll(rendered, (node) => classNameOf(node) === 'ks-pref-title').map(textOf)
  check('页面含三行设置', JSON.stringify(titles) === JSON.stringify(['完成后仅显示最终回复', '回答结束后自动滚动到本轮问题', '自动滚动时长']), JSON.stringify(titles))
  const selected = findAll(tree, (node) => node.props !== undefined && node.props.selectedLabel !== undefined).map((node) => node.props.selectedLabel)
  check('选中值可读', JSON.stringify(selected) === JSON.stringify(['关', '开', '1 秒']), JSON.stringify(selected))
  check('导航标签为 Katya', section.opts.label() === 'Katya', String(section.opts.label()))
}

// --- 运行中与结算后的说明行 ---
{
  const h = harness()
  const row = h.registered.find((e) => e.opts.key === 'run_code')
  const baseProps = {
    t: (key) => key,
    useStepMode: (select) => select('official'),
  }
  const args = {
    has: (key) => key === 'code',
    textPrefix: (key) => (key === 'code' ? 'const x = 1' : ''),
  }
  const running = row.component({ ...baseProps, block: { kind: 'tool-call', args, subCalls: [] } })
  check('运行中不显示摘要', findAll(running, (node) => classNameOf(node) === 'ks-summary').length === 0)

  const argsDone = {
    has: () => true,
    textPrefix: (key) => (key === 'description' ? '检查仓库状态' : 'const x = 1'),
    complete: () => true,
  }
  const settled = row.component({ ...baseProps, block: { kind: 'tool-result', args: argsDone, subCalls: [], content: [] } })
  const summaries = findAll(settled, (node) => classNameOf(node) === 'ks-summary')
  check('结算后显示说明', summaries.length === 1 && summaries[0].props.text === '检查仓库状态', JSON.stringify(summaries.map((node) => node.props.text)))

  const argsNoDescription = { has: () => true, textPrefix: (key) => (key === 'code' ? 'const y = 2\nmore' : ''), complete: () => true }
  const fallback = row.component({ ...baseProps, block: { kind: 'tool-result', args: argsNoDescription, subCalls: [], content: [] } })
  const fallbackSummaries = findAll(fallback, (node) => classNameOf(node) === 'ks-summary')
  check('结算后无说明才回退代码首行', fallbackSummaries.length === 1 && fallbackSummaries[0].props.text === 'const y = 2', JSON.stringify(fallbackSummaries.map((node) => node.props.text)))
}

// --- 回跳行为 ---
{
  storage.clear()
  const h = harness()
  h.complete()
  const last = h.writes[h.writes.length - 1]
  check('长轮次落到提问位置', last === 15988, String(last))
  check('落点前先离开尾部容差', h.writes[0] === 19068, String(h.writes[0]))
  check('派发 scroll 与 scrollend', h.events.includes('scroll') && h.events.includes('scrollend'), JSON.stringify(h.events.slice(-3)))
}

{
  const h = harness({ scrollTop: 100 })
  h.complete()
  check('读者已滚离时不动作', h.writes.length === 0, String(h.writes.length))
}

{
  const h = harness({ noScroller: true })
  h.complete()
  check('无滚动容器时不动作', h.writes.length === 0, String(h.writes.length))
}

{
  storage.clear()
  storage.set('katya-return.mode', 'off')
  const h = harness()
  h.complete()
  check('开关关闭时不动作', h.writes.length === 0, String(h.writes.length))
}

{
  storage.clear()
  const h = harness({ reducedMotion: true })
  h.complete()
  check('减少动效时一次到位', h.writes.length === 1 && h.writes[0] === 15988, JSON.stringify(h.writes))
}

{
  storage.clear()
  storage.set('katya-return.duration', '400')
  const fast = harness()
  fast.complete()
  storage.clear()
  storage.set('katya-return.duration', '2000')
  const slow = harness()
  slow.complete()
  check('时长影响帧数', fast.writes.length < slow.writes.length, fast.writes.length + ' vs ' + slow.writes.length)
}

{
  storage.clear()
  const h = harness({ running: false })
  h.complete()
  check('极短轮次只看移除事件也能回跳', h.writes.length > 0 && h.writes[h.writes.length - 1] === 15988, JSON.stringify(h.writes.slice(-1)))
}

console.log('')
console.log(failures === 0 ? 'all behaviour checks passed' : failures + ' check(s) failed')
process.exit(failures === 0 ? 0 : 1)
