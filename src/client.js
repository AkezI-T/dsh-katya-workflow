/**
 * Katya Steps — browser half.
 *
 * Two contributions, both reversible by removing the bundle row:
 *
 *   1. `tool.call.toolview` key `run_code` — one line "Run code · <description>".
 *      The official subcall container stays untouched; it is only hidden while
 *      the row is collapsed. A settling call folds its children automatically.
 *   2. `settings.general.item` id `transcript-view` — the official work-details
 *      row with a fifth choice, "Step summary", which pins the official mode to
 *      `verbose` so no Turn-level folding hides the steps.
 *
 * The fifth choice is stored in browser-local storage; every other value is
 * written to the `ui-chat` settings namespace through the documented
 * cross-namespace form service.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-katya-workflow',
  factory: function (require) {
    'use strict'

    var React = require('react')
    var primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    var h = React.createElement

    var NS = 'katyaSteps'
    var CHAT_NS = 'ui-chat'
    var STEPS = 'steps'
    var STORAGE_KEY = 'katya-steps.mode'
    var OFFICIAL_MODES = ['compact', 'standard', 'detailed', 'verbose']

    var zh = {
      'mode.title': '工作步骤展示',
      'mode.description': '选择希望看到多少工具调用细节',
      'mode.compact': '简洁',
      'mode.standard': '标准',
      'mode.detailed': '详细',
      'mode.steps': '步骤摘要',
      'mode.verbose': '完全展开',
      'collapse.title': '工作步骤收起时机',
      'collapse.description': '选择何时自动收起工作步骤',
      'collapse.completion': '回答结束后',
      'collapse.nextInput': '下次有新消息时',
      'replies.title': '收起后显示的回复',
      'replies.description': '工作步骤收起后，保留哪些助手回复',
      'replies.all': '全部回复',
      'replies.final': '仅最终回答',
      'tool.code': '运行代码',
      'tool.failedUnit': '失败',
      'cat.read': '读取文件',
      'cat.image': '读取图片',
      'cat.search': '搜索',
      'cat.write': '写入文件',
      'cat.edit': '编辑文件',
      'cat.command': '运行命令',
      'cat.code': '运行代码',
      'cat.web': '网页',
      'cat.subagent': '子代理',
      'cat.tool': '工具'
    }

    var en = {
      'mode.title': 'Work details',
      'mode.description': 'Choose how much detail to show for tool calls',
      'mode.compact': 'Compact',
      'mode.standard': 'Standard',
      'mode.detailed': 'Detailed',
      'mode.steps': 'Step summary',
      'mode.verbose': 'Verbose',
      'collapse.title': 'When to Collapse Work Details',
      'collapse.description': 'Choose when to automatically collapse work details',
      'collapse.completion': 'On completion',
      'collapse.nextInput': 'On next message',
      'replies.title': 'Replies After Collapse',
      'replies.description': 'Choose which assistant replies stay visible when work details collapse',
      'replies.all': 'All replies',
      'replies.final': 'Final answer only',
      'tool.code': 'Run code',
      'tool.failedUnit': 'failed',
      'cat.read': 'read',
      'cat.image': 'read image',
      'cat.search': 'search',
      'cat.write': 'write',
      'cat.edit': 'edit',
      'cat.command': 'command',
      'cat.code': 'code',
      'cat.web': 'web',
      'cat.subagent': 'subagent',
      'cat.tool': 'tool'
    }

    var CSS = [
      '.ks-root { display: block; }',
      '.ks-row { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; margin: 0 -4px; padding: 0 4px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; line-height: 24px; }',
      '.ks-row:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, .08)); }',
      '.ks-lead { flex: none; display: inline-flex; align-items: center; color: var(--dsw-alias-label-tertiary); }',
      '.ks-title { flex: none; font-size: var(--dsh-content-font-size-secondary, 13px); color: var(--dsw-alias-label-primary); }',
      '.ks-sep { flex: none; width: 2px; height: 2px; border-radius: 1px; background: var(--dsw-alias-label-caption); }',
      '.ks-summary { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--dsh-content-font-size-secondary, 13px); color: var(--dsw-alias-label-secondary); animation: ks-fade-in 140ms ease-out; }',
      '@keyframes ks-fade-in { from { opacity: 0; } to { opacity: 1; } }',
      '.ks-count, .ks-dur { flex: none; font-size: 11px; color: var(--dsw-alias-label-tertiary); }',
      '.ks-state { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); }',
      '.ks-state[data-state="running"] { background: var(--dsw-alias-state-business-primary, #4176e6); animation: ks-pulse 1.4s ease-in-out infinite; }',
      '.ks-state[data-state="error"] { background: var(--dsw-alias-state-error-primary, #d9534f); }',
      '.ks-failed { flex: none; font-size: 11px; color: var(--dsw-alias-state-error-primary, #d9534f); }',
      '@keyframes ks-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }',
      '.ks-chev { flex: none; display: inline-flex; align-items: center; color: var(--dsw-alias-label-tertiary); transition: transform .15s ease; transform: rotate(-90deg); }',
      '.ks-chev[data-open], .ks-root[data-ks-state="running"] .ks-chev { transform: rotate(0deg); }',
      '.ks-body { margin: 2px 0 6px 20px; }',
      '.ks-code, .ks-output { margin: 4px 0; padding: 6px 8px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, .08)); font-family: var(--ds-font-family-code, monospace); font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; height: 120px; max-height: 120px; overflow: auto; }',
      '.ks-output[data-error] { color: var(--dsw-alias-state-error-primary, #d9534f); }',
      '.ks-pref { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 0; }',
      '.ks-pref-text { min-width: 0; }',
      '.ks-pref-title { font-size: 13px; color: var(--dsw-alias-label-primary); }',
      '.ks-pref-desc { margin-top: 2px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }',
      '.ks-selector { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid var(--dsw-alias-line-secondary, rgba(127, 127, 127, .24)); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }'
    ].join('\n')

    function trimTo(text, limit) {
      var value = String(text == null ? '' : text).trim()
      return value.length > limit ? value.slice(0, limit - 1).trimEnd() + '…' : value
    }

    function readArg(args, key, limit) {
      if (!args) return ''
      try {
        if (typeof args.has === 'function' && !args.has(key)) return ''
        if (typeof args.textPrefix === 'function') {
          var prefix = args.textPrefix(key, limit)
          if (typeof prefix === 'string' && prefix !== '') return trimTo(prefix, limit)
        }
        var value = typeof args.value === 'function' ? args.value(key) : undefined
        if (typeof value === 'string') return trimTo(value, limit)
      } catch (error) {
        return ''
      }
      return ''
    }

    // Whether a string field has finished arriving. A host without the check keeps
    // the previous behaviour, since every other reader tolerates a growing value.
    function argComplete(args, key) {
      if (!args || typeof args.complete !== 'function') return true
      try {
        return args.complete(key) === true
      } catch (error) {
        return true
      }
    }

    function contentText(content, limit) {
      if (!Array.isArray(content)) return ''
      var parts = []
      for (var index = 0; index < content.length; index += 1) {
        var item = content[index]
        if (item && typeof item.text === 'string' && item.text.trim() !== '') parts.push(item.text)
      }
      return trimTo(parts.join('\n'), limit)
    }

    function normalizeView(value) {
      if (value === 'normal' || value === 'expanded') return 'detailed'
      for (var index = 0; index < OFFICIAL_MODES.length; index += 1) {
        if (OFFICIAL_MODES[index] === value) return value
      }
      return 'detailed'
    }

    var CATEGORY_BY_NAME = {
      read: 'cat.read',
      read_image: 'cat.image',
      grep: 'cat.search',
      glob: 'cat.search',
      write: 'cat.write',
      edit: 'cat.edit',
      apply_patch: 'cat.edit',
      bash: 'cat.command',
      pwsh: 'cat.command',
      exec_command: 'cat.command',
      write_stdin: 'cat.command',
      run_code: 'cat.code',
      web_search: 'cat.web',
      web_fetch: 'cat.web',
      subagent: 'cat.subagent'
    }

    function categoryOf(name) {
      if (typeof name !== 'string' || name === '') return 'cat.tool'
      var direct = CATEGORY_BY_NAME[name]
      if (direct !== undefined) return direct
      if (name.indexOf('terminal_') === 0) return 'cat.command'
      if (name.indexOf('subagent_') === 0) return 'cat.subagent'
      if (name.slice(-8) === '_inspect') return 'cat.search'
      return 'cat.tool'
    }

    function summarizeSubCalls(subCalls, t) {
      var groups = []
      var indexByKey = {}
      for (var index = 0; index < subCalls.length; index += 1) {
        var child = subCalls[index]
        var key = categoryOf(child && child.name ? child.name : '')
        if (indexByKey[key] === undefined) {
          indexByKey[key] = groups.length
          groups.push({ key: key, count: 0, order: index })
        }
        groups[indexByKey[key]].count += 1
      }
      groups.sort(function (left, right) {
        return right.count - left.count || left.order - right.order
      })
      var parts = []
      for (var part = 0; part < groups.length && part < 4; part += 1) {
        parts.push(t(groups[part].key) + ' ' + groups[part].count)
      }
      return parts.join(' · ')
    }

    function prefersReducedMotion() {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      } catch (error) {
        return false
      }
    }

    function hasRunningAnimation(element) {
      return typeof element.getAnimations === 'function' && element.getAnimations().length > 0
    }

    function clearRevealStyles(element) {
      element.style.height = ''
      element.style.overflow = ''
      element.style.willChange = ''
    }

    function reveal(element, shown) {
      if (typeof element.animate !== 'function' || prefersReducedMotion()) {
        element.style.display = shown ? '' : 'none'
        return
      }
      if (hasRunningAnimation(element)) {
        element.getAnimations().forEach(function (animation) { animation.cancel() })
      }
      clearRevealStyles(element)
      element.style.display = ''
      var from = shown ? 0 : element.getBoundingClientRect().height
      var to = shown ? element.scrollHeight : 0
      if (Math.abs(to - from) < 2) {
        element.style.display = shown ? '' : 'none'
        return
      }
      element.style.overflow = 'hidden'
      element.style.willChange = 'height'
      element.style.height = from + 'px'
      var animation = element.animate(
        [{ height: from + 'px' }, { height: to + 'px' }],
        {
          duration: shown ? 200 : 280,
          easing: shown ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
      )
      animation.onfinish = function () {
        clearRevealStyles(element)
        element.style.display = shown ? '' : 'none'
      }
    }

    var SCRAMBLE_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/?的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质子'

    function scrambleText(value) {
      var text = String(value == null ? '' : value)
      var result = ''
      for (var index = 0; index < text.length; index += 1) {
        var char = text.charAt(index)
        result += char === ' ' ? char : SCRAMBLE_GLYPHS.charAt(Math.floor(Math.random() * SCRAMBLE_GLYPHS.length))
      }
      return result
    }

    function ScrambleText(props) {
      var target = props.text
      var state = React.useState(function () {
        return prefersReducedMotion()
          ? { text: target, blur: 0 }
          : { text: scrambleText(target), blur: 3 }
      })
      var frame = state[0]
      var setFrame = state[1]
      var settled = React.useRef(false)

      React.useEffect(function () {
        if (prefersReducedMotion() || settled.current) {
          setFrame({ text: target, blur: 0 })
          return
        }
        var startedAt = Date.now()
        var timer = setInterval(function () {
          var progress = Math.min(1, (Date.now() - startedAt) / 620)
          if (progress >= 1) {
            settled.current = true
            clearInterval(timer)
            setFrame({ text: target, blur: 0 })
            return
          }
          var revealed = Math.floor(target.length * progress)
          setFrame({
            text: target.slice(0, revealed) + scrambleText(target.slice(revealed)),
            blur: Math.max(0, 3 * (1 - progress))
          })
        }, 40)
        return function () { clearInterval(timer) }
      }, [target])

      return h('span', {
        className: props.className,
        style: frame.blur > 0.05 ? { filter: 'blur(' + frame.blur.toFixed(2) + 'px)' } : undefined
      }, frame.text)
    }

    function readFlag() {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === STEPS ? STEPS : 'official'
      } catch (error) {
        return 'official'
      }
    }

    var listeners = new Set()
    var flag = readFlag()
    var stepMode = {
      getSnapshot: function () { return flag },
      subscribe: function (listener) {
        listeners.add(listener)
        return function () { listeners.delete(listener) }
      }
    }

    function setFlag(next) {
      if (next === flag) return
      flag = next
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch (error) {
        return
      }
      listeners.forEach(function (listener) { listener() })
    }

    function RunCodeRow(props) {
      var block = props.block
      var t = props.t
      var folded = props.useStepMode(function (value) { return value === STEPS })
      var settled = block.kind === 'tool-result'
      var failed = settled === true && block.isError === true
      var subCalls = Array.isArray(block.subCalls) ? block.subCalls : []
      var count = subCalls.length

      var description = readArg(block.args, 'description', 200)
      var code = readArg(block.args, 'code', 6000)
      // The arguments stream in declaration order, so a running call carries the
      // code long before its description exists. Standing the code's first line in
      // for it would show that line and then swap once the real text arrives.
      if (description === '' && settled) description = trimTo(String(code).split('\n')[0] || '', 120)
      // A description that is still arriving would restart the reveal on every
      // chunk; hold it back until the field closes so the animation runs once,
      // over the text it was written for.
      if (description !== '' && !settled && !argComplete(block.args, 'description')) description = ''
      var output = settled ? contentText(block.content, 1600) : ''
      if (settled && output === '' && block.error) {
        output = trimTo(String(block.error.reason || block.error.name || ''), 1600)
      }
      var failedCalls = 0
      for (var callIndex = 0; callIndex < subCalls.length; callIndex += 1) {
        var child = subCalls[callIndex]
        if (child && child.kind === 'tool-result' && child.isError === true) failedCalls += 1
      }
      var breakdown = summarizeSubCalls(subCalls, t)
      var duration = ''
      if (settled && typeof block.callTime === 'number' && typeof block.time === 'number' && block.time >= block.callTime) {
        duration = Math.max(1, Math.round((block.time - block.callTime) / 1000)) + 's'
      }

      var statePair = React.useState(!settled)
      var open = statePair[0]
      var setOpen = statePair[1]
      var rootRef = React.useRef(null)

      React.useEffect(function () {
        if (!folded) return
        setOpen(!settled)
      }, [folded, settled])

      var bodyRef = React.useRef(null)
      var animatedRef = React.useRef(false)
      var previousRef = React.useRef({ open: open, folded: folded })

      React.useLayoutEffect(function () {
        var node = rootRef.current
        var body = bodyRef.current
        // The slot renderer wraps entries in a [data-slot] anchor, so the tool
        // row is an ancestor rather than the immediate parent.
        var host = node && typeof node.closest === 'function' ? node.closest('[data-chat-call-id]') : null
        var box = host ? host.querySelector('[data-subcalls]') : null
        var bodyShown = open
        var boxShown = !folded || open
        if (!animatedRef.current) {
          animatedRef.current = true
          if (body) body.style.display = bodyShown ? '' : 'none'
          if (box) box.style.display = boxShown ? '' : 'none'
          return
        }
        var previous = previousRef.current
        if (previous.open === open && previous.folded === folded) {
          if (body && !bodyShown && !hasRunningAnimation(body)) body.style.display = 'none'
          if (box && !boxShown && !hasRunningAnimation(box)) box.style.display = 'none'
          return
        }
        previousRef.current = { open: open, folded: folded }
        if (body) reveal(body, bodyShown)
        if (box) reveal(box, boxShown)
      }, [open, folded, count, settled])

      React.useLayoutEffect(function () {
        if (settled) return
        var body = bodyRef.current
        if (!body) return
        var blocks = body.querySelectorAll('.ks-code, .ks-output')
        for (var index = 0; index < blocks.length; index += 1) {
          blocks[index].scrollTop = blocks[index].scrollHeight
        }
      }, [code, output, settled, open])

      var state = failed ? 'error' : settled ? 'done' : 'running'
      var label = t('tool.code')

      return h('div', { ref: rootRef, className: 'ks-root', 'data-ks-state': state },
        h('button', {
          type: 'button',
          className: 'ks-row',
          'aria-expanded': open,
          onClick: function () { setOpen(!open) }
        },
          h('span', { className: 'ks-lead' }, h(primitives.IconCodeOutlineRegular, { size: 14 })),
          h('span', { className: 'ks-title' }, label),
          description === '' ? null : h('span', { className: 'ks-sep' }),
          description === '' ? null : h(ScrambleText, { className: 'ks-summary', key: 'filled', text: description }),
          failedCalls === 0 ? null : h('span', { className: 'ks-failed' }, String(failedCalls) + ' ' + t('tool.failedUnit')),
          breakdown === '' ? null : h('span', { className: 'ks-count' }, breakdown),
          duration === '' ? null : h('span', { className: 'ks-dur' }, duration),
          h('span', { className: 'ks-state', 'data-state': state }),
          h('span', { className: 'ks-chev', 'data-open': open || undefined },
            h(primitives.IconChevronDownOutlineRegular, { size: 12 })
          )
        ),
        h('div', { ref: bodyRef, className: 'ks-body' },
          code === '' ? null : h('pre', { className: 'ks-code' }, code),
          output === '' ? null : h('pre', { className: 'ks-output', 'data-error': failed || undefined }, output)
        )
      )
    }

    function Preference(props) {
      var pair = React.useState(false)
      var open = pair[0]
      var setOpen = pair[1]
      var buttonRef = React.useRef(null)
      var selector = h('button', {
        ref: buttonRef,
        type: 'button',
        className: 'ks-selector',
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: function () { setOpen(!open) }
      }, props.selectedLabel, h(primitives.IconChevronDownOutlineRegular, { size: 12 }))

      return h('div', { className: 'ks-pref' },
        h('div', { className: 'ks-pref-text' },
          h('div', { className: 'ks-pref-title' }, props.title),
          h('div', { className: 'ks-pref-desc' }, props.description)
        ),
        h(primitives.Menu, {
          open: open,
          onClose: function () { setOpen(false) },
          items: props.options,
          selectedId: props.value,
          onSelect: function (id) {
            setOpen(false)
            if (buttonRef.current) buttonRef.current.focus({ preventScroll: true })
            props.onSelect(id)
          },
          align: 'end',
          portal: true,
          anchor: selector
        })
      )
    }

    function StepDisplayRow(props) {
      var t = props.t
      var useForm = props.useForm
      var flagValue = props.useStepMode(function (value) { return value })
      var view = useForm(function (snapshot) { return snapshot.value ? snapshot.value.transcriptView : undefined })
      var timing = useForm(function (snapshot) { return snapshot.value ? snapshot.value.collapseTiming : undefined })
      var replies = useForm(function (snapshot) { return snapshot.value ? snapshot.value.foldedReplies : undefined })

      var mode = flagValue === STEPS ? STEPS : normalizeView(view)
      var modeOptions = ['compact', 'standard', 'detailed', STEPS, 'verbose'].map(function (id) {
        return { id: id, label: t('mode.' + id) }
      })
      var timingValue = timing === 'next-input' ? 'next-input' : 'completion'
      var timingOptions = [
        { id: 'completion', label: t('collapse.completion') },
        { id: 'next-input', label: t('collapse.nextInput') }
      ]
      var replyValue = replies === 'final' ? 'final' : 'all'
      var replyOptions = [
        { id: 'all', label: t('replies.all') },
        { id: 'final', label: t('replies.final') }
      ]
      var collapseLabel = timingValue === 'next-input' ? 'collapse.nextInput' : 'collapse.completion'

      return h(React.Fragment, null,
        h(Preference, {
          title: t('mode.title'),
          description: t('mode.description'),
          value: mode,
          selectedLabel: t('mode.' + mode),
          options: modeOptions,
          onSelect: function (id) { props.chooseStepMode(id) }
        }),
        timing === undefined ? null : h(Preference, {
          title: t('collapse.title'),
          description: t('collapse.description'),
          value: timingValue,
          selectedLabel: t(collapseLabel),
          options: timingOptions,
          onSelect: function (id) { props.setCollapseTiming(id) }
        }),
        mode !== 'verbose' && replies !== undefined ? h(Preference, {
          title: t('replies.title'),
          description: t('replies.description'),
          value: replyValue,
          selectedLabel: t('replies.' + replyValue),
          options: replyOptions,
          onSelect: function (id) { props.setFoldedReplies(id) }
        }) : null
      )
    }

    var inject = ['slots', 'locale', 'configForms']

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en })
      }, 'katya-steps: dictionaries')

      ctx.effect(function () {
        var tag = document.createElement('style')
        tag.dataset.plugin = 'katya-steps'
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () { tag.remove() }
      }, 'katya-steps: styles')

      ctx.effect(function () {
        return ctx.slots.inject('tool.call.toolview', function () {
          return ctx.slots.register({
            name: 'tool.call.toolview',
            key: 'run_code',
            priority: -1,
            locale: NS,
            inject: function () { return { hooks: { stepMode: stepMode } } }
          }, RunCodeRow)
        })
      }, 'katya-steps: run_code row')

      var form = ctx.configForms.get(CHAT_NS)

      function chooseStepMode(id) {
        if (id === STEPS) {
          setFlag(STEPS)
          void form.set('transcriptView', 'verbose')
          return
        }
        setFlag('official')
        void form.set('transcriptView', id)
      }

      ctx.effect(function () {
        return ctx.configForms.whileServed([CHAT_NS], function () {
          return ctx.slots.inject('settings.general.item', function () {
            return ctx.slots.register({
              name: 'settings.general.item',
              id: 'transcript-view',
              order: 12,
              priority: -1,
              locale: NS,
              inject: function () {
                return {
                  hooks: { stepMode: stepMode, form: form },
                  chooseStepMode: chooseStepMode,
                  setCollapseTiming: function (value) { void form.set('collapseTiming', value) },
                  setFoldedReplies: function (value) { void form.set('foldedReplies', value) }
                }
              }
            }, StepDisplayRow)
          })
        })
      }, 'katya-steps: settings row')
    }

    return { name: 'katya-steps', inject: inject, apply: apply }
  }
})
