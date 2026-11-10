# dsh-katya-workflow

Katya 工作流编排插件：为 DeepSeek Harness 提供两个从文件加载人格的 agent 预设（工作流编排与创造模式），以及两个可选的聊天区组件（步骤摘要、回答结束后自动滚动到本轮问题）。

## 特性

- **人格与配置分离**。人格正文存放在 `persona.md`，由包内插件读取后注册为 `deployment:persona-prefix` 提示词段。修改人格只需编辑该文件并重启，不触碰 YAML。
- **提供 `Katya` 与 `Katya-Creator` 两个预设**。前者是工作流编排面；后者在同一个人格上挂创造模式工具（运行时探查、插件管理、创造技能），可自行编写 DSH 插件与预设。
- **Windows 上自带 `bash`**。官方的 `bash-sandbox` 执行器只在非 Windows 挂载，预设自带的同名工具经 `ctx.subprocess.spawn` 执行 Git Bash；可执行文件按本机探测（PATH 上的 `git` 推出的安装根 → Git for Windows 常见安装根 → PATH 上的 `bash`），配置里不写安装路径。探测全部落空时报错并给出补救方式，不会退回 pwsh 或 cmd。
- **提供 `Katya Steps` 步骤摘要组件**。在「工作步骤显示」里增加第五档：运行代码的子步骤在结算后自动收起。删掉挂载行并重启即回到官方渲染，不残留数据。
- **工具说明的语言约定随包注入**。`katya-steps` 那行在 profile 平面注册一段提示词，`description` 用 Master 使用的语言写。它不随预设走，任何预设的会话都收得到；人格里那句固定中文留在原处，是这一段缺席时的兜底。
- **提供「回答结束后自动滚动到本轮问题」组件**。回答结束时把这一轮的提问滑回视野顶部；只在读者仍停在末尾时触发，已经滚开去读别处就不打扰。开关在设置里的「Katya」页面，选择存在浏览器本地。
- **可随时卸载**。移除 bundle 行并重启后，原生渲染与默认预设原样恢复。

## 安装

在 DSH 里添加插件，输入本仓库地址 **`https://github.com/AkezI-T/dsh-katya-workflow`**（也接受本地目录）。依赖解析、挂载与 bundle 注册都由 DSH 完成，不需要手工改 profile 或预设。

重启 Host 后生效。

## 文件结构

| 文件 | 职责 |
|---|---|
| `persona.md` | 人格正文，注册为提示词前缀段 |
| `persona-file.mjs` | 读取 `persona.md`，向 `ctx.systemPrompt` 注册 persona 段 |
| `custom-bash.mjs` | Windows 的 `bash` 工具：按本机探测 Git Bash，注册与官方同名的工具 |
| `cordis.patch.yml` | `Katya` 预设的声明与插件行 |
| `katya-creator.patch.yml` | `Katya-Creator` 预设的声明与插件行 |
| `plugin.patch.yml` | 包的挂载行：客户端 bundle 的入口，步骤摘要与回跳都在里面 |
| `src/client.js` 中的 `KatyaSection` | 设置里的「Katya」页面：回复回跳的开关 |
| `src/index.js` → `lib/index.js` | 组件的 host 半边：让包进入 Loader，并注册工具说明的语言约定；两行挂载只注册一次 |
| `src/client.js` → `lib/client.js` | 组件的浏览器半边：步骤摘要行、回复回跳，以及两条设置行 |
| `tools/build.mjs` | 把 `src/` 复制为 `lib/` 并做语法检查 |
| `locale/` | 插件列表中显示的名称与简介 |
| `package.json` | 包元信息、图标、bundle patch 与 client 声明 |
| `NOTICE` | 移植代码的许可归属 |

## 预设

| 预设 | `id` | order | 组合 |
|---|---|---|---|
| `Katya` | `katya-workflow` | 13 | 人格 + PTC 呈现 + Agent Teams 协作面 |
| `Katya-Creator` | `katya-creator` | 14 | `Katya` 的组合，加创造模式的三处增量 |

`Katya-Creator` 相对 `Katya` 的三处增量与官方 `cordis` 预设相对 `standard` 的增量一致：

- `tool-cordis`：只读查询运行中的 Host 与 Client API。
- `tool-plugin-manager`、`tool-plugin-market`：持久化 profile 变更；没有 `profileContext` 时这两行自动停用。
- `skill-filesystem.customSkillDirs`：挂载随安装版发布的四个创造技能。目录在挂载时从当前安装解析，取不到时技能目录为空，预设照常挂载。

两个预设共用 `persona.md`，改人格会同时作用到两者。预设只在 Host 启动时挂载，改动后需重启 Host 才会出现在预设列表里。

shell 按平台分支：非 Windows 用官方 `tool-bash`，Windows 用包内的 `custom-bash.mjs`，`pwsh` 在 Windows 上作为需要 PowerShell 语义时的第二个 shell。持久终端（`terminal_*`）不由预设声明，来自 profile 侧挂载的 `dsh-background-terminal` bundle。

## Katya Steps

设置 → 通用 → 工作步骤显示，第五项「步骤摘要」：

- 默认使用官方「完全展开」；开启「完成后仅显示最终回复」时，改用官方「详细」的完成折叠规则；
- 每个 `run_code` 调用收成一行「运行代码 · 说明 · 读取文件 4 · 编辑文件 1」，子步骤在调用结算后自动收起；
- 展开后的代码框固定 120px 高，超出部分在框内滚动，运行中自动跟到最新；
- 说明文字以去噪式乱码动画浮现；
- 点一下可以展开看子步骤，下一次结算仍会收起；
- 其它工具行与回复内容保持官方渲染。

模式开关保存在浏览器本地存储，不写入 Host 设置文档；前四档照常写官方设置。

**已知限制**：「开始回复即折叠」「插话仍折叠」不在本组件范围内。子步骤收起依赖 ui-tool 的 `[data-subcalls]` 容器，官方若改结构，表现是子步骤保持展开，不会报错。

## 完成后仅显示最终回复

「设置 → Katya → 完成后仅显示最终回复」默认关闭。开启后，运行时仍可查看过程；回答结束时由官方机制收起工作步骤与中间回复，只保留最终回复，并留下可展开过程的入口。步骤摘要仍会渲染工具调用。

开关通过一次设置写入启用「详细 + 回答结束后收起 + 仅最终回答」，并保存原有三个字段的设置；关闭时恢复原值。手动更换工作步骤显示档位也会先退出此模式。已完成的历史轮次同样遵循这套显示规则。

## 回答结束后自动滚动到本轮问题

回答结束的那一刻，对话区滑回这一轮的提问，读的人从问题开头读起，而不是停在答案末尾。

- 触发信号是聊天区那颗「运行中」指示器消失，也就是这一轮真的结束；历史轮次没有这个指示器，不会误触发。
- 只有读者还在末尾（距离底部 120px 以内）才滑动，已经翻到别处的不打扰。
- 极短的一轮也不会漏：判定依据是指示器被移除这个事件，而不是先采样到它存在；会话切换同样会移除它，但那时没有滚动容器，不会误触发。
- 落点是这一轮的提问行，停在视口顶部留 12px。先通过宿主的阅读意图事件取消底部跟随动画，再交付滚动采样，完成一次回跳；系统开了「减少动态效果」时直接跳到位。
- 等官方折叠标记清除、位置、内容高度与问题落点连续稳定 300ms 后再开始滚动，最多等待 1600ms。滚轮、触摸、指针或键盘操作会取消等待和回跳；切换会话、新一轮开始、关闭功能或卸载插件后，旧任务随即失效。

在「设置 → Katya → 回答结束后自动滚动到本轮问题」里可以关掉；下方的「自动滚动时长」提供 0.4、0.7、1、1.4、2 秒五档，默认 1 秒，时间越长滑动越慢。选择存在浏览器本地存储。工作步骤摘要仍留在官方「工作步骤显示」那一行里，不在这个页面上。

## 开发

```sh
node tools/build.mjs       # 重新生成 lib/
node tools/check-bundle.mjs  # 校验浏览器半边的注册形状
node tools/check-behaviour.mjs  # 桩 DOM 跑行为：槽、偏好、回跳、两行渲染
```

`lib/` 入库：DSH 安装阶段不跑构建，从仓库地址安装时只有入库的产物才存在。

## 许可

MIT，见 [LICENSE](LICENSE)。`custom-bash.mjs` 移植自 xiaobright/dsh-anchored-standard（MIT），归属见 [NOTICE](NOTICE)。
