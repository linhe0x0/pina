import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent'
import { PinaEditor } from '../src/editor.ts'
import { PinaFooter } from '../src/footer.ts'
import { installDeferredCellSizeQuery } from '../src/ghostty-cell-size-query.ts'
import { thinkingQuote } from '../src/thinking-quote.ts'
import { installUserMessageBorder } from '../src/user-message-border.ts'
import { createReplyEmphasis } from '../src/reply-emphasis.ts'
import { installWidgetPanel } from '../src/widget-panel.ts'

export default function (pi: ExtensionAPI) {
  let ctx: ExtensionContext | undefined
  installUserMessageBorder(() => ctx)
  installDeferredCellSizeQuery()
  const replyEmphasis = createReplyEmphasis(() => ctx)
  pi.registerMarkdownTransformer((markdown, context) =>
    context.messageType === 'assistant-thinking'
      ? thinkingQuote(markdown, context)
      : replyEmphasis(markdown, context),
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
