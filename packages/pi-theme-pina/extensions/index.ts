import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent'
import { PinaEditor } from '../src/panel/editor.ts'
import { PinaFooter } from '../src/footer/footer.ts'
import { installDeferredCellSizeQuery } from '../src/compat/ghostty-cell-size-query.ts'
import { thinkingQuote } from '../src/reply/thinking-quote.ts'
import { installUserMessageBorder } from '../src/panel/user-message-border.ts'
import { createReplyEmphasis } from '../src/reply/reply-emphasis.ts'
import { createThemeSource } from '../src/theme/theme-source.ts'
import { routeTransformers } from '../src/reply/transform-router.ts'
import { installWidgetPanel } from '../src/panel/widget-panel.ts'

export default function (pi: ExtensionAPI) {
  let ctx: ExtensionContext | undefined
  const themeSource = createThemeSource(() => ctx)
  installUserMessageBorder(themeSource)
  installDeferredCellSizeQuery()
  const replyEmphasis = createReplyEmphasis(themeSource)
  pi.registerMarkdownTransformer(
    routeTransformers({
      'assistant-thinking': thinkingQuote,
      assistant: replyEmphasis,
    }),
  )
  pi.on('session_start', (_event, context) => {
    ctx = context
    if (context.mode !== 'tui') return
    installWidgetPanel(() => ctx)
    context.ui.setEditorComponent(
      (tui, theme, keybindings) =>
        new PinaEditor(tui, theme, keybindings, () => context),
    )
    context.ui.setFooter(
      (tui, _theme, footerData) =>
        new PinaFooter(tui, () => context, footerData),
    )
  })
}
