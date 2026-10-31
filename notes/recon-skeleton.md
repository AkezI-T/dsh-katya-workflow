# 本机 UI 插件工程骨架（可复制模板）—— 调研

调研人：rin（只读调研，写作作用域仅本文件）。
证据口径：**优先读本机真实工程 + 装在 `app.asar` 里的库代码**；行号一律现查，查不到的写「未验证」。

---

## 0. 结论摘要（先看这段）

1. **DSH 的插件 = 一个 npm 包 + 一份 bundle patch。** `package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，patch 里 `- insert:` 一行把包名挂成 loader 条目；profile 的 `dsh.profile.bundles` 里列出同一个包名，客户端 bundle 才会被扫描进浏览器启动图。缺任一半，另一半单独都不成立（`dsh-session-archive/src/index.ts:30-31`、`.ref-dsh-compact-codex/cordis.patch.yml:527-531`）。
2. **同一个包可以有两个半边，产物形态不同。** host 半边是普通 ESM（loader 直接 import，导出 `name/inject/Config/apply`）；browser 半边必须是 `window.__ModuleLoader__.load({id, factory})` 注册的惰性 CJS factory，且 `id` 必须等于包名（`tools/build.mjs:26-40,78-94`；`dsh-client-modules/lib/client.js:874` 的校验原文）。
3. **两半边的通信没有专用 RPC 帮你封装。** 三个样板都走**同源 HTTP 路由**：host 用 `ctx.webServer.register({kind:'exact', path, handler})` 挂路由并配信任栅栏，browser 用裸 `fetch()`（`dsh-session-archive/src/host/routes.ts:88-100`、`dsh-usage-dashboard/src/plugin.js:131-145`、`dsh-session-archive/src/client/api.ts:29-43`）。
4. **设置项有两条完全不同的路径。** (a) 想要「设置 → 插件」里的自动表单：host 侧 `Config` 字段打 `meta.volatile`，`dsh-settings` 才会把它当可编辑项（`dsh-settings/lib/index.js:413-440`）。(b) 想要自己的设置页：browser 侧往 `settings.section`（一级分区）或 `settings.general.item`（通用设置里一行）注册，并用 `ctx.configForms.whileServed([ns], …)` 跟随 host 的命名空间（`dsh-session-archive/src/client/index.ts:96-112`、`dsh-client-ui-settings-session-log/lib/client.js:146-170`）。
5. **本机有一个和我们目标几乎同构的先例** `.ref-dsh-compact-codex`：host 侧替换服务 + browser 侧接管 chat 节点渲染 + 卸载即回落。它的 browser 半边是**手写产物、不跑构建链**，注册界面用的正是 `conversation.chat.node` 这个 keyed slot（`lib/client.js:217-222`）。
6. **`dsh.client.immediately: true` 的实际语义（实证）**：外壳在启动应用条目前，先 `await` 所有 immediate 行的 `modules.prefetch(id)`（只取脚本文本、注册 factory，**不执行模块体**）。它不是「更早激活插件」，激活仍由 loader 条目决定（shell `dist/assets/index-*.js`：`prefetchImmediateTier(){… await Promise.all(...filter(e=>e.immediately).map(e=>this.modules.prefetch(e.id)))}`；`dsh-client-modules/lib/index.js:398-410`）。
7. **最小可运行骨架 ≈ 12 个文件**（见 §7）。TS/TSX + esbuild 与纯 JS + 复制构建两条路都行；选择只影响构建脚本，不影响包形态。

---

## 1. 证据来源与版本

| 来源 | 版本/形态 | 用途 |
|---|---|---|
| `F:/Agent WorkSpace/DeepSeekHarnessWorkspace/dsh-session-archive` | 0.1.0（vendored 自 `@linxin666/dsh-session-archive` 0.3.24，Apache-2.0） | 样板 A：重型 UI（TS/TSX + CSS Modules + esbuild） |
| `…/DeepSeekHarnessWorkspace/dsh-usage-dashboard` | 0.2.0 | 样板 B：轻型 UI（纯 JS + 复制构建 + 内联样式） |
| `…/DeepSeekHarnessWorkspace/.ref-dsh-compact-codex` | 1.0.0（`private: true`） | 样板 C：替换 host 服务 + 接管 chat 渲染 + 可拆卸 |
| `…/resources/app.asar`（安装版运行时） | `@deepseek-ai/*` 0.2.1-rc.5、`@deepseek-ai/cordis` 4.0.5 | 唯一权威的框架行为证据 |
| `C:/Users/Lenovo/.dsh/profiles/desktop/package.json` | 现行 profile | 安装面：`link:` 依赖 + `dsh.profile.bundles` |

读 asar 用现成工具，未解包：
`cd "F:/Agent WorkSpace/katya-preset" && node tools/asar.mjs list|cat "<asar>" "<包内路径>"`。

---

## 2. 三个样板的总览

| 维度 | A · dsh-session-archive | B · dsh-usage-dashboard | C · dsh-compact-codex |
|---|---|---|---|
| 源码目录 | `src/`（TS/TSX） | `src/`（纯 JS） | `lib/` 手写 = 产物（无构建） |
| 构建 | `node tools/build.mjs`（esbuild 双产物） | `bash scripts/build.sh`（cp src → lib） | 无（`package.json` 无 build 脚本） |
| host 半边 | `lib/index.js` ESM，导出 `name/inject/Config/apply` | `lib/index.js` → `plugin.js`（守卫式导入） | `lib/index.js` default 导出**服务类**（`extends BasicCompactionEngine`） |
| browser 半边 | `lib/client.js`（esbuild CJS + CSS 内联 + ModuleLoader 外壳） | `lib/client.js`（手写 ModuleLoader CJS） | `lib/client.js`（手写 ModuleLoader CJS） |
| 挂载点 | `settings.section`（一级分区，order 152） | `settings.section`（一级分区，order 180） | `conversation.chat.node`（keyed slot，key=`compact-codex-handoff`） |
| 数据通道 | 同源 HTTP `/api/dsh-session-archive/*` + `ctx.configForms` | 同源 HTTP `/plugins/dsh-usage-dashboard/*` | 无自建路由（读会话事件 + 注入 pre-step） |
| 配置项 | host `Config`（schemastery）+ 6 个 volatile 字段 | patch `config:`（无 schema，纯读 config 对象） | `static Config`（服务类上的 schema） |
| `dsh.client.inject` | 6 个客户端包（renderer/locale/store/connection/ui-settings/api-session-controller） | 1 个（ui-settings） | 1 个（ui-conversation） |
| `immediately` | 无 | 无 | **true** |

---

## 3. 样板 A：dsh-session-archive（要抄就抄它，覆盖最全）

### 3.1 `package.json`（`package.json:1-57`）

```jsonc
{
  "name": "dsh-session-archive",
  "version": "0.1.0",
  "icon": "assets/plugin-icon.svg",          // 插件清单里显示的图标
  "type": "module",
  "main": "lib/index.js",                    // ⚠ loader 只认 main 指向的 host 半边
  "exports": {
    ".":        { "default": "./lib/index.js" },
    "./client": { "default": "./lib/client.js" },   // ⚠ 缺这个子路径 → 组合直接抛错
    "./package.json": "./package.json",
    "./locale/*.json": "./locale/*.json"
  },
  "files": ["lib/", "cordis.patch.yml", "LICENSE", "NOTICE", "README.md"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": ["@deepseek-ai/dsh-api-session-controller", "@deepseek-ai/dsh-client-connection",
                 "@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-store",
                 "@deepseek-ai/dsh-client-ui-renderer", "@deepseek-ai/dsh-client-ui-settings"],
      "platform": "web"
    }
  },
  "scripts": { "build": "node tools/build.mjs", "verify": "node tools/verify-build.mjs", "test": "node --test" },
  "dependencies": { "schemastery": "^3.18.0" },
  "devDependencies": { "esbuild": "0.28.2" }
}
```

要点：
- `dsh.client.platform` **必须是字符串 `"web"`**：client-modules 只把 `platform === "web"` 的条目当浏览器插件（`dsh-client-modules/lib/index.js:732-736`），并且**声明了 `dsh.client` 却没有 `./client` 导出会直接 throw**（同文件 :738）。
- `dsh.client.inject` 是**包名数组**（客户端 row 之间的到达顺序），不是 cordis 服务名；浏览器侧会先把这些 row 的 factory 注册好，再取本包的脚本（`dsh-client-modules/lib/client.js:776-802`）。写错只会让某行「not loaded because dependency … failed」，不会静默。
- `locale/en.json`、`locale/zh.json` 是**插件清单的显示元数据**，不是 UI 字典：形如 `{"meta":{"title":"…","description":"…"}}`（`locale/en.json:1-6`）。

### 3.2 `cordis.patch.yml`（`cordis.patch.yml:13-15`）

```yaml
- insert:
    - id: dsh-session-archive       # 既是 loader 条目 id，也是设置命名空间 id
      name: dsh-session-archive     # 包名 / 路径 / file URL 均可
```

- **`id` 就是设置命名空间**：`dsh-settings` 用 `entry.options.id` 作为 ns（`dsh-settings/lib/index.js:413-440`）。
- patch 语义：按 `id` 命中已有条目时**整体替换 config，不做深合并**；不存在的 id 只打警告；**空文件或纯注释文件会让启动失败**，要禁用就写 `[]`（`dsh-app-boot/README.zh.md:61`）。
- 安装三步（`cordis.patch.yml:4-6` + `README`）：profile 的 `dependencies` 加 `"<pkg>": "link:<绝对路径>"` → `dsh.profile.bundles` 追加包名 → `pnpm install` → 重启 DSH（首次必须重启：loader 树与客户端 bundle 都要重组合）。

### 3.3 host 半边职责（`src/index.ts`、`src/host/*`、`src/mount-once.ts`）

| 职责 | 位置 | 关键写法 |
|---|---|---|
| 插件身份与服务声明 | `src/index.ts:30-31` | `export const name` / `export const inject = ['webServer','workspaceRegistry']` |
| 配置 schema | `src/index.ts:62-69` | `z.object({...})`，每个字段过 `liveField()`；`liveField` 只是写 `meta.volatile = true`（:57-60），因为本地 schemastery 3.18.0 没有 `.volatile()` |
| 解析 volatile 引用 | `src/index.ts:71-95` | volatile 字段在部分 schema 库上解析成 `{get()}` 引用（真值），读之前必须 `plainConfig()` 拆包 |
| 挂载/卸载 | `src/index.ts:97,131-138` | `export const apply = mountOnce(pkg, (ctx, config) => { … ctx.effect(() => { rearm(); return () => cleanup() }) })` |
| HTTP 路由 | `src/host/routes.ts:26,88-100` | 每条 `{ kind: 'exact', path: '/api/<pkg>/…', handler }`，apply 里 `ctx.webServer.register(route)` 收集返回的 disposer |
| 信任栅栏 | `src/host/routes.ts:35-43`、`src/host/loopback.ts:63-92` | 每个请求先查 socket 是否 127/8、Host 是否 loopback、`sec-fetch-site`/`Origin`；不过就 403 |
| 单实例守卫 | `src/mount-once.ts:25,44-54` | 用 `Symbol.for('dsh-web.mounted-plugins')` 全局集合，防止 link 安装与 bundle 安装同时挂载导致重复注册路由/命名空间（重复路由会 throw，见下） |
| 后台服务 | `src/host/janitor.ts`、`src/host/inventory.ts` 等 | 与 HTTP 解耦，纯类，便于单测 |

框架侧对得上的证据：
- `ctx.webServer.register(route)` 返回 disposer，**重复 (kind,path) 会 throw**（`dsh-host-webserver/lib/index.js:326-333`）。
- cordis `inject` 是**硬门**：任一名字解析不到，该 fiber 的 epoch 直接 INACTIVE，`apply` 永不执行（`cordis/lib/index.js:1317-1329`）。这解释了 session-archive 为什么把 `settingsScope` 换成 `configForms`（`src/client/index.ts:41-50` 的注释与 `docs/rebuild/client-configforms-migration.md`）。

### 3.4 browser 半边职责（`src/client/index.ts`）

```ts
export const inject = ['slots', 'locale', 'connection', 'configForms', 'remote', 'sessions']
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), '…: dictionaries')
  const settings = ctx.configForms.get(ARCHIVE_SETTINGS_NS)     // 读写该命名空间
  ctx.effect(() => ctx.configForms.whileServed([NS], () =>
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section', id: 'dsh-session-archive', order: 152,
      label: () => ctx.locale.bind(NS)('arch.title'), locale: NS, inject: face,
    }, GuardedCard))), '…: settings section')
}
```

- `whileServed` 是「host 真的在服务这个命名空间才挂页面」的开关（`dsh-client-ui-settings/lib/client.js:1315-1334`）：host 半边没装 → 整页不出现，而不是出现一个死壳。
- `inject: face` 是**每次渲染时现算的 props 工厂**（这里返回 `{controller, settings}`），不是静态 props。
- `GuardedCard` 是本包自带的 React ErrorBoundary（`src/client/section-guard.tsx:28-50`）：slot 宿主自己捕获异常后只渲染一个空的 `data-slot-error` div，webview 没有 devtools，界面上等于「没数据」。**新插件要自备这一层**。
- UI 组件、store、controller、api client 分文件（`SessionArchiveCard.tsx` / `archive-controller.ts` / `archive-store.ts` / `api.ts`），CSS 用 CSS Modules（`archive.module.css`）。

### 3.5 通信方式（同源 HTTP + configForms）

```ts
// src/client/api.ts:29-43,65-89
const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json' },
  signal: AbortSignal.timeout(timeoutMs) })
```

- 前缀 `/api/dsh-session-archive`（host `routes.ts:26` 与 client `api.ts:66` 各写一份，靠同一个字面量对齐）。
- 批量删除/归档分块（`CHUNK_SIZE = 200`，`archive-controller.ts:16`），单请求超时 30s、批量 300s。
- 读配置不走 HTTP，走 `configForms`（`settings.getSnapshot()/set/mutate`），写回由 dsh-settings 落 profile patch。

### 3.6 构建链（`tools/build.mjs:18-147`）

只用 esbuild，**双产物两套参数**：

| | host | browser |
|---|---|---|
| 入口 | `src/index.ts` | `src/client/index.ts` |
| 产物 | `lib/index.js` | `lib/client.js` |
| format | `esm` | `cjs`（为了 factory 里能同步 `require("react")`） |
| platform/target | `node` / `node22` | `browser` / `es2022` |
| external | `@deepseek-ai/*`, `schemastery`, `node:*` | `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/*` |
| 其它 | `bundle: true` | `jsx:'automatic'`、`loader:{'.module.css':'local-css'}`、`write:false` |

browser 产物是**两层**：先 esbuild 得 CJS + CSS，再由 `wrapClient()`（:78-94）套上
`window.__ModuleLoader__.load({ id: "<包名>", factory: (require) => { …; return module.exports } })`，
CSS 由 `cssInjection()`（:57-76）变成一段 `<style data-plugin-css>` 注入代码放在 factory 顶部。

为什么非要这层壳：`dsh-client-modules` 在 factories 里找不到该 id 会直接抛
`bundle <url> loaded without registering "<id>" via __ModuleLoader__.load`（`lib/client.js:874`）。
产物的导出表就是 `{ apply, inject }`（`lib/client.js:33-39`），`name` 可省（row id 就是名字）。

---

## 4. 样板 B：dsh-usage-dashboard（最小成本路线）

- `package.json:9-23`：`exports` 用简写形式（`"./client": "./lib/client.js"`），`dsh.client` 只有 `{ platform:'web', inject:['@deepseek-ai/dsh-client-ui-settings'] }`；**没有 dependencies**（零第三方依赖，SQLite 用 `node:sqlite`）。
- `cordis.patch.yml:9-26`：insert 行里直接写 `config:`（`defaultRange: 365d`，其余注释掉作说明）。**没有 schema**，host 侧读原始对象（`src/api.js:39-57`），非法值逐个兜底 —— 这条路牺牲「设置页自动表单」，换取不用维护 schema。
- host：`src/index.js:1-26` 是**守卫式入口**（`await import('./plugin.js')` 失败就退化成空插件并打印修复提示，避免拖垮整个插件树），`src/plugin.js:80-164` 注册 3 条路由 + 订阅 `ctx.on('session/event')` + `ctx.effect` 统一释放；路由注册兼容两种形态（`ctx.inject(['webServer'], …)` 与直接 `ctx.webServer.register`，:131-145）。
- browser：`src/client.js:8-9` 自己写 ModuleLoader 外壳（**先判 `window` 存在**，因为同一份文件在 Node 单测里会被 import），`requestJson()` 用 `fetch(..., { cache:'no-store' })` 并区分「连不上」(`unavailable`) 与「接口报错」（:272-299）。
- 设置页注册最简形态（`src/client.js:1233-1257`）：只用 `ctx.slots.inject('settings.section', …)` + `register({name,id,order,label}, Component)`，不接 locale、不接 configForms。
- 构建：`scripts/build.sh:1-12` —— `rm -rf lib; cp -R src/. lib/` 然后逐个 `node --check`。契约写在 `docs/CONTRACTS-v2.md §0`：「`src/` 是源，`lib/` 是构建产物，不要手写」。
- 面板数据在 host 侧聚合好，浏览器只读一个只读端点（`src/client.js:1-5`）：**host 升级时页面不用重打包**，这是它能手写 client 而不被上游接口拖累的原因。

---

## 5. 样板 C：`.ref-dsh-compact-codex`（同时改 host 服务与 browser UI，且可拆卸）

这是和我们目标最接近的结构：host 侧替换一个既有服务，browser 侧接管 chat 的一段渲染，两者都挂在同一个包上。

### 5.1 三处声明

```jsonc
// package.json:14-25
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web", "immediately": true,
              "inject": ["@deepseek-ai/dsh-client-ui-conversation"] }
}
```

```yaml
# cordis.patch.yml
- id: preset-standard            # :12-15（每个 preset 行整体重述 config）
  name: '@deepseek-ai/dsh-agent-preset'
  config: { … }
  #   :77-78  group 内 compaction 后端那一行改成 name: 'dsh-compact-codex'
- insert:                        # :529-531
    - id: compact-codex-client-anchor
      name: 'dsh-compact-codex'
```

- **为什么要那一行 `insert`**：客户端扫描是按 **loader 条目**做的，包名必须在图里，`dsh.client` 才会被组合成浏览器 bundle（注释原文 `cordis.patch.yml:527`）。它同时是 host 插件的一个正常挂载点。
- **`immediately: true` 与普通插件差在哪**：普通行等到自己的 loader 条目启动时才去取脚本文本；immediate 行在外壳启动应用条目前就被 `prefetch` 一遍（`prefetchImmediateTier()`），所以「首屏就要接管渲染」的插件用它换更早的到达。对照：官方自己用 immediate 的都是启动路径上的基座包（`@deepseek-ai/dsh-client-modules`、`@deepseek-ai/dsh-client-ui-renderer`、`@deepseek-ai/dsh-client-locale` 的 `dsh.client.immediately: true`）。
- **为什么 preset 要整份重述**：loader 的 patch 按 id 整体替换 config，而 preset 行的 `config` 是对象 `{id, plugins}`、且不是 group，**任何 patch 层都无法按 id 命中它内部的 `compaction-basic` 行**（`docs/internals.md:5-15`）。所以它用生成器 `sync-presets.mjs` 搬整份 config，只改一行模块名 —— 这也是 dsh 升级后必须重跑生成器的原因。

### 5.2 host 半边：用「服务类」替换服务

```js
// lib/index.js:1451-1452,1459-1498,1500-1512,1613
var CodexCompactionEngine = class extends BasicCompactionEngine {
  static inject = ['llm', 'tokenMeter', 'sessions']
  static Config = z.object({ style: z.string(), handoffTokens: z.number(), … })  // ⚠ 必须自己声明
  constructor(ctx, config = {}) {
    const { style, handoffTokens, … , ...baseConfig } = config   // 自有字段先摘掉，基类不认未知键
    super(ctx, baseConfig)
    …
  }
}
export { CodexCompactionEngine, CodexCompactionEngine as default }
```

要点（都写进了 `docs/internals.md:76-84`）：
- `Config` **不能沿用基类的**：schemastery 会剥掉未声明字段，Cordis 兼容性准入也按这份声明校验。
- **服务实例会被包成 Proxy**，子类里用 `this.#私有方法` 会在运行期抛 `Receiver must be an instance…` → 辅助逻辑一律写成模块级函数、显式传参。
- `tools` 这类不保证就绪的服务用动态 `ctx.inject(['tools'], …)` 等它可用再注册，失败只打日志。
- 卸载 = 从 `dsh.profile.bundles` 移除 + `install` + 重启；官方 `compaction-basic` 原样恢复（`README.md:183-185`）。**不改任何官方文件**是它「可拆卸」的全部代价。

### 5.3 browser 半边：接管 chat 的一段渲染

```js
// lib/client.js:201-222
const inject = ['slots', 'uiConversation']
function apply(ctx) {
  ctx.effect(() => { /* 注入 <style data-plugin>，返回 () => tag.remove() */ })
  ctx.uiConversation.events.register(handoffDefinition)          // 事件定义（match/start/update/buildViewNode）
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: NODE_KIND                // keyed slot：key 就是 renderer key
  }, HandoffView))
}
exports.name = 'dsh-compact-codex'; exports.inject = inject; exports.apply = apply
```

框架侧核对（全部在安装版 asar 里验证过）：

| 事实 | 证据 |
|---|---|
| `conversation.chat.node` 是 **keyed / scope:session** 的第三级 slot，挂在 `conversation.chat.flow` 下 | `dsh-client-ui-chat/lib/client.js:13239-13247` |
| 官方节点也是同一套注册法：`{ name, key: 'user' \| 'steering' \| 'context' \| … , locale }` | `dsh-client-ui-chat/lib/client.js:7216-7240`，共 15 个左右 |
| `ctx.uiConversation.events.register(definition)` 是服务 API（重复 kind 会明确报「already registered」） | `dsh-client-ui-conversation/lib/client.js:3356-3360`，服务本体 :4041-4043 |
| 第三方插件注册进 `conversation.chat.node` 的现成例子还有 `dsh-client-ui-goal`、`dsh-client-ui-tool`、`dsh-client-ui-user-questions` | 各自 `lib/client.js`（grep `conversation.chat.node`） |
| `immediately: true` = 启动前预取脚本文本（factory 先注册、模块体仍惰性），不是提前激活 | shell `dist/assets/index-*.js` 的 `prefetchImmediateTier()`；`dsh-client-modules/lib/index.js:398-410` 把 flag 带进图 row |
| 平台基座模块表（可 `require` 的白名单） | shell `dist/assets/index-*.js`：`{react, react/jsx-runtime, react-dom, react-dom/client, @deepseek-ai/cordis, zod, @tanstack/react-virtual, @deepseek-ai/dsh-client-store, @deepseek-ai/dsh-client-ui-slots, @deepseek-ai/dsh-client-ui-primitives, @deepseek-ai/dsh-client-ui-dockkit}`；基座之外的精确请求走 `dsh.client.external` |
| 组件抛错会让该 slot 条目变成**空壳/被清空** —— 界面上等于「没有数据」 | compact-codex `lib/client.js:12-15`（「抛错的组件会清空整个 slot 条目」）；session-archive `src/client/section-guard.tsx:1-13`（slot 宿主只渲染一个空的 `data-slot-error` div）；两者的对策都是自带 ErrorBoundary |

它的两条自定纪律值得照抄：**除 React 基座外不 `require` 任何 `dsh-client-*` 包**（纯 JS 插件没有类型检查，上游改名就是运行期崩），**factory 内不产生副作用**（样式注入放 `apply` 里由 `ctx.effect` 管）。

### 5.4 与样板 A 的差异点（一张表看清）

| 维度 | A（session-archive） | C（compact-codex） |
|---|---|---|
| 与官方的耦合方式 | **只加不改**：新增设置分区 + 自己的路由，官方代码一行不动 | **替换 + 接管**：preset 里换掉服务实现、接管 chat 节点渲染 |
| 插件在 profile 里的形态 | 自己的 bundle + 一行 `insert` | 自己的 bundle + 一行 `insert`（客户端锚点）+ **若干条 preset 覆盖** |
| 卸载后果 | 删行即消失，无残留 | 删 bundle 行即可，preset 覆盖随 bundle 层一起消失；官方后端原样恢复 |
| 谁来保证「可拆卸」 | 天然：只挂新表面 | 靠「整份重述、只换一行」+ 卸载说明；**不 fork、不 patch 官方文件** |
| 数据面 | host 建 HTTP 面，browser 拉 | host 直接注入会话事件（`agent/pre-step`）+ 写会话日志；browser 只读事件流 |
| 配置声明位置 | 模块级 `export const Config` | 服务类的 `static Config` |
| 构建 | esbuild 双产物 | 无构建，手写产物 |
| 失败面 | section 崩溃 → 空白（需自带 boundary） | 组件崩溃 → 该 slot 条目被清空；服务构造抛错 → 该 preset 启动失败 |

---

## 6. 设置项怎么注册进「设置」页面

### 6.1 三条挂点（都是 slot，靠 `ctx.slots.register`）

| slot 名 | 形态 | 语义 | 样板 |
|---|---|---|---|
| `settings.section` | list, root | 设置页**左侧一级分区**（与官方「通用/插件/模型」同级） | session-archive（order 152）、usage-dashboard（order 180） |
| `settings.general.item` | list, root | 通用设置页里**一行**（官方自带开关都挂这里） | 官方最干净的样板是 `dsh-client-ui-settings-session-log/lib/client.js:146-170`；它由通用设置页在 `children` 里声明（`dsh-client-ui-settings-general/lib/client.js:1305-1307`：`{ "settings.general.item": { kind:"list", scope:"root" } }`）。session-archive 没用这条，它自己开一个一级分区 |
| `settings.plugins.tab` | list | 「设置 → 插件」里的一页（官方插件清单就用它） | `dsh-client-ui-settings-plugin-inventory/lib/client.js:757-763` |

`register()` 的可选字段（keyed slot 用 `key`）：`name`(必填) / `id` / `key` / `order` / `priority` / `label`(导航标题函数) / `locale`(字典 ns) / `inject`(渲染时现算 props) / `children`(再声明子 slot) / `store`（`dsh-client-ui-renderer/lib/client.js:1603-1615,1813-1816`；`SlotMap` 在 `dsh-client-ui-settings-general/lib/client.js:1244-1270`）。

### 6.2 配置 schema 的两条路径

**路径 1（推荐给要自定义页面的插件）——host 出 schema，页面自己画：**

1. host：`export const Config = z.object({ … })`，**每个要出现在表单里的字段打 `meta.volatile`**。
2. 为什么必须 volatile：`dsh-settings.describe()` 里 `const form = volatileForm(schema); if (form === undefined) return []` —— 没有 volatile 字段的命名空间**根本不出现在服务列表里**（`dsh-settings/lib/index.js:118-134, 413-440`）。schema 的来源是 `entry.fiber.runtime.Config`（同文件 :538-541），也就是 host 模块类/静态上的 `Config`。
3. 命名空间 id = patch 行 `id`（同文件 :413-440 用 `entry.options.id`）。
4. browser：`ctx.configForms.get(ns)` → `{ getSnapshot(), set(field,value), mutate(ops, rev), unset(field) }`，写入经 `ctx.remote.settings.mutate(ns, ops, rev)` 并带 revision 冲突检测（`dsh-client-ui-settings/lib/client.js:1153-1210` 的 mutate/unset/getSnapshot；`get(entryId)` 在 :1294）。
5. 想「host 没装就不显示页面」：`ctx.configForms.whileServed([ns], register)`（同文件 :1315-1334）。

**路径 2（自动表单）——什么都不用写：** 只要 host 的 `Config` 有 volatile 字段，dsh-settings 自己的机械表单就能编辑它（默认 `autoGenerate: true`）。插件自带页面时建议显式关掉，避免同一配置出现两套 UI：在 `apply` 里可选的 `ctx.inject(['settings'], …)` 子级内以 effect 注册 `configure({ auto: false }, ctx.fiber)`（`dsh-settings/README.zh.md`「使用此包」节）。

### 6.3 官方最小完整例子（比两个样板更干净，建议直接抄结构）

`dsh-client-ui-settings-session-log/lib/client.js:135-170`：

```js
const inject = ['slots', 'locale', 'configForms']
function apply(ctx) {
  const locale = 'settings.sessionLog'
  const namespace = 'session-log-deepseek'
  ctx.effect(() => ctx.locale.register(locale, { en, zh }))
  const form = ctx.configForms.get(namespace)
  const face = () => ({ hooks: { upload: form, mutation: … }, setEnabled: (v) => … })
  ctx.effect(() => ctx.configForms.whileServed([namespace], () => ctx.slots.inject('settings.general.item',
    () => ctx.slots.register({ name: 'settings.general.item', id: namespace, order: 90, locale, inject: face },
      UploadRow))))
}
```

注意它的 host 半边可以**是空插件**（`lib/index.js:1-6` 只有 `function apply() {}`）：命名空间由**另一个包**提供，本包只负责画 UI。这条对我们是现成的分工依据。

---

## 7. 可复制骨架（推荐目录 + 每文件职责）

```text
dsh-katya-workflow/
├── package.json                 ① 包身份 + dsh 两段声明
├── cordis.patch.yml             ② 挂载行（host 半边 + 客户端锚点）
├── README.md                    ③ 安装/卸载/配置/已知限制
├── LICENSE
├── assets/plugin-icon.svg       ④ 插件清单图标（package.json.icon）
├── locale/{en,zh}.json          ⑤ {"meta":{"title","description"}} —— 清单显示名
├── src/
│   ├── index.ts                 ⑥ host 入口：name / inject / Config / apply（唯一导出面）
│   ├── core/config.ts           ⑦ 纯逻辑：类型、默认值、校验（host/browser 共用，无副作用）
│   ├── host/routes.ts           ⑧ WebRoute 列表 + 信任栅栏 + 错误码
│   ├── host/service.ts          ⑨ 业务服务类（与 HTTP 解耦，可单测）
│   └── client/
│       ├── index.ts             ⑩ browser 入口：inject / apply（locale、slot 注册、configForms）
│       ├── api.ts               ⑪ 同源 fetch 封装（超时、错误分类、no-store）
│       ├── Panel.tsx            ⑫ 设置页正文（无状态或薄状态）
│       ├── boundary.tsx         ⑬ React 错误边界（slot 崩溃不留空白）
│       ├── locales.ts           ⑭ zh/en 字典（zh 为键源，en 键集对齐）
│       └── panel.module.css     ⑮ 样式（只用 --dsw-alias-* / --dsh-content-* 主题变量）
├── tools/build.mjs              ⑯ esbuild 双产物 + ModuleLoader 外壳 + CSS 内联
├── test/*.test.js               ⑰ node --test，纯逻辑与服务层
└── lib/                         ⑱ 构建产物（index.js + client.js），不手写
```

每份文件写什么：

| # | 文件 | 职责与硬约束 |
|---|---|---|
| ① | `package.json` | `main: lib/index.js`；`exports: {".":"lib/index.js", "./client":"lib/client.js", "./package.json", "./locale/*.json"}`；`dsh.bundle.patch`；`dsh.client = {platform:"web", inject:[…客户端包名], external?:[…], immediately?:true}`；`files` 至少含 `lib/` 与 `cordis.patch.yml` |
| ② | `cordis.patch.yml` | `- insert: [{ id: <pkg>, name: <pkg>, config?: … }]`；**id 与包名一致的命名空间约定**；空文件要用 `[]` |
| ③ | 文档 | 安装三步、配置表、卸载步骤、已知限制 |
| ④ | 图标 | `package.json.icon` 指向，SVG |
| ⑤ | locale json | 仅 `meta.title/description`，给插件清单用；**UI 文案不在这里** |
| ⑥ | host 入口 | `export const name` + `export const inject = ['webServer', …]` + `export const Config` + `export const apply`；`apply` 里一切注册都包进 `ctx.effect` 并返回 disposer；需要单实例就上 `Symbol.for` 守卫 |
| ⑦ | 配置纯逻辑 | 默认值/范围校验/resolve，host 与 browser 共用一份，保证两端行为一致 |
| ⑧ | 路由 | 每条 `{kind:'exact'|'prefix', path, handler}`；handler 首行过栅栏（loopback + Host + sec-fetch-site/Origin）；统一 JSON 错误形状 |
| ⑨ | 服务 | 构造函数拿 `(ctx, config)`，不读全局；状态与并发语义写清（幂等/节流/取消） |
| ⑩ | browser 入口 | `export const inject = ['slots','locale','configForms', …]`（**必须列全，缺一个 apply 不执行**）；`export function apply(ctx)`；导出 `{name, inject, apply}` 或只 `{apply, inject}` |
| ⑪ | api.ts | `fetch(url, {cache:'no-store', signal: AbortSignal.timeout(ms)})`；区分「连不上」「HTTP 错」「非 JSON」三类 |
| ⑫ | 面板组件 | 只读数据 + 回调，不在渲染里 fetch；loading/empty/error 四态齐全 |
| ⑬ | 边界 | `getDerivedStateFromError` 把崩溃渲染成可读文字 + `error.stack` |
| ⑭ | 字典 | `ctx.locale.register(ns, {zh, en})`；`ctx.locale.bind(ns)` 取 `t`；slot 注册时 `locale: ns` 让导航标题也走字典 |
| ⑮ | 样式 | 只用 `--dsw-alias-*` 等主题变量；要跟着主题变就别写死颜色 |
| ⑯ | build.mjs | 见 §3.6；产物二是 `window.__ModuleLoader__.load({id:<包名>, factory})` 壳；改完跑一次 `node tools/build.mjs` |
| ⑰ | 测试 | host 服务/纯逻辑用 `node --test`；不碰真实 `~/.dsh`（内存库/临时目录） |
| ⑱ | lib/ | 只由构建生成；提交与否看部署方式，**绝不手改**（session-archive 的 `lib/` 就是产物） |

**最小变体（不想引入 TS/esbuild）**：照样板 B/C —— `lib/index.js` 与 `lib/client.js` 手写，`scripts/build.sh` 只做 `cp src → lib` + `node --check`。代价：没有类型护栏，改上游耦合点时要更小心；收益：没有构建链要维护。

**骨架里的生命周期清单（漏一条就白装）：**
1. `cordis.patch.yml` 有 insert 行 → 2. profile `dependencies` 有 `link:` → 3. `dsh.profile.bundles` 有包名 → 4. `pnpm install` → 5. 重启 DSH → 6. `lib/client.js` 已构建且注册 id 等于包名 → 7. `dsh.client.platform === "web"` 且 `./client` 导出存在 → 8. browser `inject` 列全 → 9. 卸载时反向执行 1-3（+ `pnpm install` + 重启）。

---

## 8. 对我们（dsh-katya-workflow）的落地建议

- **形态选 C 的骨架 + A 的构建链**：host 侧如果只是「读设置、算策略、可能注入一点上下文」，按 A 写（`Config` + `apply` + 可选路由）；browser 侧要接管 chat 的步骤渲染，就必须用 C 的 `conversation.chat.node` 路线，而且**必须有 host 行**（否则客户端 bundle 不会进启动图）。
- **`immediately: true` 建议照 C 打开**：它让我们的 bundle 在应用条目前先到，适合「首屏就要接管渲染」的插件；它不是激活开关，不会因此提前执行模块体。
- **设置项建议走 A 的形态**：`settings.section` 一级分区（我们这两档是展示策略，用户会反复调），字段全部 volatile；页面上读写用 `configForms.get(ns)`，host 没装则整页不显示（`whileServed`）。
- **必须自带错误边界**：接管 chat 渲染比设置页更致命——组件抛错 == 那段对话消失。
- **不要 value-import 其它 `dsh-client-*` 包**：基座表里只有 11 个 specifier（§5.3）；跨插件协作一律走 cordis 服务（`ctx.sessions` / `ctx.uiConversation` / `ctx.configForms` …）。

**仍未验证（留给 task-1 / task-2，别当结论用）：**
- 用**官方已有 key**（如 turn/step 那类）注册 `conversation.chat.node` 是「替换」还是「并存/覆盖顺序」——本机没有这样的先例（C 用的是全新 key），keyed slot 的同 key 语义要现读 `SlotCore`。
- `settings.section` 的 `inject` props 在 session-archive 里是 `(props) => …` 走 slot；usage-dashboard 不用 `inject` 也能工作（`src/client.js:1237-1242`），说明官方 node 是可选路径，但**两种写法在 keyed slot 上的差异**未验证。
- `configForms.get()` 是否必须把 `remote` 写进 browser `inject`：官方 session-log 只写 `['slots','locale','configForms']`，session-archive 写了 `remote` —— 两者都能跑，说明至少不会因为多写而失败；少写是否依赖 provider 的 fiber 未验证。
- 0.2.2-alpha.2 源码树里 `conversation.chat.node` / `settings.*` 是否漂移（本文件所有框架结论取自安装版 0.2.1-rc.5）。

---

## 9. 事实索引（哪句话出自哪一行）

| 结论 | 证据 |
|---|---|
| 插件包形态：`main` + `./client` + `dsh.bundle.patch` + `dsh.client` | `dsh-session-archive/package.json:8-44`；`dsh-usage-dashboard/package.json:9-23`；`.ref-dsh-compact-codex/package.json:7-25` |
| patch 挂载行 | 三者各自 `cordis.patch.yml` |
| 命名空间 = patch 行 id | `dsh-settings/lib/index.js:413-440` |
| 只有 volatile 字段出现在设置服务里 | `dsh-settings/lib/index.js:118-134, 418-419` |
| schema 来自插件的 `Config` | `dsh-settings/lib/index.js:538-541` |
| `configForms.get/whileServed` | `dsh-client-ui-settings/lib/client.js:1294-1334` |
| `settings.section` 等 slot 名单 | `dsh-client-ui-settings-general/lib/client.js:1244-1270` |
| slot register 选项（含 keyed `key`） | `dsh-client-ui-renderer/lib/client.js:1603-1615, 1813-1816`；`dsh-client-ui-chat/lib/client.js:7216-7240` |
| `conversation.chat.node` = keyed/session | `dsh-client-ui-chat/lib/client.js:13239-13247` |
| `uiConversation.events.register` | `dsh-client-ui-conversation/lib/client.js:3356-3360, 4041-4043` |
| ModuleLoader 注册契约 + id 校验 | `dsh-client-modules/lib/client.js:695-700, 874` |
| `dsh.client` 字段解析 | `dsh-client-modules/lib/index.js:64-74` |
| 只收 `platform === "web"`、必须有 `./client` | `dsh-client-modules/lib/index.js:732-738` |
| `inject` 行先到达 | `dsh-client-modules/lib/client.js:776-802` |
| `immediately` 预取时机 | shell `dist/assets/index-*.js` `prefetchImmediateTier()`；`dsh-client-modules/lib/index.js:398-410` |
| 平台基座模块表 | shell `dist/assets/index-*.js` 的 `staticModules` 字面量 |
| webServer 路由注册/重复 throw | `dsh-host-webserver/lib/index.js:326-333` |
| cordis inject 硬门 | `cordis/lib/index.js:1317-1329` |
| locale register/bind | `dsh-client-locale/lib/client.js:1387-1420` |
| 构建脚本双产物 | `dsh-session-archive/tools/build.mjs:18-147` |
| 复制式构建 | `dsh-usage-dashboard/scripts/build.sh:1-12` + `docs/CONTRACTS-v2.md §0` |
| 服务类替换 + 卸载回落 | `.ref-dsh-compact-codex/lib/index.js:1451-1512, 1613`；`docs/internals.md:5-15`；`README.md:183-185` |
| preset 整份重述的原因 | `.ref-dsh-compact-codex/docs/internals.md:5-15` |
| 手写 client 的两条纪律 | `.ref-dsh-compact-codex/docs/how-it-works.md:59-64`；`lib/client.js:12-15` |
| 安装/卸载三步 | `.ref-dsh-compact-codex/README.md:33-56, 183-185`；`dsh-session-archive/cordis.patch.yml:4-6` |
| 现行 profile 的安装面 | `C:/Users/Lenovo/.dsh/profiles/desktop/package.json`（dependencies + `dsh.profile.bundles` 均列了这三个包） |
