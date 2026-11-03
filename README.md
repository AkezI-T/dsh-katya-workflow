# dsh-katya-workflow

Katya 工作流编排插件：为 DeepSeek Harness 提供两个从文件加载人格的 agent 预设（工作流编排与创造模式），并为工作步骤提供更细的展示档位。

## 特性

- **人格与配置分离**。人格正文存放在 `persona.md`，由包内插件读取后注册为 `deployment:persona-prefix` 提示词段。修改人格只需编辑该文件并重启，不触碰 YAML。
- **提供 `Katya` 与 `Katya-Creator` 两个预设**。前者是工作流编排面；后者在同一个人格上挂创造模式工具（运行时探查、插件管理、创造技能），可自行编写 DSH 插件与预设。
- **可随时卸载**。移除 bundle 行并重启后，原生渲染与默认预设原样恢复，不残留会话数据。

## 安装

在 DSH 里添加插件，输入本仓库地址 **`https://github.com/AkezI-T/dsh-katya-workflow`**（也接受本地目录）。依赖解析、挂载与 bundle 注册都由 DSH 完成，不需要手工改 profile 或预设。

重启 Host 后生效。

## 文件结构

| 文件 | 职责 |
|---|---|
| `persona.md` | 人格正文，注册为提示词前缀段 |
| `persona-file.mjs` | 读取 `persona.md`，向 `ctx.systemPrompt` 注册 persona 段 |
| `cordis.patch.yml` | `Katya` 预设的声明与插件行 |
| `katya-creator.patch.yml` | `Katya-Creator` 预设的声明与插件行 |
| `locale/` | 插件列表中显示的名称与简介 |
| `package.json` | 包元信息、图标与 bundle patch 入口 |

## 预设

| 预设 | `id` | order | 组合 |
|---|---|---|---|
| `Katya` | `katya-workflow` | 13 | 人格 + PTC 呈现 + Agent Teams 协作面，工具面沿用 `katya-ptc` 的接线 |
| `Katya-Creator` | `katya-creator` | 14 | `Katya` 的组合，加创造模式的三处增量 |

`Katya-Creator` 相对 `Katya` 的三处增量与官方 `cordis` 预设相对 `standard` 的增量一致：

- `tool-cordis`：只读查询运行中的 Host 与 Client API。
- `tool-plugin-manager`、`tool-plugin-market`：持久化 profile 变更；没有 `profileContext` 时这两行自动停用。
- `skill-filesystem.customSkillDirs`：挂载随安装版发布的四个创造技能（`agent-experience`、`cordis-plugin-development`、`editing-cordis-compositions`、`cordis-composition-reference`）。目录在挂载时从当前安装解析，取不到时技能目录为空，预设照常挂载。

两个预设共用 `persona.md`，改人格会同时作用到两者。预设只在 Host 启动时挂载，改动后需重启 Host 才会出现在预设列表里。

## 开发状态

工作步骤的第五档展示（平铺但压缩的动作行）尚未实现。当前版本只提供人格加载与预设接线。

## 许可

MIT，见 [LICENSE](LICENSE)。
