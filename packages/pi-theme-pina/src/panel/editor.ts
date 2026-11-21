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
import { paintPanel } from './panel.ts'
import { createThemeSource } from '../theme/theme-source.ts'

const PAD_X = 1
const PAD_Y = 0
const RESET_FG = '\x1b[39m'

class PinaEditor extends CustomEditor {
  private getCtx: () => ExtensionContext
  private readonly themeSource: () => Theme | undefined

  constructor(
    tui: TUI,
    theme: ConstructorParameters<typeof CustomEditor>[1],
    keybindings: KeybindingsManager,
    getCtx: () => ExtensionContext,
  ) {
    super(tui, theme, keybindings, { paddingX: PAD_X })
    this.getCtx = getCtx
    this.themeSource = createThemeSource(getCtx)
  }

  private get currentTheme(): Theme {
    return this.themeSource() as Theme
  }

  setPaddingX(): void {}

  private informative(line: string, width: number): boolean {
    return stripTerminalSequences(line) !== '─'.repeat(width)
  }

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
    if (visibleWidth(text) > avail) text = name + suffix
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
    const inner = width - 1
    const theme = this.currentTheme
    const barFg = this.isBashBorder()
      ? theme.getFgAnsi('bashMode')
      : theme.getFgAnsi('accent')
    const textFg = theme.getFgAnsi('userMessageText')
    const lines: string[] = []
    for (let i = 0; i < PAD_Y; i++) lines.push(' '.repeat(inner))
    for (const line of super.render(inner)) {
      const pad = ' '.repeat(Math.max(0, inner - visibleWidth(line)))
      lines.push(textFg + line + RESET_FG + pad)
    }
    lines.push(this.statusLine(inner))
    return paintPanel(lines, width, {
      barFg,
      bg: theme.getBgAnsi('userMessageBg'),
      edges: 'bottom',
      fit: 'pad',
      repaint: true,
    })
  }

  handleMouse(event: TuiMouseEvent) {
    return super.handleMouse({
      ...event,
      y: event.y - PAD_Y,
      width: event.width - 1,
    })
  }
}

export { PAD_X, PinaEditor }
