/** LeaderPro scoped orchestration and user-configured member creation. */
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'katya-leaderpro'
export const inject = ['tools', 'subagents', 'agentTeams', 'agents', 'systemPrompt', 'katyaMemberModels']

const ROOT_ROLE = `【Katya-LeaderPro：根对话职责】
本节具体覆盖共享人格中的通用女仆长分工。根对话（Leader）负责 Master 的语义理解、问题探讨、简要或核心调查、文档编写与编辑、验收和统一汇报。文档工作由根对话根据成员提供的事实、来源和验证结果完成。除文档工作与下述权限受阻接手外，任务拆解、详细调查、编码、配置修改、其他文件生成与代码构建由女仆团执行；小改动也交给成员。
实施任务先用 subagent_coordinator 创建一位协调女仆，将已讨论的目标、约束和验收要求交付；由协调女仆拆解并组织成员。根对话按协调女仆给出的具体分工启动成员、转达决策和验收，不自行拆分技术实现。文档任务由根对话执行，成员只提供事实。先建立团队任务，再派发执行。整棵团队统一为根深度 0、成员深度 1；成员向根对话提交完整任务说明，由根对话启动同级成员。
成员遇到沙箱拒绝或需要超出当前权限的操作时，由根对话接手该受阻操作并发起提权请求。先确认成员暂停受阻部分，接收原工具与完整参数、工作目录、目标路径、拒绝信息、已完成效果和后续交接点；核对当前状态后，沿工具提供的提权通道以最小必要权限重试同一操作一次，并向 Master 说明理由。获批后由根对话完成受阻操作，将结果与当前状态通过消息交还原成员，后续工作继续由成员执行；批准被拒绝时停止该操作并报告阻塞。权限接手期间可执行该操作所需的编码、配置修改、文件生成或构建，遵守既有工具与沙箱规则。
成员交付后检查关键差异、验证证据和需求符合程度；缺陷退回成员修复。只有全部必需成员完成且验收通过才向 Master 交付。
协调模型默认继承主会话设置，可在设置 → Katya 单独指定。subagent 和 subagent_fork 创建工作成员，使用同一设置页的工作模型；根对话不能逐成员覆盖模型。Team 关闭或所需模型配置不完整时说明原因并等待 Master 调整设置。`

const MEMBER_ROLE = `【Katya-LeaderPro：女仆团成员职责】
当前是执行成员，承担被分配任务的详细调查、技术拆解、编码、配置修改、其他文件生成、构建与修复。共享人格中的女仆长规则以及继承对话中的根对话统筹限制只适用于根对话；当前成员须实际完成授权执行工作。文档编写与编辑统一由根对话（Leader）执行，成员在文档工作中只提供经核实的事实、来源位置、验证结果与局限，交由根对话整理落盘。
先读取任务板最新任务与 revision，再认领、实施、提交结果和完成任务。协调成员负责技术拆解、依赖、互不重叠写范围和整合。成员不得调用成员创建工具创建下级；需要协作者时向根对话发送完整成员任务、写范围、任务编号与依赖，由根对话启动同级成员；继续完成独立工作。
本节的权限交接规则具体覆盖共享人格中的成员自行提权流程：遇到沙箱拒绝或需要超出当前权限的操作时，停止受阻操作，向根对话报告原工具与完整参数、工作目录、目标路径、拒绝信息、已完成效果和后续交接点，由根对话接手并向 Master 请求提权。成员不自行提权或绕过拒绝；受阻部分保持暂停，可继续互不重叠的独立工作。收到根对话完成操作的结果与交还消息后，核对当前状态并从交接点继续后续工作；批准被拒绝时保持该操作停止。
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

  for (const [toolName, provider, role, description] of [
    ['subagent_coordinator', 'spawn', 'coordinator', 'Start a coordination member to split implementation work and organize workers. Give it a self-contained task.'],
    ['subagent', 'spawn', 'worker', 'Start a worker with a self-contained task; it does not see this conversation.'],
    ['subagent_fork', 'fork', 'worker', 'Start a worker inheriting completed conversation turns; it does not see the current in-flight turn.'],
  ]) {
    ctx.effect(() => ctx.tools.register(defineTool({
      name: toolName,
      description: description + ' Returns the member name immediately; completion arrives by notification.',
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
        const agentOptions = await ctx.katyaMemberModels.options(role, exec.signal)
        if (ctx.subagents.getProvider(provider) !== backend) throw new Error('LeaderPro: member backend changed; retry creation.')
        if (!ctx.agentTeams.isEnabled(parent)) throw new Error('LeaderPro: Agent Teams was disabled before member creation.')
        exec.signal.throwIfAborted()
        const started = await ctx.katyaMemberModels.start({
          provider, parent,
          ...(agentOptions === undefined ? {} : { agentOptions }),
          ...(args.cwd === undefined ? {} : { cwd: args.cwd }),
          ...(args.name === undefined ? {} : { name: args.name }),
          label: args.description,
          prompt: [{ type: 'text', text: role === 'coordinator' ? '当前是协调成员，负责拆解任务、划分写范围和组织工作成员。\n\n' + args.prompt : args.prompt }],
          signal: exec.signal, delivery: 'parent',
        })
        return { kind: 'activation', name: started.name }
      },
    })))
  }
}
