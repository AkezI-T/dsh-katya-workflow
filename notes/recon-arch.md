# 外部 client 插件接管 Chat 步骤渲染：机制与可行性（调研）

> 只读调研，未改任何既有文件。所有结论都指向可复查的源码/文档位置；查不到的项在第 6 节明说。

## 0. 结论摘要（先看这段）

1. **能不 fork 就替换，但只能"顶替某一格"，不能"包裹"原生。** Chat 的每个节点行都挂在 keyed slot `conversation.chat.node` 上，由 chat 自己按节点 kind 注册渲染器；外部插件用**更小的 priority** 注册同一个 key，就成为该 key 的胜者，原生条目仍在账本里。卸载/禁用后条目被移除，胜者自动回到原生 —— 回落是机制保证的，不需要额外代码。
2. **粒度有三档，最细到"单个工具调用行"：**
   - 整段 transcript：`conversation.chat.flow`（single）；
   - 单类节点行：`conversation.chat.node`，key ∈ 固定的 ChatNodeKind 表（`assistant-step`、`tool-call`、`turn-process`、`turn-tail` …）；
   - 单行工具调用：`tool.call.toolview`，key = 工具名（wire Tool name），例如只接管 `bash` 或 `run_code` 的行。
3. **接管不了的部分同样明确：** 步骤分组、过程组头、整轮折叠、行可见性判定都不在 slot 体系里，位于 `ChatNodeSeat`/`ChatGroupSeat` 内部；控制档位的 4 个策略字段也只被这几个内部组件消费。
4. **对"第五档"的直接含义：** 若新档只改变**行内内容**（每行显示更多参数/耗时/结果），外部插件可按 key 接管 `assistant-step`/`tool-call` 自己实现；若新档要改**分组、折叠、组头、可见性**（介于 detailed 与 verbose 之间的档位必然涉及这些），纯外部插件做不到，必须 fork `dsh-client-ui-chat`。
5. **为什么不能包裹：** 这三个 slot 都不是 `chain`；chat 的 `/client` 入口只导出 `apply/inject/isRunningTool/isSettledTool/EMPTY_CHAT_SNAPSHOT`，不导出任何节点组件；且 `assistant-step` 的 child slot（`conversation.chat.reasoning.body` 等）已被原生条目声明占有，影子条目再声明会在激活时报错。

## 1. 版本与证据来源

| 记号 | 位置 | 版本 | 用途 |
|---|---|---|---|
| `<src>` | `F:/Agent WorkSpace/DeepSeekHarnessWorkspace/dsh-0.2.2-alpha2-breaking-audit/_src/deepseek-harness-dsh-v0.2.2-alpha.2` | 0.2.2-alpha.2 | **权威**：可读源码 + 子系统文档 + 生成 catalog |
| `<asar>` | `F:/Users/Lenovo/AppData/Local/Programs/DeepSeek Harness/resources/app.asar`（包内路径 `dsh/node_modules/@deepseek-ai/...`） | 0.2.1-rc.5（本机安装版） | 交叉验证：确认机制在已装运行时同样存在 |

读取方式（只读，用现成工具，不解包）：

```bash
cd "F:/Agent WorkSpace/katya-preset" && node tools/asar.mjs list "<asar>" "<正则>"
cd "F:/Agent WorkSpace/katya-preset" && node tools/asar.mjs cat  "<asar>" "<包内路径>" | sed -n 'A,Bp'
```

两个版本在本任务关心的机制上一致（`conversation.chat.node` 的 keyed 分派、各注册点、`tool-call` 由 ui-tool 提供、`entryKey: routedNode.kind` 都逐点核对过）。差异集中在 chat 的设置字段（0.2.2 新增 `foldedReplies`），详见同目录 `recon-spec.md` §1.1；本文不重复。

## 2. DSH 浏览器插件的注册模型

### 2.1 `package.json` 的 `dsh.client` 语义

最小例子 `@deepseek-ai/dsh-client-ui-agent-preset` 的 node 半侧只有 422B，文件头注释就是模型说明（`<asar>:dsh/node_modules/@deepseek-ai/dsh-client-ui-agent-preset/lib/index.js`）：

```js
/**
 * Agent-preset surface plugin, node half. The empty apply exists so the plugin
 * appears in the host cordis.yml / Loader; the browser half ships the
 * General-settings row through exports["./client"], discovered from the
 * package.json dsh.client declaration.
 */
function apply() {}
```

即：**一个包两个半边**。宿主半边是 Loader 里的一行（`apply` 可以为空，也可以挂 Host service）；浏览器半边是 `exports["./client"]` 指向的 `lib/client.js`，由 `dsh.client` 声明发现，不需要手工接线。

字段语义（权威：`<src>/packages/client/AGENTS.md`「New plugin package checklist」第 3 条；实现：`<asar>:dsh-client-modules/lib/index.js:40-75, 728-750`）：

| 字段 | 语义 | 证据 |
|---|---|---|
| `platform: 'web'` | 必填字符串；不等于 `web` 的行被静默跳过（不进浏览器图） | `<asar>` client-modules:733 —— 非 `web` 直接 `return null` |
| 存在 `dsh.client` | 必须同时有 `./client` export，否则扫描直接抛错 | 同上 :738 `declares dsh.client but exports no "./client" bundle` |
| `inject` | **信息性**的包名依赖边：会写进 boot 图行、供预检展示与 HMR diff 用；**不参与激活排序**（激活顺序由 Cordis service inject 决定） | `<asar>` client-modules:407, 743 只透传；排序函数 `orderByModuleGraph` 只读 `external`（:414-440） |
| `external` | 模块图边：声明"基座表之外、需要先于本包物化"的精确 specifier。只有它会排序 | 同上；且自请求/环会抛错 |
| `immediately` | 仅基础设施行（stage-one 预取）使用，例如 `dsh-client-modules`、`dsh-client-ui-renderer` | 两者 package.json 都写 `immediately: true` |

注意区分**两个 inject**（`<src>/packages/client/AGENTS.md`「The module graph sits below cordis DI」对照表）：

- `package.json` 的 `dsh.client.inject` = 包名边，信息性；
- 模块导出的 `export const inject = ['slots', ...]` = Cordis service 名，**决定激活**，缺一个就一直 PENDING；
- `dsh.client.external` = 模块 specifier 边，决定同步 `require` 能否物化，唯一参与排序。

### 2.2 client 入口如何被加载

链路（权威：`<src>/docs/subsystems/web-client.zh.md:22-26`，细节：`<src>/packages/client/modules/README.zh.md`）：

1. **宿主半侧扫描** Loader 已启用条目 → 读各自 package.json `dsh.client` → 解析 `./client` 产物路径 → 快照文件（`<asar>` client-modules `ClientModuleRegistry`，:105-130 的文件头注释）。
2. **组合启动图**：把每份声明变成 bundle，经 `/plugins/??...&rev=...` combo 路由提供（`<asar>` client-modules:202 `PLUGIN_ROUTE = "/plugins"`），并作为 index 注入写进 `window.__DSH_BOOT__`（同文件 :501 名字就出现在这里）。
3. **浏览器半侧**：`dsh-client-modules` 的浏览器半边是**惰性 CJS 模块表**。执行 bundle 只注册 factory；materialize 时才跑 factory（`factory(require) → 导出`），CSS 注入等副作用全在 factory 闭包里。
4. 启动内核预取 `immediately` 行、挂 vendored Cordis Loader、按图建 entry；**Cordis service inject 决定激活顺序**，模块图只决定 import 能否同步物化。
5. 名册 settled 后，`ui-renderer` hydrate boot DOM 并调用全程序唯一一次 `renderSlot('root', {})`。
6. 动态组合：启用/停用插件会改 Loader 条目，停用后在其异步 effect 清理完成后回收未用模块与样式；HMR 通过 `rebuilt()` 换行（`<src>/packages/client/modules/README.zh.md`「插件动态组合」；清理逻辑 `<src>/packages/client/modules/src/client/entry-lifecycle.ts:9-27`）。

**共享身份**：React、React DOM、Cordis、ui-slots、ui-primitives 是外壳静态模块表里的同一份身份；动态 bundle 的裸 import 按 `PLATFORM_MODULES` 解析，基座之外的才写 `dsh.client.external`。这解释了为什么两个插件里的 `ctx.slots` 是同一个注册表。

本机实例佐证：`F:/Agent WorkSpace/DeepSeekHarnessWorkspace/dsh-session-archive/package.json` 就是标准外部插件形状（`dsh.bundle.patch` + `dsh.client.{inject,platform}` + `exports["./client"]`），其 `src/client/index.ts:96-98` 已用 `ctx.slots.inject('settings.section', () => ctx.slots.register(...))`。

## 3. slot / Factory / Node 注册 API

### 3.1 注册面（`<src>/docs/subsystems/slots.zh.md` + `<src>/packages/client/ui-slots/src/index.ts`）

`ctx.slots.register(options, Component)` 返回 disposer（受 `ctx.effect` 生命周期），`options` 关键项：

- `name`：目标 slot key（必须已被某条目在 `children` 里声明，否则加载即抛）；
- `key`（keyed 必填）/ `id`（list 必填）/ `order`（list 排序）；
- `priority`：**遮蔽优先级**（single/list/keyed）或**选举顺序**（chain）；升序，数值越小越先渲染/运行（slots.zh.md:66）；
- `children`：声明 + 渲染授权 —— 组件能渲染的子 slot 恰好是这里的 key；声明别的条目已拥有的 child 会在激活时失败（slots.zh.md:21）；
- `inject`：注册项私有业务面（返回数据与回调；只有 `hooks` 隔层可放裸 observable）；
- `store` / `locale` / `label`。

四种 cardinality：`single`（一格，priority 胜者）、`list`（按 id+order，可增量）、`keyed`（owner 每次渲染传 `entryKey` 分派）、`chain`（每项提供纯 `select(owner)`，第一个非 null 获选）。scope：`root` / `session` / `session-maybe`。

**向别人拥有的位置贡献内容**的正确姿势是 `ctx.slots.inject(key, () => ctx.slots.register(...))`：等声明真正存在才注册，owner 折叠时贡献随之移除，owner 重挂时重跑（slots.zh.md:25；`<src>/packages/client/AGENTS.md` 第 4 条）。

### 3.2 注册示例

官方最小写法（`<asar>:dsh-client-ui-agent-preset/lib/client.js:2490-2498`）：

```js
ctx.slots.inject("settings.section", () => ctx.slots.register({
  name: "settings.section",
  id: "agent-presets",
  order: 20,
  label: () => ctx.locale.bind("settings.agentPreset")("nav"),
  locale: "settings.agentPreset",
  inject: sectionInjected
}, AgentPresetSection));
```

chat 自己的节点注册（`<src>/packages/client/ui-chat/src/client/chat/register-node-renderers.ts:26-95`（`assistant-step` 在 :55-64）；安装版同构于 `<asar>:.../dsh-client-ui-chat/lib/client.js:7214-7320`）：

```ts
ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
  name: 'conversation.chat.node',
  key: 'assistant-step',
  locale: NS,
  children: {
    'conversation.chat.reasoning.body': { kind: 'single', scope: 'session' },
    'conversation.chat.message.images': { kind: 'single', scope: 'session' },
  },
  inject: () => ({ hooks: { presentation } }),   // 只有 chat 自己能拿到这个策略源
}, AssistantNodeView))
```

### 3.3 `conversation.chat.node` 与座位（seat）

- 声明：`<src>/packages/client/ui-chat/src/client/contract/slots.ts:427-439` —— `kind: 'keyed'`、scope `session`、`keyProps: { [Kind in ChatNodeKind]: { node: ChatNode<Kind> } }`、slot 级 inject `ChatNodeInjected`（`turnData`/`disclosure`/`groupAction`）。注释原文：*"Reusing a key replaces that node renderer; a kind with no occupant renders no row."*
- 分派：`<src>/packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx:167-177` 调 `renderSlot('conversation.chat.node', routedOwner, { entryKey: routedNode.kind, hookContext, fallback: <JsonBlock .../> })`；座位自己在外层 `div` 上挂了折叠/可见性（`processHidden`）、`data-chat-*` 锚点、motion。
- 渲染器选择：`<src>/packages/client/ui-renderer/src/client/scoped-slots.tsx:1184-1191` —— `entriesOfSlot(key).find(e => e.options.key === entryKey)`。
- 胜者投影：`<src>/packages/client/ui-slots/src/index.ts:1356-1372` —— 每个 cell 取**优先级最低的存活条目**；`:1138-1144` 明确"同 cell 不同 priority 可共存，lowest 渲染；同 priority 再注册会抛错（消息提示换 priority 遮蔽）"；`:1216-1229` 是校验实现。
- 当前已占用的 key（`<src>/packages/extensions/cordis-client-runner/src/client/slot-catalog.ts:374`，生成于源码声明 + 注册点）：`assistant-step, command, command-input, compaction, context, manual-compaction, model-retry, question-reply, steering, system-prompt, tool-call, turn-error, turn-max-tokens, turn-process, turn-tail, turn-trigger, unknown, user, workflow-run`。占用者跨包：`tool-call` 是 **ui-tool** 的 `ToolCallTree`，`command-input` 是 ui-goal，`question-reply` 是 ui-user-questions，`workflow-run` 是 ui-workflow-run（同文件 :378-398）。

### 3.4 ConversationNodeDefinition：新增节点种类的路径（additive，不是替换）

`<src>/docs/subsystems/conversation.zh.md:76-246` 给出完整范例：用 declaration merging 往 `SessionEventMap` 加事件、往 `ChatNodeDataMap`/`ConversationStepDataMap` 加 kind 数据类型，然后

```ts
export const inject = ['uiConversation', 'slots']
export function apply(ctx) {
  ctx.uiConversation.events.register(reviewDefinition)          // 事件 → Context/State
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: 'review-job',
  }, ReviewNodeView))
}
```

要点：`match(event)` 只做身份提取；`buildViewNode` 产出给渲染器的数据；`groupTree`（`exchange/input/turn/process`，缺省并入相邻步骤组）决定它站在分组树哪个位置 —— **外部 Definition 可以通过声明位置把自己的行放进过程组**（同文档 :258-268；`<src>/packages/client/ui-chat/src/client/contract/group-tree.ts:3-25`）。这条路径适合"新增一种步骤行"，不适合"改造既有行"。

### 3.5 Factory（本任务用不到，备注）

`ctx.slots.registerFactory()` 是可复用装配定义，`renderFactorySlot()` 渲染 occurrence，`useFactorySlot()` 选择局部 Component（slots.zh.md:122, 189-200）。chat 用它做了 `conversation.chat.user.content`、`conversation.chat.reasoning.content`、`conversation.user.text`；替换某个 Factory 的局部 Component 也不能改变原生行的分组行为。

## 4. 关键问题：外部插件能否不 fork 接管「工作步骤行」

### 4.1 替换粒度表（全部为 slot 级、可在插件里完成）

| 想要的范围 | 目标 slot | kind | 接管方式 | 代价 |
|---|---|---|---|---|
| 整段 transcript | `conversation.chat.flow` | single | priority < 0 顶替 `ChatFlow` | 必须自带行列表、滚动/锚点/分组全部重写（`ChatFlow` 还吃 viewport 行为 hook） |
| 整个 Chat 视图（含 flow、文本交互锚点） | `conversation.view`（list，id `chat`） | list | 同 id + 更小 priority | 同上，再加 view 外壳 |
| **一类步骤行**（assistant 文本/推理行、工具调用行、过程控制行、轮次尾行…） | `conversation.chat.node` | keyed | 同 key + 更小 priority | 行内内容自己实现；拿不到原生组件与 presentation 策略 |
| **单个工具的调用行** | `tool.call.toolview` | keyed | 同工具名 + 更小 priority | 只影响该工具；空 key 落到通用行（`<asar>:.../dsh-client-ui-tool/lib/client.js:92-95` 注释：keyed hit REPLACES 通用行） |
| 思考正文（展开后的 body） | `conversation.chat.reasoning.body` | single | 官方条目 priority **100**，用更小值顶替（contract/slots.ts:465-470 明确写了这是替换点） | 只是正文，不改变"是否出现思考行" |
| 输出/用户图片画廊 | `conversation.chat.message.images` / `conversation.chat.user.images` | single | 顶替即换画廊 | 与步骤行无关 |
| 过程组头 / 步骤分组 / 折叠条 | —— | —— | **没有 slot** | 做不到 |

`tool.call.toolview` 的 catalog 条目（`<src>/packages/extensions/cordis-client-runner/src/client/slot-catalog.ts:5036-5085`）写明：*"Registering an occupied key replaces its view; unclaimed keys use the generic row."* 已占用的工具名是一整张表（`bash、read、edit、write、run_code、grep、web_search、present、skill …`），**粒度就是"一种工具的调用行"**。

### 4.2 为什么是"顶替"而不是"包裹"

三条独立证据：

1. **没有 chain。** `conversation.chat.node`、`conversation.chat.flow`、`tool.call.toolview` 都是 `keyed`/`single`；chat 里唯一的 chain 是 `conversation.chat.user.before`（用户消息上方的装饰）与 `shell.quota-notice`（`contract/slots.ts:446-450, 490`）。chain 才能"先问一遍、不同意再 fallback"，这里没有。
2. **原生组件不导出。** `<asar>:dsh-client-ui-chat/lib/client.js` 末尾只导出 `EMPTY_CHAT_SNAPSHOT / apply / inject / isRunningTool / isSettledTool`；`AssistantNodeView`、`TurnProcessNodeView` 等都不在公共面。客户端包还禁止功能插件运行期 import 别的功能插件的值（`<src>/packages/client/AGENTS.md`「Export discipline」1-3 条）。
3. **子 slot 声明被原生条目独占。** `assistant-step` 的 `children`（`conversation.chat.reasoning.body`、`conversation.chat.message.images`）由原生条目声明；影子条目无法再声明同一 child（"重复声明其他 entry 已拥有的 child 会在插件激活时失败"，slots.zh.md:21）。所以影子行**不能**通过 `renderSlot` 复用原生的思考正文/图片画廊，只能自己实现。

### 4.3 接管不了的部分（第五档真正的落点）

档位策略（`<src>/packages/client/ui-chat/src/client/presentation-policy.ts:25-54`）里，由 `transcriptView` 模式派生的 4 个字段只有这些消费点（`usePresentation` 全量检索）：

| 字段 | 消费位置 | 是否 slot |
|---|---|---|
| `foldCompletedTurns` | `chat/ChatNodeSeat.tsx:72`（行可见性）、`chat/ChatGroupSeat.tsx:136` | 否 |
| `stepGrouping` | `chat/ChatGroupSeat.tsx:147-148`（组头是否存在/只历史） | 否 |
| `liveProcessDetail` | `chat/ChatGroupSeat.tsx:102`（组头实时详情） | 否 |
| `settledReasoningPreview` | `chat/ReasoningRow.tsx:62`（推理行标题旁预览） | 否（`ReasoningRow` 在 `AssistantNodeView` 内部，不是 slot） |

（独立设置项 `collapseTiming` 不在四档表里，同样在 `ChatGroupSeat.tsx:165` 被消费；那是 `recon-spec.md` §3 的范围，此处不展开。）

组头（"思考/搜索/…"、步骤组标题、用时抬头）由 `ChatGroupSeat` 整体绘制，内部只对成员调 `ChatNodeSeat`，**组头本身没有任何 slot**。因此：

- 想改"哪些行折叠、组怎么切、组头显示什么"→ 只能改 chat 源码；
- 想改"行里画什么"→ 可以按 key 顶替。

### 4.4 卸载后能否干净回落

**能，机制保证。** 证据链：

1. 影子条目与原生条目**共存**于同一 cell，只是 priority 更低（ui-slots index.ts:1138-1144）。
2. 渲染时每次按 `entriesOfSlot` 重新投影胜者（:1356-1372），`renderSlot` 的 keyed 分派也是每次渲染现算（scoped-slots.tsx:1184-1191）。
3. 插件停用/卸载 → Loader 条目拆除 → fiber 的 `ctx.effect` 清理 → 注册 disposer 移除条目（ui-slots README.zh.md:48 "条目的 disposer 会递归移除其声明的子 slot"；模块侧 `entry-lifecycle.ts`）。
4. 胜者重新投影回原生 priority 0 的条目 —— 原生条目从没被移除，所以是"回落"，不是"重建"。

唯一要避免的坑：**不要与原生同 priority**（会抛错），也不要在影子条目里声明原生已声明的 child（激活报错）。另外若同一 key 的存活条目全部塌掉而账本仍有该 key 的记录，会渲染 `data-slot-error` 锚点（scoped-slots.tsx:1177-1188）——正常卸载顺序不会触发，因为原生还在。

### 4.5 对"detailed 与 verbose 之间加第五档"的判断

- 按 `recon-spec.md` §2 的能力表，`detailed → verbose` 的差别是 `foldCompletedTurns`（true→false）、`stepGrouping`（history→none）、`liveProcessDetail`（true→false）——**全部落在 4.3 的不可接管区**。新的中间档必然要重新组合这三个字段（例如"历史轮也分组但保留实时详情"或"不折整轮但保留组头"），这就必须改 `presentation-policy.ts` 与 `ChatNodeSeat`/`ChatGroupSeat` 的判定。
- 外部插件能提供的是：自己的设置项 + 按 key 顶替 `assistant-step`/`tool-call` 实现"更细的行内展示"。这条路**不改分组/折叠**，所以不构成"第五档"，而是"另一种行样式"。
- 结论：**要真正的第五档，fork ui-chat；只改行内信息量，可以外部实现。**

## 5. 退路（按代价从低到高）

### 5.1 旁挂（不改原生渲染，风险最低）

可增量注册、不顶替任何既有 cell 的位置：

- `conversation.chat.turnTail`（list，`contract/slots.ts:471-476`）：在每个已完成轮次的动作行前插入条目，可放"本轮的步骤摘要/耗时明细"；
- `conversation.chat.assistant-actions`（list，:477-482）：给单条回复加动作；
- `shell.overlay`（list）、`conversation.composer.dock`（list，统计控件就是两条 list 条目）、`conversation.chat.text-interaction`（keyed）、`conversation.chat.user.before`（chain）；
- 设置侧：`settings.section`（大分区）或 `settings.general.item`（通用设置行），以及自己的 `ui-<plugin>` 设置命名空间。

局限：只能"加"，不能改既有行的显示/折叠。

### 5.2 按 key 顶替行渲染（中等代价，无 fork）

在 `conversation.chat.node` 用 `priority: -1` 顶替 `assistant-step` / `tool-call` / `turn-process`，用 `tool.call.toolview` 顶替具体工具行。拿得到的数据（catalog `slot-catalog.ts:344-377`）：

- `node`（该 kind 的完整 `ChatNode` 数据）、owner props（`groupPart`、`cwd`、`openFile`、`inspectCall`、`forkAt`、`loadImage`、`turnProcess`）；
- slot 级 hooks：`useTurnData`、`useDisclosure`、`useGroupAction`；
- 标准 props：`useChat`、`useConversation`、`useSession`、`useTrajectory`、`sessionId`、`useProjection` 等；`t`（声明 `locale: 'chat'` 时）。

拿不到：`presentation` 策略源（它是 chat 注册时私有注进去的）、原生组件、原生 child slot。当前档位若要读，可读 Host 设置文档（`ctx.configForms.get('ui-chat')`，precedent：`<asar>:.../dsh-client-ui-agent-preset/lib/client.js:2287-2289` 跨命名空间读 `ui-settings`），或自己加设置项。

代价：**复制**了 chat 的行实现，版本升级要跟；且交互细节（展开状态、motion、滚动锚点、可搜索隐藏）都要自备。

### 5.3 fork `dsh-client-ui-chat` 在本 profile 内覆盖（唯一能改分组/折叠）

机制上可行，patch 语义已核对（`<src>/vendor/include/src/index.ts:76-124`）：

- 非 insert 的 patch `{ id, config, disabled, group, inject, ... }` 按 id 覆盖既有行；**`name` 是"期望名守卫"，不是"改名"** —— `name` 不匹配就跳过，且 `name` 被解构掉不参与覆盖。所以不能直接把 `ui-chat` 行改名指向 fork。
- 正确做法：`- id: ui-chat, disabled: true` 关掉原行，再用 `insert` 插一行指向本地 fork 包。原行在 `<src>/packages/bundle/web-app/cordis.patch.yml:327-328`（`id: ui-chat` / `name: '@deepseek-ai/dsh-client-ui-chat'`）。
- fork 必须整包提供 chat 的注册面：`conversation.view`（id `chat`、order 0）、`conversation.chat.flow`、全部 `conversation.chat.node` key、以及 `settings.general.item` 里的档位设置行。这会同时带走 chat 的 scroll/virtual/锚点/Interaction/Slot 接线，等于长期维护一个分叉。
- 更窄的 fork 形态（如果只需要换策略表）：把 chat 作为依赖、只替换 `presentation-policy.ts` 与 `ChatNodeSeat`/`ChatGroupSeat` 的判定——但这就不是"外部插件"，而是一个改过源码的 chat 包，且要处理"原行已关、新行占同一批 key"的一致性。

## 6. 未验证 / 风险

1. **本轮没做浏览器实测**（只读纪律）。"卸载回落"是注册表与渲染器代码保证的推断，没有跑过真实 UI 的启用/停用循环；建议下一轮由实现方在 `dsh web` 上做一次最小 A/B（可参照 `settings.section` 那条路径先验证 slot 注册本身）。
2. **0.2.1 ↔ 0.2.2 漂移**：本文机制在安装版逐点核对过（`conversation.chat.node` 注册、`entryKey: routedNode.kind`、ui-tool 的 `tool-call`），但 0.2.2 新增了 `foldedReplies`、改了过程呈现字段（`compactAnswer` → `hasNonReplyProcess`）与 `data-*` 属性（见 `recon-spec.md` §1.1）。影子行若依赖这些内部细节，升级即坏。
3. **priority 必须显式**：`priority` 缺省 0，与原生同值会注册失败；本机没有"动态插件自动更低优先级"的通用机制——那只存在于 `cordis-client-runner` 的浏览器半边 facade（`<src>/packages/extensions/cordis-client-runner/src/client/guard.ts:128-131`：动态定义并在未给 priority 时分配一个更低值；其 catalog 也写着"Do NOT pass `priority`"，`slot-catalog.ts:71`）。**普通 npm 客户端插件不经过这层 facade**，所以照常显式传负值（先例：`<src>/packages/client/ui-subagent/src/client/index.ts:98` 用 `priority: -10`）。
4. **文档间的一处口径差异**：`slots.zh.md` 说 keyed cell"复用已有 cell 表示有意替换"，而 `ui-chat` 的 catalog 对 `conversation.chat.node` 标 `replaceRisk: 'shadows-shipped-ui'`。结论一致（可替换），但属"有意替换"，实现时要自己承担版本耦合。
5. **滚动/动画/可搜索隐藏**：`ChatFlow` 与 `ChatGroupSeat` 的折叠批次、底部预留、锚点复原都在 chat 内部（`ui-chat` README.zh.md 的「滚动归属」段）。影子里改行高度会绕开这套协调，可能造成阅读位置跳动——需要在实现阶段实测。

## 7. 关键文件索引

**源码树（`<src>`）**

| 路径 | 用途 |
|---|---|
| `docs/subsystems/slots.zh.md` | slot 权威说明：声明/生命周期(:17-50)、cardinality 与 scope(:52-66)、组件输入(:68-116)、Conversation 层级(:120-198)、扩展规则(:204-213) |
| `docs/subsystems/conversation.zh.md` | Conversation Node 机制：Definition 范例(:76-246)、认领/前序读/窗口更新(:248-288) |
| `docs/subsystems/web-client.zh.md` | 分层与启动链(:9-26)、Conversation 与 presentation(:56-64) |
| `packages/client/AGENTS.md` | 客户端插件硬规则：slot/props/inject 纪律、导出纪律、新包清单（含 `dsh.client` 字段语义） |
| `packages/client/ui-chat/src/client/contract/slots.ts` | chat 拥有的全部 slot 声明与替换说明(:388-491) |
| `packages/client/ui-chat/src/client/chat/register-node-renderers.ts` | chat 自带的节点渲染器注册(:26-95，`assistant-step` 在 :55-64) |
| `packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx` | 行座位：可见性/折叠 + keyed 分派(:50-179) |
| `packages/client/ui-chat/src/client/chat/ChatGroupSeat.tsx` | 组头与过程组（无 slot；组头 :85-129，座位 :132-190，策略消费 :102/:136/:147/:165） |
| `packages/client/ui-chat/src/client/presentation-policy.ts` | 四档策略表(:25-54) |
| `packages/client/ui-chat/src/client/contract/group-tree.ts` | 分组树位置语义 |
| `packages/client/ui-slots/src/index.ts` | 注册表：遮蔽(:1138-1144)、胜者投影(:1356-1372) |
| `packages/client/ui-renderer/src/client/scoped-slots.tsx` | outlet 的 keyed 分派(:1179-1191) |
| `packages/client/ui-renderer/src/client/registry.ts` | `root` 是 single 的警告与动态条目优先级注释(:28-46) |
| `packages/client/modules/README.zh.md` | 模块系统：声明→bundle→惰性 CJS→动态组合/HMR |
| `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts` | 生成的全量 slot catalog（含已占用 key、replaceRisk、示例） |
| `packages/bundle/web-app/cordis.patch.yml` | 客户端行清单（`ui-chat` 在 :327-328） |
| `vendor/include/src/index.ts` | patch 语义：insert / 按 id 覆盖 / `name` 是守卫 |
| `packages/client/ui-subagent/src/client/index.ts:98` | `priority: -10` 的生产先例 |

**安装版（`<asar>`，包内路径前缀 `dsh/node_modules/@deepseek-ai/`）**

| 包内路径 | 用途 |
|---|---|
| `dsh-client-modules/lib/index.js` | `dsh.client` 解析(:40-75)、combo 路由(:202)、`__DSH_BOOT__`(:501)、行解析与 `./client` 检查(:728-750) |
| `dsh-client-ui-agent-preset/lib/index.js` | node 半侧最小形态（422B，注释即模型说明） |
| `dsh-client-ui-agent-preset/lib/client.js` | `ctx.slots.inject + register` 实例(:2490-2498)、跨命名空间读设置(:2287-2289) |
| `dsh-client-ui-chat/lib/client.js` | 节点渲染器注册(:7214-7320)、座位分派(:3815-3819)、`conversation.view`/`flow` 注册(:13241-13270) |
| `dsh-client-ui-tool/lib/client.js` | `tool-call` key 注册(:4610-4622)、keyed 命中替换通用行(:92-95) |
| `dsh-client-ui-chat/lib/index.js` | 安装版设置 schema（四档模式 + collapseTiming） |
| `dsh-client-ui-renderer/lib/client.js` | `ctx.uiRenderer`/slot 绑定的安装版实现（:316-400 一带） |
