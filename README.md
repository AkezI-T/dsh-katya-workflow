# dsh-katya-workflow

Katya 工作流编排插件：为 DeepSeek Harness 提供一个从文件加载人格的 agent 预设，并为工作步骤提供更细的展示档位。

## 特性

- **人格与配置分离**。人格正文存放在 `persona.md`，由包内插件读取后注册为 `deployment:persona-prefix` 提示词段。修改人格只需编辑该文件并重启，不触碰 YAML。
- **提供 `Katya` 预设**。人格、PTC 呈现与 Agent Teams 协作面在同一预设内，工具面沿用 `katya-ptc` 的接线。
- **可随时卸载**。移除 bundle 行并重启后，原生渲染与默认预设原样恢复，不残留会话数据。

## 安装

在本目录执行：

```bash
dsh plugin --profile desktop add link:<本目录绝对路径>
```

或手工写入：在目标 profile 的 `package.json` 中把本包加入 `dependencies`（`link:<路径>`）与 `dsh.profile.bundles`，随后在该 profile 目录执行 `pnpm install`。

bundle 行在进程启动时加载，**安装或修改后需重启 DSH**，预设列表才会出现变更。

## 文件结构

| 文件 | 职责 |
|---|---|
| `persona.md` | 人格正文，注册为提示词前缀段 |
| `persona-file.mjs` | 读取 `persona.md`，向 `ctx.systemPrompt` 注册 persona 段 |
| `cordis.patch.yml` | 预设声明与插件行 |
| `locale/` | 插件列表中显示的名称与简介 |
| `package.json` | 包元信息、图标与 bundle patch 入口 |

## 预设

`Katya`（`id: katya-workflow`，order 13）。人格文本来自 `persona.md`；呈现模式为 PTC；兼容 Agent Teams 协作面。

## 开发状态

工作步骤的第五档展示（平铺但压缩的动作行）尚未实现。当前版本只提供人格加载与预设接线。

## 许可

MIT，见 [LICENSE](LICENSE)。
