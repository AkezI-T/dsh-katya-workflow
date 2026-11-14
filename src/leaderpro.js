/** LeaderPro scoped orchestration and user-configured member creation. */
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'katya-leaderpro'
export const inject = ['tools', 'subagents', 'agentTeams', 'agents', 'systemPrompt', 'katyaMemberModels']

const ROOT_ROLE = `【Katya-LeaderPro：根对话职责】
本节具体覆盖共享人格中的通用女仆长分工。根对话负责 Master 的语义理解、问题探讨、简要或核心调查、验收和统一汇报。任务拆解、详细调查、全部编码、配置修改、生成文件与所有代码构建由女仆团执行；小改动也交给成员。
先创建一位实施协调女仆，将已讨论的目标、约束和验收要求交付；由协调女仆拆解并组织成员。根对话只按协调女仆给出的具体分工启动成员、转达决策和验收，不自行拆分技术实现。先建立团队任务，再派发执行。宿主深度限制阻止协调女仆继续创建时，由根对话按其完整任务说明启动同级成员。
成员交付后检查关键差异、验证证据和需求符合程度；缺陷退回成员修复。根对话不写代码、不修改配置、不生成文件、不执行构建。只有全部必需成员完成且验收通过才向 Master 交付。
成员供应商、模型、推理强度与输出 Token 来自设置 → Katya，两个创建入口统一应用；根对话不能自行覆盖。Team 关闭或模型未配置时说明原因并等待 Master 调整设置。`

const MEMBER_ROLE = `【Katya-LeaderPro：女仆团成员职责】
当前是执行成员，承担被分配任务的详细调查、技术拆解、编码、配置修改、文件生成、构建与修复。共享人格中的女仆长规则以及继承对话中的根对话统筹限制只适用于根对话；当前成员须实际完成授权执行工作。
先读取任务板最新任务与 revision，再认领、实施、提交结果和完成任务。协调成员负责技术拆解、依赖、互不重叠写范围和整合；必要时创建其他成员。达到宿主深度上限时，向根对话发送完整成员任务、写范围、任务编号与依赖，由根对话启动同级成员；继续完成独立工作。
通过名称通信，重大契约与阻塞同时报告根对话和协调成员。提交最终差异、构建或检查证据与局限；仅剩等待时结束当前轮次，由通知继续工作。`

const TOOLS_WAIT_RULE = `【Katya-LeaderPro：根与成员共用工具及等待规范】
本节适用于 LeaderPro 根对话和全部成员，各自按上文职责执行。读取文本用 read（按需指定 offset/limit），按路径发现文件用 glob，搜索文件内容用 grep；不得用 shell 的 cat/head/tail/sed/find/rg 替代已有专用工具。手动修改文件用 write/edit；shell 用于职责范围内已授权的命令、构建、状态与检查。
wait_agent 每次 timeout_ms 最多 30000；单次等待返回后先处理已到达输入并推进独立工作。禁止连续轮询，禁止在 run_code 中用循环、Promise 链或反复 wait_agent 延长阻塞。仅剩等待成员结果或后续消息时，主动结束当前回合，由完成通知或新消息唤醒。
timedOut 只表示本次等待窗口到期，不代表成员失败，也不构成催报理由。模型请求卡住时，成员无法即时处理消息；等待请求结束并确认回合退出期间停止反复发送催报、暂停、结束或继续消息，已入队消息不可假定撤回。running 不证明可响应，inactive 不单独证明完成；确认请求结束且回合退出后，只发一条简短消息续跑原任务。团队消息不能终止卡住请求，真正取消仅在宿主取消工具实际存在且已获授权时使用。`

export function apply(ctx) {
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'katya:leaderpro-role',
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') + 1,
    text: ({ agent }) => `${agent?.session.header.origin === 'subagent' ? MEMBER_ROLE : ROOT_ROLE}\n\n${TOOLS_WAIT_RULE}`,
  }))
  const initialization = new WeakMap()
  const unflushed = new WeakSet()
  function initializeTeam(agent, signal) {
    const pending = initialization.get(agent)
    if (pending !== undefined) return pending
    // Selection is published inside Session.append; leave its publication stack before appending Team mode.
    const operation = Promise.resolve().then(async () => {
      if (ctx.agents.get(agent.id) !== agent || agent.session.header.origin === 'subagent') return
      const events = agent.session.ownEvents()
      const selected = events.filter(event => event.type === 'agent-preset/selected').at(-1)
      if (selected !== undefined && selected.data.agentPreset !== 'katya-leaderpro') return
      const mode = events.filter(event => event.type === 'team/mode').at(-1)
      if (mode !== undefined && (!unflushed.has(agent) || mode.data.enabled === false)) return
      unflushed.add(agent)
      await ctx.agentTeams.setEnabled(agent, true, signal)
      unflushed.delete(agent)
    })
    initialization.set(agent, operation)
    return operation
  }
  ctx.on('agent-preset/selected', (sessionId, agentPreset) => {
    const agent = ctx.agents.get(sessionId)
    if (agentPreset !== 'katya-leaderpro' || agent === undefined) return
    // This notification is not awaited; pre-step propagates persistence failure.
    void initializeTeam(agent).catch(() => {})
  }, { global: true })
  ctx.on('agent/created', async ({ agent, signal }) => {
    await initializeTeam(agent, signal)
  })
  // Blank-session preset selection does not announce agent/created again.
  // The selection microtask runs before its awaiting caller resumes; wait for persistence before admitting the step.
  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    try {
      await initializeTeam(agent, signal)
    } finally {
      initialization.delete(agent)
    }
    return next()
  })

  for (const provider of ['spawn', 'fork']) {
    const toolName = provider === 'spawn' ? 'subagent' : 'subagent_fork'
    ctx.effect(() => ctx.tools.register(defineTool({
      name: toolName,
      description: (provider === 'spawn'
        ? 'Start a maid team member with a self-contained task; it does not see this conversation.'
        : 'Start a maid team member inheriting completed conversation turns; it does not see the current in-flight turn.')
        + ' The user’s Katya settings determine its model and parameters. Returns its name immediately; completion arrives by notification. Use Team tasks and named messages to coordinate.',
      parameters: {
        cwd: { type: 'string', description: 'Initial working directory; omission inherits the caller’s directory.' },
        description: { type: 'string', required: true, description: 'Describe the task in the language Master uses.' },
        name: { type: 'string', description: 'Unique lower-case kebab-case member name; lead is reserved.' },
        prompt: { type: 'string', required: true, description: 'Task, boundaries, Team task id, dependencies and acceptance criteria.' },
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: {
          kind: { type: 'string', required: true, const: 'activation' },
          name: { type: 'string', required: true },
        } },
        render: (_args, value) => [{ type: 'text', text: `started subagent ${value.name}` }],
        presentationMeta: (_args, value) => ({ kind: value.kind, name: value.name }),
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const parent = exec.agent
        if (!parent) throw new Error('LeaderPro: a calling agent is required.')
        if (!ctx.agentTeams.isEnabled(parent)) throw new Error('LeaderPro: enable Agent Teams in the root session menu before starting a member.')
        const backend = ctx.subagents.getProvider(provider)
        if (!backend?.capabilities.agentOptions || !backend.prepareContinuable) throw new Error(`LeaderPro: ${provider} does not support configured local members.`)
        const agentOptions = await ctx.katyaMemberModels.options(exec.signal)
        if (ctx.subagents.getProvider(provider) !== backend) throw new Error('LeaderPro: member backend changed; retry creation.')
        if (!ctx.agentTeams.isEnabled(parent)) throw new Error('LeaderPro: Agent Teams was disabled before member creation.')
        exec.signal.throwIfAborted()
        const maxDepth = ctx.subagents.resolveMaxDepth()
        const started = await ctx.subagents.startActivation({
          provider, parent, agentOptions,
          ...(args.cwd === undefined ? {} : { cwd: args.cwd }),
          ...(args.name === undefined ? {} : { name: args.name }),
          ...(maxDepth === undefined ? {} : { maxDepth }),
          label: args.description,
          prompt: [{ type: 'text', text: args.prompt }],
          signal: exec.signal, delivery: 'parent',
        })
        return { kind: 'activation', name: started.name }
      },
    })))
  }
}
