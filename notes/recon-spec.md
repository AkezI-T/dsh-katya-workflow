# DSH Chat 现有四档展示与收起时机规格（调研）

调研人：sakura（只读调研）。写作作用域：本文件。

## 0. 结论摘要

- 四档不是四段 if/else，而是同一张「能力表」的四个取值：`foldCompletedTurns`、`stepGrouping`、`liveProcessDetail`、`settledReasoningPreview`（`presentation-policy.ts:25-54`）。全包只有 4 个消费点读这些字段，渲染层不按模式名分支。
- 收起时机 `collapseTiming` 独立于档位，只影响「已完成轮次何时恢复历史呈现」，不改折叠资格：`completion` 在轮次关闭的同一帧直接隐藏（无动画作用域），`next-input` 让最新交互段保持展开，直到出现 transcript 位置的输入（`ChatView.tsx:180-181`）。
- 第五档无法只靠「加一个字符串」达到效果：现有 4 个能力字段能拼出的、介于 detailed 与 verbose 之间的语义只有少数几种（见 §4.4）；且必须同时改 Host 模式白名单，否则新值会被 Host **静默丢弃**（§7.1）。
- 存在一处按模式名硬编码的耦合：`TranscriptViewRow.tsx:81` 用 `mode !== 'verbose'` 决定是否显示「收起后显示的回复」设置行；新增不折叠的档位必须改成策略驱动。

## 1. 版本与证据来源

| 来源 | 版本 | 用途 |
|---|---|---|
| `F:/Agent WorkSpace/DeepSeekHarnessWorkspace/dsh-0.2.2-alpha2-breaking-audit/_src/deepseek-harness-dsh-v0.2.2-alpha.2`（下文 `<src>`） | 0.2.2-alpha.2 | **权威**：可读源码 + 业务规则文档 + 测试 |
| `.../resources/app.asar` 内 `dsh/node_modules/@deepseek-ai/dsh-client-ui-chat` | 0.2.1-rc.5（安装版） | 交叉验证：确认规格在已装运行时同样成立，并标出版本漂移 |

下文行号默认指向 `<src>/packages/client/ui-chat/`；引用 asar 时显式写 `asar:`。

### 1.1 0.2.1（安装版）与 0.2.2（源码树）的差异（影响补丁可移植性）

| 项 | 0.2.1 | 0.2.2 |
|---|---|---|
| 收起后显示的回复设置 | **不存在**（`asar:lib/index.js:43-48` 只有 4 个字段） | 新增 `foldedReplies`（`chat-settings.ts:24-33, 90`） |
| 策略查找层数 | 2 层：`TIMING_POLICIES[timing][mode]`（`asar:lib/client.js:12746-12749`） | 3 层：`[timing][replies][mode]`（`presentation-policy.ts:68-71`） |
| 每轮过程推导的派生字段 | `compactAnswer`（`asar:lib/client.js:3752, 8409-8415`） | `hasNonReplyProcess` + 渲染侧 `replyRow`（`turn-process-presentation.ts:51-71`、`ChatNodeSeat.tsx:73, 81-84, 106-108`） |
| 数据属性 | `data-turn-process-answer` | 该属性已移除，改为 `data-turn-process-hidden`（`ChatNodeSeat.tsx:164-165`） |

结论：`foldedReplies` / `hasNonReplyProcess` 在 0.2.1 里 **0 次出现**（对 asar 内 client.js 计数验证）。给安装版打补丁必须按 0.2.1 的 2 层结构写；照抄 0.2.2 源码会引入不存在的配置与分支。

### 1.2 0.2.1 侧已核对的等价位置（供只读对照）

- 四档名单：`asar:lib/client.js:12659-12664`；策略表：`:12696-12725`（字段名与 0.2.2 完全一致）
- 模式选项渲染：`:12852-12857`（LABELS）、`:12875-12878`（options）
- 旧值映射：`:12947-12948`；Desktop 默认 `standard`：`:13180`
- 组头实时详情：`:4101-4110`；分组判定：`:4157`；整轮隐藏：`:4163`；思考预览：`:6198`

## 2. 四档的能力表（唯一事实源）

`<src>/packages/client/ui-chat/src/client/presentation-policy.ts:25-54`：

| 能力字段 | compact | standard | detailed | verbose | 含义（同文件注释 :8-23） |
|---|---|---|---|---|---|
| `foldCompletedTurns` | true | true | true | **false** | 正常完成的轮次是否把过程行折到整轮控件后面 |
| `stepGrouping` | `collapsed` | `collapsed` | `history` | `none` | 组头：所有轮次 / 仅历史轮次 / 不分组 |
| `liveProcessDetail` | false | **true** | true | false | 组头是否追加运行中的命令、路径、查询或推理详情 |
| `settledReasoningPreview` | **false** | true | true | true | 已结算的思考行是否在标题旁预览首行 |

用户可见的档位差异（`conversation-nodes/README.zh.md:119-125` 的对照表，代码已验证）：

| 行为 | 简洁 | 标准 | 详细 | 完全展开 |
|---|---|---|---|---|
| 过程组头 | 类别摘要 | 摘要 + 实时详情 | 运行中隐藏；历史保留 | 隐藏 |
| 过程组正文 | 初始收起 | 初始收起 | 运行中直接显示且不限高；历史按手动开合 | 运行中与历史都直接显示，不限高 |
| 已结算推理预览 | 隐藏 | 首行 | 首行 | 首行 |
| 单个推理/工具正文 | 手动展开 | 手动展开 | 手动展开 | 手动展开 |
| 符合条件已完成轮次 | 初始收起 | 初始收起 | 初始收起 | 始终展开，抬头不可收起 |

### 2.1 四个字段的全部消费点（全包仅此 4 处，`usePresentation` 全量检索确认）

1. `foldCompletedTurns` → `chat/ChatNodeSeat.tsx:72`：进入 `processWindowReady`（:75-79）→ `foldable`（:99-100）→ `controllerInactive`（:115-116，隐藏整轮控件本身）与 `processHidden`（:117，隐藏过程成员）；并在 `chat/ChatGroupSeat.tsx:136, 156-157` 参与 `outerHidden`。**它同时决定「能否折叠」和「过程行是否被隐藏」**，所以 verbose 下 `foldable` 恒为 false → 什么都不隐藏。
2. `stepGrouping` → `chat/ChatGroupSeat.tsx:147-148`：`grouped = 'collapsed' || ('history' && turn.status !== 'open' && !deferCollapse)`。`grouped` 再驱动：组头显隐（:166 `useGroupHeaderAction(headerRef, !grouped || …)` → `flow-motion.ts:543-552` 直接设 `hidden` 属性）、限高（:186 `capped`）、`data-group-expanded-mode`（:193）、分页锚点（:192）。
3. `liveProcessDetail` → `chat/ChatGroupSeat.tsx:102`：`detailed = data.closed === false && policy.liveProcessDetail`；:112 决定 `detail`，:113 拼进标题。**仅对未结束组生效**。
4. `settledReasoningPreview` → `chat/ReasoningRow.tsx:61-62`：`preview = !expanded && summary !== '' && (running || policy.settledReasoningPreview)`，:85 落到 `data-preview`；预览文本来源 :59-60（运行中取「最近一个以换行结束的段落首行」，结算后取 `firstLine`）。

补充：`mode` 字段本身只有两个用途——`ChatView.tsx:72` 传给 `useChatScroll`（模式切换时清空折叠批次与底部补白，`use-chat-scroll.ts:163-173`），以及测试里的策略对象身份断言。

### 2.2 工具行与思考行如何处理（模式不改变行内渲染）

- 工具行、推理行的**行内展开**与档位无关：`conversation-nodes/assistant.ts`、`tool.ts` 内 **没有任何** `usePresentation` 调用（检索为 0 命中）。四档都要求「单个推理与工具正文手动展开」。
- 档位只改变**容器**：成员是否被整轮折叠隐藏（字段 1），是否被组盒限高（字段 2），组头文字（字段 3），思考标题旁的首行摘要（字段 4）。
- 组盒限高的实现：`capped = grouped && (!deferCompletedTurns || …)`（`ChatGroupSeat.tsx:182-186`），未限高时挂 `expandedBody` 类（:187 `!capped ? css.expandedBody`）。限高样式在 `ChatGroupSeat.module.css`；业务规则文档记为 `min(400px, 50vh)` 与 4px 行间距（`conversation-nodes/README.zh.md:190`），展开组内滚动由 `useProcessScroll` 负责。
- 思考行是否**生成**与档位无关：只有含非空白文本的推理块生成行（README :194；`assistant.ts` 无策略读取）。compact 只是不显示首行预览。

### 2.3 整轮折叠的资格（与档位无关的旁路条件，务必一起看）

`contract/turn-process.ts:53-58` `turnProcessAlwaysOpen`：轮次 `status === 'open'`，或结束原因 `aborted`/`interrupted`/`error` → 永不折叠。此外：

- 过程开始后出现可见输入（steering/User/触发通知）→ `hasInterleavedInput`（`ChatNodeSeat.tsx:64-65`、`ChatGroupSeat.tsx:150`）→ 不折叠，只保留组级开合（README :65, :91）。
- 没有 `turn-process` 控制节点 / 起止都未加载 → 不显示控件（`TurnProcessNodeView.tsx:18` 要求 turn 已 closed；README :94-96）。
- 控件抬头：轮次关闭才渲染（`TurnProcessNodeView.tsx:18`），文案为「已停止 / 失败 / 用时 X」，`disabled={!canCollapse}`（:19, :45），`canCollapse = foldable && hasContent && !turnProcessAlwaysOpen`。**verbose 下 `foldable=false`，所以抬头存在但按钮 disabled、无 chevron（:58）**——即 README 说的「保留时长或状态抬头，但不支持收起」。

## 3. 收起时机 collapseTiming：completion 与 next-input 的完整链路

### 3.1 completion（默认）

1. 轮次写 `turn/end`、`status='closed'` → `ChatNodeSeat` 的 `processWindowReady` 成立（:75-79），`alwaysOpen` 为 false（:65）。
2. `storedOpen` 使用默认值 `bottom === true && deferCollapse`（:61-62），completion 下 `deferCollapse` 恒为 false（`ChatView.tsx:180`）→ 默认关闭（`stores.ts:36-44`）→ `outerHidden`/ `processHidden` 立即为 true。
3. `ChatView.tsx:218-219` 的 `data-chat-motion` 只在延后折叠生效时才写入 → completion 下**没有折叠动画作用域**，`flow-motion.ts:507-516` 走 `hideNow`（先测布局再提交隐藏）→ 立即隐藏、同步跟随底部。
4. 结论：**回答一结束，过程就收回控件后面**；滚动是即时定位（与 README :140「保留立即折叠和即时跟尾定位」一致）。

### 3.2 next-input（下次发送时收起）

延迟链（每一环都可独立取消）：

1. `ChatView.tsx:71` `deferCompletedTurns = policy.collapseTiming === 'next-input'`。
2. `ChatView.tsx:180-181`：`deferCollapse = deferCompletedTurns && !pendingInputs.some(item => 'requestId' in item && item.placement === 'transcript')`。**只有 transcript 位置的输入取消例外**；排队（`queued`）与单独 steering 不取消（README :142）。
3. 该值经 `conversation.chat.flow` 的 owner props 下发（`ChatView.tsx:235`）。
4. `ChatNodeSeat.tsx:61-62`：`defaultOpen = bottom && deferCollapse`——`bottom` 来自 `useChatNodeBottom`（最新交互段内最后一个可见节点，`<src>/packages/client/ui-chat/README.zh.md:106`）。
5. `ChatGroupSeat.tsx:140, 147-148`：同一 `deferCollapse` 还让 detailed 的历史轮次**暂不分组**（`grouped` 需要 `!deferCollapse`），所以 detailed 在延后期间保持「平铺过程行」，正是 README :142 描述的「详细保留平铺过程行」。
6. 出现新输入（或新轮次开启把 bottom 移走）→ `deferCollapse` 变 false → `storedOpen` 默认变 false → 过程收起；此时 `data-chat-motion` 已在（`running || motionTail || pendingInputs.length > 0`，`motionTail` 为结束后 800ms 尾窗，`ChatView.tsx:55, 100-110`），所以折叠与滚动在**同一帧时钟**上推进：`use-chat-scroll.ts:84` 与 `:101` 先尝试 `reading.followInputFold(...)`（本客户端输入 → `followInputFold(true)`，其余贴尾 → `(false)`），失败才退回普通跟尾。
7. 动画细节：`ChatGroupSeat.tsx:182-186` 的 `closingCap` 保证「读者展开过的组从限高收起、平铺的最新轮次从平铺高度收起」；`flow-motion.ts:383-430` 做先淡出再收高的两段动画并同步滚动。

### 3.3 两种时机的交互差异（一句话版）

- completion：轮次一结束就收（无动画，立即贴底），历史上永远只看到控件和回复。
- next-input：最新交互段在结束之后仍保持「运行中的样子」——简洁/标准保留组头（正文初始收起），详细保留平铺过程行——直到用户发出下一条 transcript 输入或出现开启新交互段的轮次；通知唤醒的轮次（子代理完成、定时任务、Goal Round）**不会**取消同一交互段的例外（README :142，代码侧由 `bottom` 语义 + `deferCollapse` 共同保证）。
- 手动开合始终优先：`turnProcesses` 只按 `turn + answerStep` 记忆（`stores.ts:21-26, 54-59`），与档位无关，换档/换时机不丢用户选择（README :196）。

## 4. 五档落地：插入点清单

### 4.1 Host 侧（`<src>/packages/client/ui-chat/src/chat-settings.ts`）

| 位置 | 现状 | 是否必改 |
|---|---|---|
| `:36` `TRANSCRIPT_VIEW_MODES = ['compact','standard','detailed','verbose']` | 设置菜单顺序 + schema 白名单的来源 | **必改**（插在 index 3，即 detailed 与 verbose 之间） |
| `:39` `type TranscriptViewMode` | 由数组派生 | 自动 |
| `:51-53` `TRANSCRIPT_VIEW_SETTING_VALUES` | 数组 + 两个 legacy 值 | 自动 |
| `:94` `z.union([...TRANSCRIPT_VIEW_SETTING_VALUES]).loose()` | Host 校验（见 §7.1） | 自动（但行为取决于 :36） |
| `:76` `ChatSettings.transcriptView` 类型 | 联合类型 | 自动 |
| `<src>/packages/client/ui-chat/src/index.ts:32-38` `Config` 投影 | 引用 `ChatSettingsFields[...]` | 自动 |

### 4.2 客户端侧（`<src>/packages/client/ui-chat/src/client/`）

| 位置 | 现状 | 是否必改 |
|---|---|---|
| `presentation-policy.ts:25-54` `POLICIES` | 4 个条目，类型 `Record<TranscriptViewMode, …>` | **必改**（漏了会 typecheck 失败） |
| `presentation-policy.ts:56-66` `withTiming` | 显式逐个展开 4 个档位 | **必改**（返回类型 `Record<TranscriptViewMode, …>` 强制补一行） |
| `presentation-policy.ts:68-71` `TIMING_POLICIES` | 组合 timing×replies | 自动 |
| `settings/TranscriptViewRow.tsx:34-39` `LABELS`（`satisfies Record<TranscriptViewMode, ChatKey>`） | 4 个文案键 | **必改** |
| `settings/TranscriptViewRow.tsx:70` 选项渲染 | `TRANSCRIPT_VIEW_MODES.map` | 自动（顺序即菜单顺序） |
| `settings/TranscriptViewRow.tsx:81` `mode !== 'verbose'` 控制折叠回复设置行 | **按模式名硬编码** | **必改**：换成策略驱动（例如 `policy.foldCompletedTurns`），否则新档若也不折叠会露出无效设置 |
| `locale.ts:113-116`（zh）、`:315-318`（en），其余 ja/es/fr/de/ru/pt 同段 | 4 个档位文案 | **必改**（`verify-client-ui-i18n` 门禁） |
| `transcript-view.ts:69-80` `adopt`（legacy 映射 + 默认值） | `normal/expanded → detailed` | 仅当新档要吸收某个旧值时才改 |
| `transcript-view.ts:42-46` `setMode` | 写 Host | 自动 |
| `apply.ts:169-174` Desktop 默认 `'standard'`、`derivePresentationPolicy` 装配 | 默认档 | 仅当新档要成为某平台默认时改 |
| `apply.ts:191-206` 设置行注册（id `transcript-view`，order 12） | 注入 hooks/actions | 自动 |
| 渲染组件本身 `ChatView / ChatNodeSeat / ChatGroupSeat / TurnProcessNodeView / ReasoningRow` | 只读能力字段 | **无需改**（前提是第五档只组合现有 4 个字段） |

### 4.3 测试、e2e、文档、引导（漏了会红或漏覆盖）

- `<src>/packages/client/ui-chat/tests/presentation-policy.client.spec.tsx:19-42`：`it.each` 四行表 + 「十六种策略互不相同」断言（:36-42）→ 需加一行并把 16 改成 20。
- `<src>/packages/client/ui-chat/tests/config.host.spec.ts:24-30`：合法值列表（:24-26）+ 非法值被丢弃的断言（:28-30）→ 加新档名。
- `<src>/apps/web/tests/collapse-timing.e2e.ts:95`（`transcriptView: choice.toLowerCase()`）、`settings-chrome.e2e.ts`（含 transcriptView 引用，未逐行核）→ 扩展设置项时同步。
- `<src>/packages/client/ui-settings-account/src/client/onboarding-state.ts:44, 167, 171`：Desktop 引导会写 `ui-chat.transcriptView`。
- 文档：`src/client/conversation-nodes/README.zh.md:117-125` 的档位表（及 `README.md` 镜像）、`README.zh.md:93-95`（轮次过程折叠）、`README.zh.md:69` 起的整轮折叠；行为破坏性变更还需 upgrade guide。
- 质量门（仓库 AGENTS.md）：`pnpm run test:gui`；可见输出变化追加 `DSH_SNAPSHOT=replay pnpm run test:web`；client 源包在 `test:coverage` 的 per-file 100% 覆盖门内，新分支必须被测试覆盖。

### 4.4 候选语义：只有 4 个字段时，什么才真的「介于 detailed 与 verbose 之间」

先把「可观察」的字段组合列全（`liveProcessDetail` 仅在「分组且未结束」时可观察；`stepGrouping='none'` 时组头 `hidden`，该字段不可观察）：

| 候选 | foldCompletedTurns | stepGrouping | 可观察效果 | 与现有档位的关系 |
|---|---|---|---|---|
| A | true | `none` | 已完成轮次仍整轮收起；手动展开后**无组头、无限高**，过程行全部平铺 | 介于 detailed 与 verbose：保留折叠纪律，只放宽展开形态 |
| B | false | `history` | 整轮永不收起（抬头 disabled）；历史轮次仍分组限高+组头 | 更靠近 verbose 一侧 |
| C | false | `collapsed` | 整轮永不收起，但所有轮次（含运行中）都限高分组的折叠盒 | 「不折叠整轮但组盒始终限高」，与 compact 的差别只在整轮层 |
| D | true | `history` | = detailed（现有） | 不是新档 |
| E | true | `collapsed` | = compact/standard 的容器形态（差别只剩两个布尔） | 不是新档 |

要实现 A/B/C 之外更细的意图（例如「最新轮次平铺、更早轮次自动收起但不分组」），现有字段表达不了，必须新增能力字段（如 `foldOlderTurns`）或新增 `stepGrouping` 取值（如 `'running-only'`）；那会改动 `ChatGroupSeat.tsx:147-148` 与 `ChatNodeSeat.tsx:75-117` 的判定、`ChatGroupSeat.module.css`（新状态可能缺样式），并新增测试分支。**这是本调研最重要的设计结论：第五档的「语义」必须先定，才能判断是「改表」还是「加词」。**

## 5. 查不到 / 未验证

- `<src>` 的 0.2.2 业务规则文档 `src/client/conversation-nodes/README.zh.md`（337 行）**未随 npm 包发布**：安装版 asar 里没有该文件（`asar` 列表检索无命中），所以只看安装版时无法读到档位表与收起时机表；本笔记的规则引用来自源码树。
- `apps/web/tests/settings-chrome.e2e.ts` 仅确认含 `transcriptView` 字样，未逐行阅读其断言。
- 未运行任何构建/测试；未验证浏览器实际渲染与动画时序（本轮只读调研，且 GUI 验证默认不做）。
- 未评估「不 fork 安装包、由外部插件接管渲染」的可行性——属于 task-2 的范围，但结论会反过来约束第五档能否在插件层实现：`ChatNodeSeat`/`ChatGroupSeat` 的显隐判定不是 slot，外部插件只替换得了 `conversation.chat.node` 渲染器，替换不了整轮折叠与分组判定。

## 6. 复核方式（可重跑）

- 源码定位：`grep -n "usePresentation(" <src>/packages/client/ui-chat/src -r`（应得 §2.1 的 4 个消费点）
- 安装版对照：`node tools/asar.mjs cat <app.asar> dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js | grep -n "TRANSCRIPT_VIEW_MODES\|POLICIES\|foldCompletedTurns"`
- 版本差异：`| grep -c "foldedReplies"` 在 0.2.1 为 0，在源码树 `grep -rn foldedReplies <src>/packages/client/ui-chat/src` 非空。

## 7. 风险清单

### 7.1 Host 校验会静默丢弃未知值（最高优先）

`chat-settings.ts:93-94` 的注释写明「Missing and unrecognized modes defer to the client's default」，`config.host.spec.ts:28-30` 用 `['dense','',42,false,{},null,undefined]` 断言：非法值**不报错、不落盘**，读回为 `undefined`。后果：只改客户端 `POLICIES` 而不改 `:36` 时，UI 里能选中新档（内存内生效），但一旦 Host 回写/刷新，值被丢弃并回落到默认 `detailed`——表现为「设置过一会儿自己变回去」，且日志无异常。

### 7.2 类型系统会兜住大部分漏改，但兜不住全部

`POLICIES` 与 `withTiming` 的返回类型是 `Record<TranscriptViewMode, …>`，`LABELS` 用 `satisfies Record<…>`，漏加会 typecheck 失败。**但以下不会被类型检查发现**：`TranscriptViewRow.tsx:81` 的 `mode !== 'verbose'` 硬编码、locale 缺键（由 i18n 门禁发现）、e2e 里的档位列表。

### 7.3 verbose 的 `liveProcessDetail: false` 是死配置

组头在 `!grouped` 时被 `hidden`（`ChatGroupSeat.tsx:166` + `flow-motion.ts:543-552`），而 verbose 的 `stepGrouping='none'` 恒 `!grouped`，所以该布尔在 verbose 下 **永远不可观察**。照抄到第五档并指望它「降低噪音」不会有效果；反之，若第五档保留分组，就必须把它设为 true 才有实时详情。

### 7.4 策略对象身份与记忆化

`presentationPolicyFor` 必须对同一组选择返回**同一个对象**（`presentation-policy.client.spec.tsx:22-34` 用 `toBe` 断言）。第五档必须走 `withTiming` 生成并缓存，不能在 `getSnapshot` 里新建对象；否则 `derivePresentationPolicy` 每次快照变化都会让所有读策略的座位重渲染（`ChatNodeSeat`/`ChatGroupSeat` 是 `memo`，选择器返回值不稳定会击穿记忆化）。

### 7.5 模式名是唯一会触发滚动重置的键

`use-chat-scroll.ts:163-173` 以 `transcriptView`（即 `policy.mode`）为依赖，切换时取消折叠批次、清空底部补白再按新档位调整滚动范围（`<src>/packages/client/ui-chat/README.zh.md:151`）。若第五档用「新增能力字段 + 不改 mode」实现（例如让新档与 detailed 共用 mode），切换时**不会**发生上述重置，可能出现底部预留残留。用独立 mode 名则自动获得正确行为。

### 7.6 安装形态约束

本机运行的是 app.asar 内已构建的 0.2.1 包，源码树改动不会影响运行中的 GUI。要让第五档真正生效，只有两条路：(a) 重新构建并替换 `ui-chat` 的 `lib/client.js` 与 Host 入口（等于 fork 安装包，且需同时改 §4.1 与 §4.2）；(b) 外部插件重注册 `settings.general.item`（id/order 相同、priority 更小可替换）并替换 `conversation.chat.node` 渲染器——但接管不了 §2.1 的四个消费点，因此无法表达新档的显隐语义。方案取舍需 lead 决定。

### 7.7 版本漂移（补丁不可直接搬运）

见 §1.1：0.2.1 没有 `foldedReplies` 与 `hasNonReplyProcess`，策略查找是 2 层。若最终要作用于安装版（0.2.1-rc.5），第五档只能落在 `[timing][mode]` 结构里；若上游已升到 0.2.2，则需按 3 层结构并同时处理 `foldedReplies` 与 `replyRow` 的交互。
