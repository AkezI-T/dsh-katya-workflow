# Katya Workflow

为 DeepSeek Harness 提供 Katya、Katya-Creator 与 Katya-LeaderPro 三个人格预设、工具步骤摘要，以及回答结束后的过程折叠和自动滚动。

包名：`@local/dsh-katya-workflow`，当前版本 **1.3.0**，面向 **DSH 0.2.2-rc.3**。

## 安装与开始使用

1. 在 DSH 的插件管理中添加仓库地址：<https://github.com/AkezI-T/dsh-katya-workflow>，也可以选择本地项目目录。
2. 安装或更新后，按 DSH 提示应用变更并重启 Host，再新建会话使用新的预设修订；已有会话继续使用启动时的修订。
3. 新建会话时选择 **Katya**、**Katya-Creator** 或 **Katya-LeaderPro**。普通 Katya 使用 `katya-workflow`；需要女仆长分工时，在会话开始前切换为 **Katya-LeaderPro**。
4. 使用 LeaderPro 前，在 **设置 → Katya → 女仆团模型** 中选择供应商和模型并保存。
5. 在 **设置 → 通用 → 工作步骤展示** 中选择 **步骤摘要**，启用工具调用的摘要显示。
6. 在 **设置 → Katya** 中调整过程折叠、自动滚动及滚动时长。

聊天显示功能随插件挂载，可用于当前 profile 下的其他预设；Katya 人格只应用于选择了对应预设的会话。

## 聊天显示

### 步骤摘要

入口：**设置 → 通用 → 工作步骤展示 → 步骤摘要**。

每个 `run_code` 工具调用显示为一条摘要，例如：

> 运行代码 · 检查配置并定位问题 · 读取文件 4 · 编辑文件 1

- 优先展示调用中的 `description`，附带子调用分类、耗时和失败数量。
- 运行时可查看代码与输出，单个内容框高度为 120px，超出部分在框内滚动。
- 调用结束后自动收起内容，点击摘要行可重新展开。
- 其他工具和回复内容沿用 DSH 的渲染方式。

选择步骤摘要时，官方显示档位使用“完全展开”，由插件负责单次工具调用的收起。开启下方的“完成后仅显示最终回复”后，则使用官方“详细”档位的整轮折叠规则，步骤摘要继续生效。

### 完成后仅显示最终回复

入口：**设置 → Katya → 完成后仅显示最终回复**，默认 **关**。

开启后，回答进行时仍可查看工作过程；回答结束时收起工作步骤和中间回复，保留最终回复及可展开过程的入口。已完成的历史轮次也遵循这套显示规则。

这个开关会一次应用三项官方设置：

| 设置 | 启用后的值 |
| --- | --- |
| 工作步骤展示 | 详细 |
| 工作步骤收起时机 | 回答结束后 |
| 收起后显示的回复 | 仅最终回答 |

开启前会保存这三项原有设置，关闭时恢复。启用期间，收起规则由该开关统一控制；手动更换工作步骤展示档位时，会先退出此模式，再应用新档位。

### 回答结束后自动滚动到本轮问题

入口：**设置 → Katya → 回答结束后自动滚动到本轮问题**，默认 **开**。

回答结束后，等待过程折叠及页面布局稳定，再将本轮最后一条问题滚动到对话区顶部下方约 12px 的位置。

- 只有仍停在对话末尾附近时才触发，已滚动到其他位置阅读时不自动定位。
- 等待或滚动期间，滚轮、触摸、指针或键盘操作会取消本次自动动作。
- 新一轮开始、切换会话、关闭功能或插件卸载后，旧滚动任务失效。
- 短回复按实际可用的滚动范围定位；空间不足时，问题可能无法贴近顶部，已经到达可滚动位置时则不再移动。
- 系统启用“减少动态效果”时直接定位。

**自动滚动时长**提供 **0.4、0.7、1、1.4、2 秒**五档，默认 **1 秒**。时间越长，滚动越慢。

### 设置保存位置

| 内容 | 保存位置 |
| --- | --- |
| 是否使用步骤摘要 | 浏览器本地存储 |
| 自动滚动开关与时长 | 浏览器本地存储 |
| “仅显示最终回复”的启用标记及原设置备份 | 浏览器本地存储 |
| 官方显示档位、收起时机、回复保留方式 | Host 用户设置 |
| LeaderPro 女仆团模型 | Host 插件配置 |

清除浏览器站点数据会清除本地偏好及备份。需要恢复此前的官方显示设置时，应先关闭“完成后仅显示最终回复”，再清理站点数据或卸载插件。

## 预设与人格

| 预设 | ID | 用途 |
| --- | --- | --- |
| Katya | `katya-workflow` | 日常编码与任务编排，使用 PTC 工具调用方式 |
| Katya-Creator | `katya-creator` | 在 Katya 基础上加入 DSH 运行时探查、插件管理及创作技能 |
| Katya-LeaderPro | `katya-leaderpro` | 女仆长负责讨论、核心调查与验收，女仆团负责拆解和实施；默认启用 Team |

三个预设共用 [persona.md](<persona.md>)。人格由 [persona-file.mjs](<persona-file.mjs>) 在挂载时读取；修改后重启 Host，使三个预设加载新的内容。LeaderPro 的根角色与成员角色由独立 Host 模块按运行角色补充提示。

PTC 将工具目录呈现为 `run_code` 与生成的 SDK，可在一段程序中组织调用、并行和错误处理。预设需要宿主提供 PTC 运行环境。

Katya 与 Katya-Creator 的普通协作使用宿主提供的 `subagent` / `subagent_fork`、`list_agents`、`send_message` 和 `wait_agent`。Agent Teams 任务板由宿主提供，在根会话菜单中按会话启用；LeaderPro 默认启用 Team。持久终端 `terminal_*` 来自另外挂载的终端插件。

Katya-Creator 的技能从当前 DSH 安装中解析，随安装版本提供。插件管理能力依赖 profile 上下文；该上下文不存在时，对应工具停用。

### LeaderPro 女仆团

LeaderPro 根角色（女仆长）负责语义理解、与 Master 讨论、简要核心调查和最终验收。女仆长先指派协调成员，由协调成员拆解任务、划分写范围并组织实施；任务拆解、编码、配置修改、文件生成和构建全部交给成员完成。执行成员与协调成员都承担实际工作，fork 继承上下文后也按成员角色执行。

LeaderPro 会话默认启用 Agent Teams。新建会话、开始前切换到 LeaderPro 或恢复会话时，Host 在没有已保存 Team 状态的情况下启用团队，并在首步执行前等待状态保存。已保存的显式关闭状态保持不变；关闭后需要从根会话菜单重新启用 Team 才能创建成员。职责提示随预设作用域生效，切换到其他预设后移除。

普通创建与 fork 都通过 LeaderPro 的委派入口创建成员，Host 按根或成员身份补充职责提示，并为整棵成员树应用统一模型设置。达到宿主允许的委派深度时，协调成员向根角色请求创建同级成员。共享任务板按“读取最新任务与 revision → 认领 → 执行 → 完成”协作；任务就绪或更新任务板后，仍需通过名称消息启动空闲成员。保存的任务与 Team 模式不表示旧成员名册或邮箱会恢复。

LeaderPro 的根与成员共用专用工具及等待提示：读取文本用 `read`，路径查找用 `glob`，内容搜索用 `grep`，手动修改用 `write` / `edit`；人工编辑采用小块修改，shell 承担职责范围内已授权的命令、构建、状态与检查。`wait_agent` 单次最多 30 秒，返回后处理输入并推进独立工作；禁止连续轮询或在 `run_code` 内用循环、Promise 链、反复等待延长阻塞。仅剩等待时结束回合，由通知或新消息唤醒；超时只表示等待窗口到期。职责、工具选择和等待纪律通过提示词约束生效，宿主工具的参数上限与执行权限仍由宿主决定。

共享人格还约定模型请求卡住时的通信纪律：`send_message` 回执只表示投递，`running` 不证明可响应，`inactive` 不单独证明完成。等待请求报错、超时或宿主取消并确认回合退出期间，停止反复发送催报、暂停、结束或继续消息；确认退出后只发一条简短消息续跑原任务。团队消息不能终止卡住请求，实际取消工具须存在且已获授权；未确认交接前不让替代成员并发写同一范围，已入队消息不可假定撤回。

在 **设置 → Katya → 女仆团模型** 中配置：

| 设置 | 默认值与作用 |
| --- | --- |
| 供应商 | 默认空，创建成员前必须选择 |
| 模型 | 默认空，创建成员前必须选择 |
| 推理强度 | 默认空，采用模型默认值；可选项取决于模型支持能力 |
| 最大输出 Token | 默认 `0`，采用模型默认值；自定义时填写正整数 |

供应商和模型来自 DSH 当前模型目录；目录为空时先在 DSH 模型设置中配置供应商。推理强度选项随模型能力变化，最大输出 Token 在界面中留空表示使用模型默认值。选择完成后点击 **保存女仆团模型**；**恢复已保存值**用于放弃当前草稿，模型目录加载失败时可使用 **重新加载模型**。

供应商或模型缺失时，创建成员会报错。设置保存到 Host 插件配置，仅用于 LeaderPro 后续新建成员，覆盖整棵成员树；已启动成员保持原配置，根对话模型由会话设置控制。LeaderPro 的 `subagent` / `subagent_fork` 创建参数不接受逐成员模型覆盖。

### Shell

Windows 使用包内 [custom-bash.mjs](<custom-bash.mjs>) 提供的 Git Bash 工具，需要本机安装 Git for Windows 或可用的 Bash。插件按本机环境探测可执行文件；Windows 专属操作可使用 PowerShell 工具。

非 Windows 平台使用官方 Bash 工具。

### 工具说明语言

插件在 profile 范围内注册工具说明约定：工具调用的 `description` 跟随 Master 使用的语言，并说明该步骤要达成的目标。此约定可用于当前 profile 下的其他预设。

## 开发

聊天界面与公共 Host 源文件位于 [src/client.js](<src/client.js>) 和 [src/index.js](<src/index.js>)，运行入口是 [lib/client.js](<lib/client.js>) 与 [lib/index.js](<lib/index.js>)。LeaderPro 独立模块位于 [src/leaderpro.js](<src/leaderpro.js>)，由构建生成运行入口 [lib/leaderpro.js](<lib/leaderpro.js>)。

在项目目录运行：

```
node tools/build.mjs
node tools/check-bundle.mjs
node tools/check-behaviour.mjs
node tools/verify-manifest.mjs
```

- **build**：同步源文件到运行产物，并检查 JavaScript 语法。
- **check-bundle**：检查浏览器模块的注册形状。
- **check-behaviour**：使用模拟 DOM 检查设置、摘要渲染及自动滚动行为。
- **verify-manifest**：列出运行入口、导出、预设 patch 和 locale JSON 的存在性与格式检查结果。

行为检查不启动真实浏览器，不能替代页面上的交互验证。修改客户端后需重新生成运行产物，并重新加载客户端脚本。[lib 产物](<lib/client.js>)随仓库提交，DSH 从仓库安装时不运行项目构建。

### 文件导航

| 文件 | 用途 |
| --- | --- |
| [cordis.patch.yml](<cordis.patch.yml>) | Katya 预设 |
| [katya-creator.patch.yml](<katya-creator.patch.yml>) | Katya-Creator 预设 |
| [katya-leaderpro.patch.yml](<katya-leaderpro.patch.yml>) | Katya-LeaderPro 预设 |
| [plugin.patch.yml](<plugin.patch.yml>) | 插件挂载入口，行 ID 为 `katya` |
| [src/client.js](<src/client.js>) | 步骤摘要、Katya 设置页与自动滚动 |
| [src/index.js](<src/index.js>) | Host 插件、LeaderPro 成员模型设置与工具说明语言约定 |
| [src/leaderpro.js](<src/leaderpro.js>) | LeaderPro 委派工具、角色提示与默认 Team |
| [package.json](<package.json>) | 包信息、导出和 bundle 声明 |
| [构建脚本](<tools/build.mjs>) | 生成运行产物 |
| [注册检查](<tools/check-bundle.mjs>) | 检查客户端模块注册 |
| [行为检查](<tools/check-behaviour.mjs>) | 本地模拟行为检查 |

## DSH 0.2.2-rc.3 适配

本包 1.3.0 面向 DSH 0.2.2-rc.3，三个预设均以官方 PTC 为基础。Katya-Creator 加入官方 Creator 的运行时探查、创作技能和插件管理入口；LeaderPro 通过独立 Host 模块提供成员职责、统一模型设置与默认 Team。

| 项目 | 1.3.0 行为 |
| --- | --- |
| PTC | 直接挂载 `@deepseek-ai/dsh-tool-executor-ptc` |
| 子代理模型 | Katya 与 Creator 使用 `modelSelection` / `modelDiscovery`；LeaderPro 使用设置中的统一成员模型 |
| 子代理中断 | 与官方一致设置 `interrupt: false` |
| Ralph | 由官方可选 `@deepseek-ai/dsh-experimental-ralph-bundle` 提供，普通长期任务使用 goal 工具 |
| Office | 三个预设均挂载 `tool-office`；加载 Office 技能后提供渲染、转换与重算工具 |
| Team | 使用名称通信；Katya 与 Creator 按根会话启用共享任务板，LeaderPro 默认启用 |
| Katya 定制 | 共享人格、Windows Git Bash、步骤摘要、完成后折叠和回复回跳 |

预设沿用官方 PTC 的通用 workflow 停用设置；Ralph bundle 独立提供自己的工作流引擎。Creator 的技能目录按官方表达式从当前安装解析。`applyPatch: false` 与官方保持一致。

运行依赖由 DSH 提供，manifest 声明 `@deepseek-ai/cordis ~4.1.0`、`@deepseek-ai/schemastery ~3.19.0` 与 `@deepseek-ai/dsh-tools 0.2.2-rc.3`。LeaderPro 依赖宿主的本地 spawn/fork、成员参数解析、Agent Teams、预设作用域及首步生命周期接口；升级 DSH 后需重新核对这些契约。

## 兼容边界

聊天显示功能依赖当前 DSH 的设置表单、界面扩展位置与聊天区结构。子调用收起和自动滚动使用宿主的 DOM 标记；DSH 升级后应重新检查这两项行为。

过程折叠沿用官方规则，受中途输入、异常结束及手动展开状态影响。现有行为检查覆盖部分模拟 DOM 行为；构建和冷检查不能验证真实页面交互、实际模型请求或女仆团的完整运行，也未建立 DSH 跨版本兼容保证。

## 许可

本项目使用 [MIT 许可](<LICENSE>)。[custom-bash.mjs](<custom-bash.mjs>) 源自 [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)，许可归属与移植范围见 [NOTICE](<NOTICE>)。
