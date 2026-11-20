/**
 * Piña extension entry. Registers every TUI customization in one place so the
 * package can be enabled or disabled as a unit: input editor, status (footer
 * minus the model segment, which the editor pins inside its panel), extension
 * widgets (pi-subagents' async-agent status) as a spaced panel, and message
 * rendering as it lands: thinking blocks as quotes, assistant Markdown with
 * reply emphasis (src/reply-emphasis.ts). Pi allows one Markdown transformer
 * per extension, so the entry owns the single registration and dispatches by
 * message type. Each concern lives in its own src/ module.
 */
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
