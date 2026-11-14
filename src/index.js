/**
 * Katya Steps host half.
 *
 * This row exists so the package is a Loader entry: the browser half is
 * discovered from entries whose package declares `dsh.client`, so a client
 * bundle without a host row never reaches the start graph.
 *
 * It also carries the package's prompt contribution: the tool-description
 * convention is registered from here, at profile scope, so it reaches every
 * agent on the profile — whatever preset that agent runs — instead of being
 * tied to the Katya persona. A preset's own wording still shadows this one
 * when it registers the same section name.
 */

/** Loader identity used by diagnostics and by the browser-half scan. */
import { Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export const name = 'katya'

/** Host-persisted user policy; no agent tool can edit these fields. */
export const Config = z.object({
  memberProvider: z.string().default('').volatile(),
  memberModel: z.string().default('').volatile(),
  memberReasoningEffort: z.string().default('').volatile(),
  memberMaxTokens: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(0).volatile(),
})

class KatyaMemberModels extends Service {
  constructor(ctx, config) {
    super(ctx, 'katyaMemberModels')
    this.config = config
  }

  async options(signal) {
    const provider = this.config.memberProvider.get().trim()
    const model = this.config.memberModel.get().trim()
    const reasoningEffort = this.config.memberReasoningEffort.get().trim()
    const maxTokens = this.config.memberMaxTokens.get()
    if (!provider || !model) throw new Error('LeaderPro: configure the maid team model in Settings → Katya before starting a member.')
    if (!Number.isSafeInteger(maxTokens) || maxTokens < 0) throw new Error('LeaderPro: maximum output tokens must be a positive integer or the model default.')
    // Explicit undefined clears parent-owned values even when the route is unchanged.
    const options = { provider, model, reasoningEffort: reasoningEffort || undefined, maxTokens: maxTokens || undefined }
    const llm = this.ctx.get('llm')
    if (!llm) throw new Error('LeaderPro: the model service is unavailable.')
    const resolved = await llm.resolveCallConfig(options, signal)
    return { ...options, ...resolved }
  }
}

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt']

/** Section name; a preset can shadow it by registering the same name. */
const DESCRIPTION_SECTION = 'katya:tool-description'

/**
 * The convention: the description is display copy, written in the language the
 * reader is using, not in whatever language the tool names and code happen to be.
 */
const DESCRIPTION_RULE = [
  '**【动作说明】** 每次调用工具，`description` 字段用一句 **Master 使用的语言** 写清这一步要办成什么。写“要达成什么”，不写“操作了哪个对象”；方式与原因可照实写，手段具体无妨，但目标必须让人一眼读懂，只有过程与缘由、没有目标的说明不合格。用日常语言，不堆内部术语。',
  '**`description` 跟随 Master 使用的语言。** 工具名是英文、代码是英文、上下文是英文，都不构成改用英文的理由。该字段是给人看的展示文案，不是给机器读的参数。'
].join('\n\n')

/**
 * Register the convention immediately before the per-tool sections, where it
 * reads as a rule about tool calls rather than part of the persona.
 * @param ctx - the profile-scope context this row mounts in.
 */
export function apply(ctx, config) {
  ctx.plugin(KatyaMemberModels, config)
  ctx.effect(function () {
    return ctx.systemPrompt.section({
      name: DESCRIPTION_SECTION,
      order: ctx.systemPrompt.getSectionOrder('FILE_REFERENCE') + 1,
      text: DESCRIPTION_RULE
    })
  }, 'katya: tool description language')
}
