# 调研：codex 系统提示词与 workbuddy 展示参考

任务：task-4｜调研女仆 mio｜只读调研，未修改任何既有文件。

**一句话结论**：codex 的系统提示词在本机是**从 codex.exe 内嵌模型目录里抽出来的原文**，位置在
`DeepSeekHarnessWorkspace/codex-reply-style/gpt6-embedded-prompts/`（5 份 + 索引 + 中译）。
它本身**没有**阶段划分或 todo/plan 机制，真正定义"步骤如何被编排、被展示"的是它的
**commentary / final 双通道**语义；而 DSH 侧真正做过"步骤编排 + 步骤展示"的参考实现是
`DeepSeekHarnessWorkspace/.ref-dsh-compact-codex`（任务账本 + 卡片渲染器 + 预览页）。
workbuddy 在本工作区内**没有**任何步骤展示/UI 参考材料，只有登录申诉截图与个人风格笔记。

---

## 1. 系统提示词的真实路径（事实）

### 1.1 主目录

`F:/Agent WorkSpace/DeepSeekHarnessWorkspace/codex-reply-style/gpt6-embedded-prompts/`

| 文件 | 行数 | 说明 |
| --- | --- | --- |
| `desktop-0.162.0-alpha.17.2__gpt-6.1-sol.md` | 173 | **主参考件**，gpt-6.1-sol，21,769 字符，默认推理档 low |
| `desktop-0.162.0-alpha.17.2__gpt-6-astra.md` | 170 | gpt-6-astra，21,420 字符 |
| `desktop-0.162.0-alpha.17.2__gpt-6-sol.md` | 156 | gpt-6-sol，18,992 字符，medium |
| `desktop-0.162.0-alpha.17.2__gpt-6-luna.md` | 153 | gpt-6-luna，18,037 字符，medium |
| `cli-0.153.4__gpt-6-astra.md` | 170 | CLI 0.153.4 版 astra，21,261 字符 |
| `gpt-6.1-sol.zh.md` | 395 | 上面主参考件的**逐句中译**，结构一一对应 |
| `INDEX.md` | 38 | 来源、字段路径、版本差异说明 |
| `_provenance.json` | 66 | 每个提示词的二进制偏移、长度、sha、默认 effort |
| `_diff__gpt-6.1-sol__vs__gpt-6-sol.txt` 等 | — | 版本/同代模型间的逐行差异 |

### 1.2 来源（INDEX.md:5-11，事实）

- 桌面版 `0.162.0-alpha.17.2`：`C:\Users\Lenovo\AppData\Local\OpenAI\Codex\bin\9614f1d9b40d9c4f\codex.exe`，334,121,776 字节，模型目录 JSON 起始于 264,824,343。
- CLI `0.153.4`（npm）：`...\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`，295,408,944 字节。
- 提示词以 UTF-8 明文内嵌，字段路径是 `models[].model_messages.instructions_template`；桌面版 0.162 已无 `base_instructions` 字段。

### 1.3 同源副本与旁证

- `codex-reply-style/tools/tmpl_*.md`（13 份）：同一批 `instructions_template` 的原始 dump，内容与上面主件同源（如 `tmpl_cli0153_00_gpt-6-astra.md` 首行即 `You are Codex, an agent based on GPT-6...`）。
- `codex-reply-style/tools/emb_*.md`、`catalog_gpt-*.md`、`_diff__*`：抽取过程中的中间产物。
- `DeepSeekHarnessWorkspace/codex-reply-style/codex-reply-style.md`（302 行）：**不是**系统提示词，是"Codex 首句回复样式收集"，10 个样本归纳出的首句骨架（:264-299）。其中 :290-292 明确写：官方提示词 "Presenting your work" 一节**没有**任何"先报边界""先核查再产出"的条款，该样式只能从样本归纳。

### 1.4 查过但不是提示词的目录

- `F:/Agent WorkSpace/.tmp/refs/` —— 两份 DSH 预设 patch yml（`dsh-base__cordis.patch.yml` 529 行、`standard.patch.yml` 146 行），与 codex 提示词无关。
- `CodexWorkSpace/` —— 模型目录 JSON、缓存与驱动审计产物，无提示词正文。
- `ZcodeWorkSpace/`、`ClaudeCodeWorkspace/`、`_tools/`（空目录）—— 无相关材料。

---

## 2. 提示词内容结构（以 gpt-6.1-sol 为准，行号可核）

全文以第一行定义身份（:1：「You are Codex, an agent based on GPT-6. You and the user share one workspace, and your job is to collaborate with them until their intended goal is completely handled.」），其后 8 个一级节：

| 行 | 节 |
| --- | --- |
| 3 | `# When to ask the user for permission` |
| 15 | `# Autonomy and persistence` |
| 27 | `# Personality`（内 31 `## Writing style`、47 `## Technical communication`、55 `### Writing PR descriptions`） |
| 61 | `# Working with the user`（内 75 `## Intermediate commentary`、85 `## Final answer`、89 `### Formatting rules`、104 `### Visualizations`） |
| 114 | `# Rules for getting work done` |
| 130 | `# Using skills`（142 `## When to use a skill`、148 `## How to use skills`） |
| 154 | `# Apps (Connectors)` |
| 161 | `# Plugins`（165 `## How to use plugins`） |

**注意版本差异（事实）**：`gpt-6-sol` 与 `gpt-6-luna` 把 `# Personality` 放在第一位（:3），`gpt-6.1-sol` 把它前移到 Permissions / Autonomy 之后（:27），并把 `## Technical communication` 从 Writing style 里独立出来。`gpt-6-luna` 少了 `### Writing PR descriptions` 与 `### Visualizations` 两小节。

**关键：全文没有任何 plan / todo / update_plan / checklist 小节。** 对 6.1-sol 全文 grep `plan|todo|step|progress` 只命中散文句（:53 有 "next step" 字样，:144 有 "current working plan"），没有结构性条目。也就是说 codex 的工作流程不是靠一份阶段清单驱动的。

---

## 3. 可用于「编排 agent 工作流程」的结构性要素（原文事实 + 提炼）

### 3.1 双通道：commentary / final（对我们最重要）

- :63-65 定义两个用户可见通道：`commentary`（工作过程中的更新）、`final`（结束回合的最终消息）。
- :77：commentary 用来说明**相关假设、发现、决定、方向变化**，"目标是让你的工作与本回合的计划对用户来说易于理解和核实"。
- :79：需要调工具时**先发一条 commentary**；"持续工作中不应超过 60 秒没有 commentary 更新"。
- :81（**最直接的设计依据**）：commentary 里不许问用户问题、不许放最终答复；"final answer 必须完全自包含：用户永远不需要回头读早先的 commentary 更新，**因为它们会在 final 之后被折叠**"。
- :83：不要在 commentary 里用"我要做 X 而不是 Y"式的对比来给计划贴金。

> 提炼：官方把 commentary 定位成"过程可见、终结即折叠"的一段流，而不是与正式回答同权的消息。DSH 现有的 detailed/verbose 各档正是在决定这段流露出多少——我们要加的第五档就在这条语义带上，不新增消息通道。

### 3.2 自主持久循环：把"继续干"写成默认

- :17-19：从指令与前文推断意图和范围；"bias towards action"，除非明确破坏性/不可逆，否则自主推进（可自建 worktree、解冲突、开 draft PR）。
- :21：用户说 "can you… / I want to… / help me…" 就是**干活指令**；"不要停在确认能力（'Yes…'）、提出计划或表示可以继续"；不要为省时间接受"够好了"的部分解法。
- :23：意图不清时**先朝目标推进，同时**问澄清，而不是停下来等。
- :69-73：工作途中收到新消息默认是**转向（steering）**而非替换任务；上下文压缩不等于任务结束，压缩前后是一个逻辑事件链，"不要从头重来、不要重做已完成的工作、不要重复已发过的 commentary"。

> 提炼：这是"计划-执行-验证循环"里最硬的一条——**循环的默认状态是继续，停止是需要理由的例外**。可迁移为插件里"步骤行默认展开 / 继续中"的语义。

### 3.3 权限闸门：先把活干到可评审，再问

- :5-9：像称职同事那样判断何时真要许可；一旦会话里已有授权证据就继续，不要为了澄清而结束回合；**必须先把已授权且使方案具体可评审的工作全部做完**，让批准成为最后一步；可逆的、只读的、修 bug 的、已在会话里授权过的不需要许可。
- :13：用户很反感被停下来确认；若必须问，要在末尾单独一段解释来源（SKILL.md / AGENTS.md / memory / auto-review 拦截）。
- :25、:136-140：本地 md 与 skill 里的例外**不自动**构成审批需求；用户指令优先于 skill；skill 若导致停下来问，必须指名并链接该 SKILL.md、引用原文。

> 提炼：闸门的位置被明确规定为"最后一个可逆边界"，不是"第一个不确定点"。这可以用来给第五档里的"待确认 / 受阻"步骤一个明确的视觉位置。

### 3.4 完成任务的定义

- :9：完成 = 已授权且必要的工作都做完，结果"具体且可评审"。
- :127-128：不为可逆低影响改动写测试、不写镜像实现的测试；"跑适合这次改动的测试并完成必需检查。检查通过后，只有新改动、失败或未解决的疑虑才值得扩大或重复测试"。
- :126：实现细节不进产品用户流程。
- :122：禁止超过 60 秒的阻塞 sleep / wait（因为会中断与用户的沟通）。

> 提炼："完成"绑定在**可评审的具体结果**上，验证是**一次性比例原则**（与本仓 AGENTS.md §4 相近）。账本类功能若要判 done，需要外部证据（见 §4.1）。

### 3.5 汇报格式

- :51：**先给结果**再展开推理；报告改动时说明改了什么、为什么、怎么测的、有什么实质风险或局限。
- :53："按**让结论最容易被评估的顺序**呈现推理与证据，而不是按时间顺序复述你的工作。常规验证做汇总，不要逐条列每一次检查。进行中的更新聚焦：你搞清了什么、还有什么不确定、下一步会解决什么。"
- :35：避免小标题堆砌与 "In short:" 式总结收尾（注意：与 §3.1 的"结构化"并不矛盾，它针对的是散文式回答正文）。
- :94-100（DSH 侧已对齐）：文件用可点 markdown 链接，绝对路径 + 可选行号，路径含空格用尖括号；不写文件范围行号；不重复同一文件名。
- :102：列表前必须有空行（CommonMark）。

> 提炼：「进行中的更新 = 学到什么 / 还剩什么不确定 / 下一步验证什么」这三段式，几乎就是第五档步骤行里"当前步骤摘要"的理想字段——比"正在调用 tool X"信息量大得多。

### 3.6 工具与并行纪律

- :116-118：优先 `rg`；独立搜索/读取用 `Promise.allSettled` 批量并发并逐个检查结果；有依赖的、改动、审批、等待、自适应跟进必须顺序执行。
- :119：**不要用 `echo "====";` 之类的分隔符把 shell 命令串起来**——输出变噪，让用户那一侧变差。
- :123-124：不重用 `$HOME` / `$CODEX_HOME` 这类系统变量；shell 命令文本当代码处理，`JSON.stringify()` 不是 shell 转义。

> 提炼：这几条直接解释了"步骤展示为什么会脏"——工具调用被分隔符噪声污染后，步骤行摘要很难读。第五档若要提取"这一步做了什么"，应按结构化参数而非原始命令文本取。

---

## 4. DSH 侧真正做过步骤编排的参考：.ref-dsh-compact-codex

路径：`F:/Agent WorkSpace/DeepSeekHarnessWorkspace/.ref-dsh-compact-codex/`
性质：一个完整的 DSH 插件（server `lib/index.js` 1615 行 + client `lib/client.js` 229 行 + `lib/ledger.js` 532 行），带 `cordis.patch.yml`（25KB）、`README.md`、`docs/how-it-works.md`、`docs/internals.md`、预览页与预览图。

**它对本项目价值最高的不是压缩逻辑，而是两样东西：一份"步骤账本"的数据模型，和一套已验证能在 chat 里渲染步骤卡片的做法。**

### 4.1 任务账本的数据模型（事实，`lib/ledger.js`）

- :10-17 四种状态：`in_progress`（进行中）/ `done`（已完成）/ `superseded`（已被取代）/ `blocked`（受阻）。
- :19-25 字段约束：`task_id` 形如 `/^[\w.-]{1,64}$/`，`title` ≤200 字，`anchors` ≤8 条，单条 `text` ≤1500 字（注释原话：「一句话的要点，不是流水账」）。
- :88-94：`in_progress` **必须**填 `next_step`；:126-129：`done` **必须**填 `evidence`（能证明做完的历史编号），且该编号必须是真实存在且成功的 `tool/result` 事件（由代码 `session.eventAt()` 现查，拿 assistant 消息号或 `tool/call` 号都会被拒）；:147-151：`superseded` 必须填 `superseded_by`。
- `how-it-works.md:115`：字段含义——`task_id` 标识任务，`status` 四态，`text` 一句话要点，未完成时写 `next_step`，`anchors` 记"接下来要改的位置（文件路径 + 一段能在文件里唯一定位的原文）"。
- `how-it-works.md:122`：锚点定位不到就被丢弃。
- `how-it-works.md:133`、`ledger.js:440`：`through`（覆盖边界）—— 这条记录看到了哪个历史编号为止，用于让新窗口对齐时间线、"不拿过时的进行中记录重推已完成的步骤"。

### 4.2 账本的两种展示形态（事实）

1. **单行式** `renderEntry()`（`ledger.js:359-371`）—— 明细视图，拼装顺序为：
   `#L{seq}` · `task_id` · 状态中文标签 · `title` · `text` ·（下一步：…）·（证据：#…）·（由 … 取代）·（锚点：路径（备注））。
   即：**编号 → 归属 → 状态 → 标题 → 要点 → 下一步 → 证据 → 锚点**。
2. **主页式** `renderHome()`（`ledger.js:408-505`）—— 新窗口打开时读的那一页，段落顺序：
   最近的用户请求（原话）→ 进行中 / 受阻的任务 →（完成后列表 / 被取代列表）。
   进行中任务先出**最多 5 个完整条目**（`MAX_FULL_ACTIVE=5`，:405），每个含 task_id、标题、状态、最多 3 条笔记（`MAX_WINDOW_NOTES=3`，旧→新，带 `#L{seq}` 与「覆盖到 #N」）、下一步、待改位置；其余只给摘要，超 token 预算（默认 4000）从最旧开始丢。

> 提炼：这是一套**已经跑通的步骤展示信息架构**——状态四态、层级（任务 → 笔记若干条 → 下一步 → 锚点）、预算裁剪（先砍笔记条数，再砍条目数，永不砍用户原话）。dsh-katya-workflow 的第五档若要显示"工作步骤"，这套字段与排序可直接借鉴。

### 4.3 客户端渲染的展示形态（事实）

- `docs/how-it-works.md:51-66` 整节讲"客户端渲染"：`lib/client.js` 用 `ctx.uiConversation.events.register()` 注册事件定义，`match` 只认以 `# 上下文交接` 开头的 user 消息；再把视图注册进 **`conversation.chat.node` 这个 keyed slot**，key 就是 `buildViewNode()` 产出的 `kind`（`compact-codex-handoff`），它是 renderer key，与官方注册的十五个 key（`user`、`steering`、`context`、`compaction`、`manual-compaction` 等）都不冲突。
- 渲染结果：**强调色左边框 + 一行标题 + 展开后等宽正文**的一张卡片，折叠交给原生 `<details>`，组件无状态。
- 两条官方约束（已写进代码注释）：除 React 基座外**不 require 任何 `dsh-client-*` 包**（它们会变，纯 JS 插件没有类型检查，抛错的组件会清空整个 slot 条目）；factory 内**不产生副作用**，样式注入放在 `apply` 里由 `ctx.effect` 管理。
- 产物是惰性 CJS factory（`window.__ModuleLoader__.load({ id, factory })`），**手写即最终产物，不需要构建链**。
- 目标态对照：`README.md:19,21-25` 说明它刻意不走官方那套「一行灰色小字 + 可展开正文」，而是自渲染成卡片。

> 注：slot / renderer key 的完整机制属于 task-2 的调研范围，这里只记与"展示形态"有关的事实。

### 4.4 预览页（视觉参考的确切来源）

- `preview-handoff.html`（111 行，7,693 字节）：**不是运行期产物**，是静态预览页，:29-53 逐字复制了 `lib/client.js` 注入的 CSS。
- `preview-handoff.png`（1,069×1,074，96,220 字节）：由上面 HTML 截出，三段对照——折叠态 / 展开态 / 普通助手回复。`README.md:25` 用它作界面说明图。
- 卡片视觉规格（`preview-handoff.html:30-52`，可直接抄）：
  - 行容器 `.ccc_row`：左边框 `2px` 主题强调色 `--dsw-alias-state-business-primary`；背景 `color-mix(背景 88%, 强调色 12%)`；圆角 `--dsw-radius-sm`（预览页取 6px）；内边距 `6px 10px`；外边距 `2px 0`。
  - 折叠头 `.ccc_head`：`display:flex`，6px 间距；字号 `--dsh-content-font-size-secondary`(13px)，行高 `calc(22px + --dsh-content-font-delta-secondary)`；三级文字色 `--dsw-alias-label-tertiary`；隐藏 `::-webkit-details-marker`；hover 升到二级色。
  - 头内三件：6px 圆点 `.ccc_dot`（强调色）、加粗标签 `.ccc_label`（一级色）、省略号单行摘要 `.ccc_meta`（nowrap + ellipsis + flex:auto）。
  - 正文 `.ccc_body`：顶部 `1px` 分隔线；13px / 20px；二级文字色；`word-break:break-word`。
  - 正文子节点：`.ccc_h1`（15px 加粗）/ `.ccc_h2` / `.ccc_quote`（左侧 2px 竖线）/ `.ccc_li`（悬挂缩进 14px）/ `.ccc_code`（等宽 12px）/ `.ccc_hr`。
- 折叠态的一行内容 = 圆点 + `上下文交接` + 首条用户请求摘要；展开态是 4 段正文（用户请求原话 / 上次助手最后回复 / 文件工作集 / 最近动作）。`how-it-works.md:49` 解释了为什么要重装饰：让它"在聊天界面里与普通消息一眼可分，否则整条看起来就和平常的一段回复没有区别"。

---

## 5. workbuddy：查不到步骤展示材料（事实）

- 目录 `WorkBuddyWorkSpace/` 全部内容：`.workbuddy/memory/{MEMORY.md, 2026-08-27.md}`、`blackhole-webgl/index.html`、`_verify/`（三个 WebGL shader 的验证工程）、`个人简介/`（6 份个人方法论文档）。
  - `MEMORY.md` 是"个人代码风格与架构规范 / 个人思维风格与工作方式"，与 UI 步骤展示无关。
- `DeepSeekHarnessWorkspace/github-workbuddy-2026-10-22/` 全部是 WorkBuddy 产品**登录与申诉**过程的截图（`workbuddy-dashboard.png`、`wb-login-page.png`、`wb-restricted.png` 等）与 `申诉记录.md`，属于账号问题取证，**不含聊天步骤展示 UI**。
- 结论：**工作区内不存在 workbuddy 的步骤展示 / 工作流 UI 参考材料**。若确实需要 WorkBuddy 的展示形态，得另找来源（本机没有）。

---

## 6. 推测（明确标注为推测，不是读到的原文）

1. **第五档的语义位置**：codex 的 :81 把 commentary 定义为"终后将折叠"的过程流，:79 要求 60 秒内必须有更新。推测我们要加的"detailed 与 verbose 之间"这一档，实质是在决定：折叠后**保留哪些字段**（只保留 §3.5 那三段式摘要？还是连工具名 + 目标文件一起保留？）。这需要 task-1 的四档规格来定边界，我这边给不出。
2. **状态四态可以直接复用**：ledger 的 `in_progress / done / superseded / blocked` + `next_step` + `evidence` 组合，恰好覆盖"步骤行要显示的四种结局"。据此推测第五档的每一条步骤行可以固定为「状态点 + 一句话要点 +（下一步 | 证据）」，与 `renderEntry()` 的字段序一致。
3. **卡片的 CSS 规格可零成本迁移**：`.ccc_*` 这套已经验证在 dsh 主题下不违和（用的是主题 token 而非硬编码色值），且"手写即产物、无构建链"。
4. **不推荐照搬"账本"**：账本是给**模型**看的跨窗口备忘（`how-it-works.md:124`：不进会话事件流，避免出现在对话里），与"给**用户**看的步骤展示"目的不同。相同的是字段设计，不同的是数据来源（一个模型自述、一个从事件流投影）。
5. **风险提示**：codex 提示词 :119 明确禁止用 `echo "===="` 串命令——这类噪声会直接劣化步骤行摘要。若第五档按工具参数提取摘要，要用结构化字段，别解析命令行文本。

---

## 7. 未覆盖 / 存疑

- 只读了 `gpt-6.1-sol` 全文（173 行）与 `gpt-6-sol` / `gpt-6-luna` 的小节标题；`gpt-6-astra` 两份与 `gpt-6.1-sol.zh.md` 只看了标题，未逐字比对（`INDEX.md:26-34` 已给出差异摘要，可信但未复核）。
- `.ref-dsh-compact-codex/lib/client.js`（229 行）只读了 `how-it-works.md` 对它的描述，与 `preview-handoff.html` 里复制的 CSS，**未逐行读源码**。slot 机制细节归 task-2。
- `lib/index.js`（1615 行）未读，注入时点（`how-it-works.md:99-107`）仅在文档层面转述。
- `WorkBuddyWorkSpace/个人简介/` 6 份文档未读正文，只从 `MEMORY.md` 摘要判断与步骤展示无关；若 lead 认为其中"工作方式"文档对步骤编排有参考价值，需另行指派。
