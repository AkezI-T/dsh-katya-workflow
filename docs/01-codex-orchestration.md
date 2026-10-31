# codex 系统提示词与工作流程编排

准备项 1 的输入材料。事实均指向可复核的行号；推断单独标注。

## 一、提示词的真身

来源不是文档，是从 `codex.exe` 内嵌模型目录抽出的原文：

```
F:/Agent WorkSpace/DeepSeekHarnessWorkspace/codex-reply-style/gpt6-embedded-prompts/
  desktop-0.162.0-alpha.17.2__gpt-6.1-sol.md     173 行，主件
  _provenance.json                              二进制偏移与 sha
  _diff__gpt-6.1-sol__vs__gpt-6-sol.txt         同代模型逐行差异
```

字段路径 `models[].model_messages.instructions_template`。桌面版 0.162 已无 `base_instructions` 字段。

八个一级节：

| 行 | 节 |
|---|---|
| 1 | 身份定义 |
| 3 | When to ask the user for permission |
| 15 | Autonomy and persistence |
| 27 | Personality（31 Writing style / 47 Technical communication / 55 Writing PR descriptions） |
| 61 | Working with the user（75 Intermediate commentary / 85 Final answer / 89 Formatting / 104 Visualizations） |
| 114 | Rules for getting work done |
| 130 | Using skills |
| 154 | Apps (Connectors) |
| 161 | Plugins |

## 二、它没有「工作流程编排」

全文 grep `plan|todo|step|progress` 只命中散文句，没有 plan / todo / checklist 小节。

codex 的编排不在任务结构上，在**对话节奏**上。可提炼六条：

1. **双通道**（:63-65）。`commentary` 承担过程更新，`final` 收口。:81 是核心：final 必须完全自包含，因为 commentary 在 final 之后会被折叠。过程可见、终结即折叠——这是一条展示语义，不是新消息通道。
2. **过程更新有硬节奏**（:79）。要调工具就先发一条 commentary；持续工作中不得超过 60 秒没有更新。
3. **自主持久循环**（:17-25）。继续是默认，停止需要理由。用户说 "can you…/I want to…/help me…" 即视为干活指令；不停在确认能力、提计划或表示可以继续。
4. **权限闸门后置**（:5-13）。先把已授权且能让方案具体可评审的工作全部做完，让批准成为最后一步。
5. **中途消息即转向**（:69）。新消息默认修正当前任务，不替换目标。
6. **压缩即续接**（:71-73）。压缩不是任务结束；不从头重来、不重做已完成的工作、不重复已发过的 commentary。

## 三、DSH 的对应能力

| codex 概念 | DSH 现状 | 差距 |
|---|---|---|
| commentary / final 双通道 | 无显式通道。事后判定：最后一个 Step 中已结算、有可见内容、无工具调用块的回复即最终答案 | 同一件事，DSH 用判定代替声明 |
| final 后折叠 commentary | 整轮折叠 + 折叠后保留的回复（全部 / 仅最终） | 语义已在，缺「过程可见度」的档位选择 |
| 60 秒节奏 | `schedule_create` 有 `every_seconds`/`cron`，到期作为普通 follow-up 消息进对话 | 是定时唤醒，不是空闲检测。照搬会每 60 秒硬踢一轮 |
| 自主持久、权限后置、转向、压缩续接 | `AGENTS.md` 已有等价条款 | 无需迁移，措辞层面收敛即可 |
| 任务账本 | 无。`.ref-dsh-compact-codex` 自行实现了 `ledger_append` + 四态（in_progress / done / superseded / blocked），done 必须给真实成功的 tool/result 编号作证据 | 需要自建 |

反过来，DSH 的编排能力 codex 一个都没有：`plan`（logged planning）、`todo_write`、`goal`、`workflow`、`ralph`、`subagent`、`agent-team`、`schedule`。

结论：不要照搬 codex 的编排结构，它没有结构可搬。要移植的是它的**过程可见性纪律**，补进 DSH 已有的编排体系。

## 四、三条落地路径

1. **提示词层**。`@deepseek-ai/dsh-system-prompt` 的 `personaPrefix`（顺序 0）或 agent 作用域贡献可注入，且遮蔽只影响该 agent。把 commentary 纪律改写成「中间输出说明假设、发现、决定、方向变化；重要节点必须更新」。
2. **机制层**。DSH 没有空闲检测。可选：不做（只靠提示词）、用 `turn/start`/`step/end` 事件做外部监督并注入提醒、或用 schedule 的固定速率近似。三种成本递增，效果都弱于 codex 的原生通道。
3. **展示层**。过程可见度的真正落点是 Chat 的折叠语义，即 `dsh-katya-workflow` 的第 3、4 项（步骤展示、收起时机）。

## 五、对 dsh-katya-workflow 的设计输入

- 第 1 项不产出运行时代码，产出一份可写进预设人格的**过程纪律文本**，以及一套**任务账本的数据模型**（复用 compact-codex 的四态 + 证据编号 + next_step）。
- 账本不是 codex 的东西，是 compact-codex 的发明。是否引入，取决于 Master 是否接受「agent 显式记账」这一额外工具面。
- 60 秒节奏在 DSH 里没有等价物，不建议强行模拟。

## 六、未验证

- 未在浏览器实测折叠行为，展示层结论来自源码与 README。
- 源码树 0.2.2-alpha.2 与运行版 0.2.1-rc.5 在设置字段上有漂移（后者无 `foldedReplies`），涉及展示层的判断需按运行版复核。
