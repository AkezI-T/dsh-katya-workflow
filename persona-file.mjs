/**
 * Load this preset's persona from a file in the bundle.
 *
 * `@deepseek-ai/dsh-persona` registers `config.prefix` as the
 * `deployment:persona-prefix` section. This row registers the same section but
 * reads its text from a file beside the module, so the persona stays an ordinary
 * document instead of a YAML block scalar.
 *
 * Section names are the registry's own; they are spelled here rather than
 * imported so the row needs no package beyond Cordis itself. A different name
 * would add a second persona instead of shadowing the deployment one, and the
 * registry rejects two registrations at one name.
 */

import { readFileSync } from 'node:fs'

/** Registry section that carries the agent persona prefix. */
const PERSONA_PREFIX_SECTION = 'deployment:persona-prefix'
/** Registry section that carries the agent persona suffix. */
const PERSONA_SUFFIX_SECTION = 'deployment:persona-suffix'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'katya-persona-file'

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt']

/**
 * Register the persona prefix and suffix sections for the mounting agent scope.
 * @param ctx - an agent scope context; mounting outside one collides with the
 *   registry's own persona registration and rejects.
 * @param config - `path`, resolved relative to this module, and an optional `suffix`.
 */
export function apply(ctx, config) {
  const file = new URL(config?.path ?? './persona.md', import.meta.url)
  const text = readFileSync(file, 'utf8')
  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_PREFIX_SECTION,
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
    text,
  }), 'katya-persona.prefix')
  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_SUFFIX_SECTION,
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX'),
    text: config?.suffix ?? '',
  }), 'katya-persona.suffix')
}
