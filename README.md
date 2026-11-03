# dsh-katya-workflow

Katya 工作流编排插件：为 DeepSeek Harness 提供两个从文件加载人格的 agent 预设（工作流编排与创造模式），以及一个可选的步骤摘要组件。

## 特性

- **人格与配置分离**。人格正文存放在 `persona.md`，由包内插件读取后注册为 `deployment:persona-prefix` 提示词段。修改人格只需编辑该文件并重启，不触碰 YAML。
- **提供 `Katya` 与 `Katya-Creator` 两个预设**。前者是工作流编排面；后者在同一个人格上挂创造模式工具（运行时探查、插件管理、创造技能），可自行编写 DSH 插件与预设。
- **Windows 上自带 `bash`**。官方的 `bash-sandbox` 执行器只在非 Windows 挂载，预设自带的同名工具经 `ctx.subprocess.spawn` 执行 Git Bash；可执行文件按本机探测（PATH 上的 `git` 推出的安装根 → Git for Windows 常见安装根 → PATH 上的 `bash`），配置里不写安装路径。探测全部落空时报错并给出补救方式，不会退回 pwsh 或 cmd。
- **提供 `Katya Steps` 步骤摘要组件**。在「工作步骤显示」里增加第五档：运行代码的子步骤在结算后自动收起。删掉挂载行并重启即回到官方渲染，不残留数据。
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
| `steps.patch.yml` | `Katya Steps` 组件的挂载行 |
| `src/index.js` → `lib/index.js` | 组件的 host 半边：空插件，只为让包进入 Loader |
| `src/client.js` → `lib/client.js` | 组件的浏览器半边：运行代码行与第五档设置行 |
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

- 官方档位被钉在「完全展开」，轮次不再整轮折叠，组头与粗粒度摘要不再出现；
- 每个 `run_code` 调用收成一行「运行代码 · 说明 · 读取文件 4 · 编辑文件 1」，子步骤在调用结算后自动收起；
- 展开后的代码框固定 120px 高，超出部分在框内滚动，运行中自动跟到最新；
- 说明文字以去噪式乱码动画浮现；
- 点一下可以展开看子步骤，下一次结算仍会收起；
- 其它工具行与回复内容保持官方渲染。

模式开关保存在浏览器本地存储，不写入 Host 设置文档；前四档照常写官方设置。

**已知限制**：「开始回复即折叠」「插话仍折叠」「折叠后滚到该轮用户消息」需要改动 `ui-chat`，不在本组件范围内。子步骤收起依赖 ui-tool 的 `[data-subcalls]` 容器，官方若改结构，表现是子步骤保持展开，不会报错。

## 开发

```sh
node tools/build.mjs       # 重新生成 lib/
node tools/check-bundle.mjs  # 校验浏览器半边的注册形状
```

`lib/` 入库：DSH 安装阶段不跑构建，从仓库地址安装时只有入库的产物才存在。

## 许可

MIT，见 [LICENSE](LICENSE)。`custom-bash.mjs` 移植自 xiaobright/dsh-anchored-standard（MIT），归属见 [NOTICE](NOTICE)。
