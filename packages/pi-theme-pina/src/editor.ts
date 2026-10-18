/**
 * Input editor restyling: panel background, left accent bar, extra padding.
 *
 * Extends CustomEditor, the pi-recommended base for replacing the main editor
 * (preserves application shortcuts and agent controls). Structure:
 * - One accent-colored bar on the left edge. pi's border state machine is probed at render
 *   time: bash mode keeps its green signal on the bar, every other state (thinking ramp,
 *   default border) renders the accent.
 * - Panel background from the theme's userMessageBg token on every row. Deliberately not
 *   selectedBg: pi reuses that token for functional selection highlights (list pickers,
 *   scroll-to-bottom pill) that must stay visible against the terminal background.
 * - One blank panel row above and below the text. Horizontal padding is pinned to
 *   PAD_X: pi pushes the user's editorPaddingX setting into the editor through
 *   setPaddingX after creation and on settings changes, so that method is overridden
 *   to keep PAD_X.
 * - Text forced to #FFF: pi emits editor rows without a foreground, so text otherwise
 *   falls back to the terminal's default color. The userMessageText token provides the
 *   white (also colors user message bubbles in the transcript, same surface family).
 * - The top/bottom rules are suppressed unless they carry information (working
 *   status, scroll indicator), which CustomEditor.renderTopBorder embeds.
 * - One dim status row pinned to the panel's bottom edge: pi's footer model
 *   segment re-ordered to "model (provider) • level" — model name in
 *   userMessageText (#fff), provider parens and thinking level dim. The
 *   matching footer lives in src/footer.ts.
 * - A half-height bottom edge row after the status row: ▀ paints the panel
 *   color on the upper half of the cell only, halving the visual padding under
 *   the status row; the bar column caps with ▘ to match.
 */
import {
  CustomEditor,
  type ExtensionContext,
  type KeybindingsManager,
  type Theme,
} from '@earendil-works/pi-coding-agent'
import {
  stripTerminalSequences,
  truncateToWidth,
  visibleWidth,
  type TUI,
  type TuiMouseEvent,
} from '@earendil-works/pi-tui'

const PAD_X = 1
const PAD_Y = 0
const BAR = '▌'
const BAR_CAP = '▘'
const HALF_BLOCK = '▀'
const RESET_FG = '\x1b[39m'

class PinaEditor extends CustomEditor {
  private getCtx: () => ExtensionContext

  constructor(
    tui: TUI,
    theme: ConstructorParameters<typeof CustomEditor>[1],
    keybindings: KeybindingsManager,
    getCtx: () => ExtensionContext,
  ) {
    super(tui, theme, keybindings, { paddingX: PAD_X })
    this.getCtx = getCtx
  }

  /** Looked up per render so theme hot-reloads apply without invalidation. */
  private get currentTheme(): Theme {
    return this.getCtx().ui.theme
  }

  /** Piña pins horizontal padding; ignore the editorPaddingX setting pi pushes through here. */
  setPaddingX(): void {}

  /** Keep the border line only when it carries status or scroll info, not as decoration. */
  private informative(line: string, width: number): boolean {
    return stripTerminalSequences(line) !== '─'.repeat(width)
  }

  /**
   * pi swaps borderColor between the thinking ramp and bash-mode green at runtime, and the
   * assigned closures are opaque. Probe the current one: only the bash-mode function matches,
   * so that state keeps its green signal while everything else renders the accent.
   */
  private isBashBorder(): boolean {
    return this.borderColor(' ') === this.currentTheme.fg('bashMode', ' ')
  }

  protected renderTopBorder(width: number, hiddenLineCount: number): string {
    const border = super.renderTopBorder(width, hiddenLineCount)
    return this.informative(border, width) ? border : ''
  }

  protected renderBottomBorder(width: number, hiddenLineCount: number): string {
    const border = super.renderBottomBorder(width, hiddenLineCount)
    return this.informative(border, width) ? border : ''
  }

  /**
   * The footer's model segment, re-rendered as the panel's bottom row in the
   * order "model (provider) • thinking": model name in userMessageText, the
   * provider parens and thinking level dim. Provider parens drop when they do
   * not fit, then the text truncates. pi keeps the routed virtual model
   * internal to the session, so that suffix cannot be reproduced from the
   * extension API.
   */
  private statusLine(width: number): string {
    const ctx = this.getCtx()
    const model = ctx.model
    const name = model?.id || 'no-model'
    let suffix = ''
    if (model?.reasoning) {
      const level = ctx.thinkingLevel || 'off'
      suffix = level === 'off' ? ' • thinking off' : ` • ${level}`
    }
    const models =
      ctx.scopedModels.length > 0
        ? ctx.scopedModels.map((scoped) => scoped.model)
        : ctx.modelRegistry.getAvailable()
    let providerSuffix = ''
    if (model && new Set(models.map((m) => m.provider)).size > 1) {
      providerSuffix = ` (${model.provider})`
    }
    const avail = width - PAD_X
    let text = name + providerSuffix + suffix
    if (visibleWidth(text) > avail) text = name + suffix // drop provider parens first
    if (visibleWidth(text) > avail) text = truncateToWidth(text, avail, '')
    const shownName = text.slice(0, name.length)
    const shownRest = text.slice(name.length)
    const pad = ' '.repeat(Math.max(0, avail - visibleWidth(text)))
    return (
      ' '.repeat(PAD_X) +
      this.currentTheme.fg('userMessageText', shownName) +
      this.currentTheme.fg('dim', shownRest) +
      pad
    )
  }

  render(width: number): string[] {
    if (width < 6) return super.render(width)
    const inner = width - 1 // reserve the left bar column
    const theme = this.currentTheme
    const bg = theme.getBgAnsi('userMessageBg')
    // Full resets inside a line would end the panel background; restore it after each one.
    const panel = (line: string) =>
      theme.bg('userMessageBg', line.replaceAll('\x1b[0m', `\x1b[0m${bg}`))
    const blank = theme.bg('userMessageBg', ' '.repeat(inner))
    const bar = this.isBashBorder()
      ? theme.fg('bashMode', BAR)
      : theme.fg('accent', BAR)
    const textFg = theme.getFgAnsi('userMessageText')

    const out: string[] = []
    for (let i = 0; i < PAD_Y; i++) out.push(bar + blank)
    for (const line of super.render(inner)) {
      const pad = ' '.repeat(Math.max(0, inner - visibleWidth(line)))
      out.push(bar + panel(textFg + line + RESET_FG + pad))
    }
    out.push(bar + panel(this.statusLine(inner)))
    // Bottom edge: paint only the upper half of the cell so the padding under
    // the status row visually shrinks to half a line.
    const cap = this.isBashBorder()
      ? theme.fg('bashMode', BAR_CAP)
      : theme.fg('accent', BAR_CAP)
    out.push(
      cap +
        theme.style(HALF_BLOCK.repeat(inner), {
          fg: theme.colors.userMessageBg,
        }),
    )
    return out
  }

  handleMouse(event: TuiMouseEvent) {
    // Compensate for the bar column and the top padding row added in render().
    return super.handleMouse({
      ...event,
      y: event.y - PAD_Y,
      width: event.width - 1,
    })
  }
}

export { PinaEditor }
