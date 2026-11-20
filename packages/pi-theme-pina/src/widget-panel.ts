import type {
  ExtensionContext,
  ExtensionWidgetOptions,
  Theme,
} from '@earendil-works/pi-coding-agent'
import {
  visibleWidth,
  type Component,
  type TUI,
  type TuiMouseEvent,
} from '@earendil-works/pi-tui'
import { DESIGN_TOKENS } from './design-tokens.gen.ts'

type WidgetComponent = Component & { dispose?(): void }
type WidgetFactory = (tui: TUI, theme: Theme) => WidgetComponent
type SetWidgetFn = (
  key: string,
  content: string[] | WidgetFactory | undefined,
  options?: ExtensionWidgetOptions,
) => void

const PANEL_BG_TOKEN = 'toolPendingBg'
const TOP_ROWS = 1
const BAR = '▌'
const BAR_FOOT = '▖'
const BAR_CAP = '▘'
const HALF_BLOCK_LOWER = '▄'
const HALF_BLOCK = '▀'
const truecolorFg = (hex: string) =>
  `\x1b[38;2;${[1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16))
    .join(';')}m`
const BAR_FG = truecolorFg(DESIGN_TOKENS.borderWidget)
const RESET_FG = '\x1b[39m'
const FULL_RESET = '\x1b[0m'

export function installWidgetPanel(
  getCtx: () => ExtensionContext | undefined,
): void {
  const ui = getCtx()?.ui
  if (!ui || typeof ui.setWidget !== 'function') return
  const setWidget = ui.setWidget as SetWidgetFn
  const wrapped: SetWidgetFn = (key, content, options) => {
    if (typeof content !== 'function') {
      setWidget(key, content, options)
      return
    }
    setWidget(
      key,
      (tui, theme) => panelComponent(content(tui, theme), getCtx),
      options,
    )
  }
  ui.setWidget = wrapped
}

function panelComponent(
  inner: WidgetComponent,
  getCtx: () => ExtensionContext | undefined,
): WidgetComponent {
  let lastGoodTheme: Theme | undefined
  let innerLineCount = 0
  const currentTheme = (): Theme | undefined => {
    try {
      const theme = getCtx()?.ui.theme
      if (theme) {
        lastGoodTheme = theme
        return theme
      }
    } catch {
    }
    return lastGoodTheme
  }
  return {
    render(width: number): string[] {
      const innerWidth = Math.max(0, width - 1)
      const lines = inner.render(innerWidth)
      innerLineCount = lines.length
      if (lines.length === 0) return lines
      const bar = BAR_FG + BAR + RESET_FG
      const bg = currentTheme()?.getBgAnsi(PANEL_BG_TOKEN)
      const out: string[] = []
      out.push(edgeRow(bg, BAR_FOOT, HALF_BLOCK_LOWER, innerWidth))
      for (const line of lines) {
        if (!bg) {
          out.push(bar + line)
          continue
        }
        const pad = ' '.repeat(Math.max(0, innerWidth - visibleWidth(line)))
        out.push(
          bar +
            bg +
            line.replaceAll(FULL_RESET, FULL_RESET + bg) +
            pad +
            '\x1b[49m',
        )
      }
      out.push(edgeRow(bg, BAR_CAP, HALF_BLOCK, innerWidth))
      return out
    },
    invalidate(): void {
      inner.invalidate()
    },
    handleMouse(event: TuiMouseEvent) {
      const y = event.y - TOP_ROWS
      const x = event.x - 1
      if (y < 0 || y >= innerLineCount || x < 0) return undefined
      return inner.handleMouse?.({ ...event, x, y, height: innerLineCount })
    },
    dispose(): void {
      inner.dispose?.()
    },
  }
}

function edgeRow(
  bg: string | undefined,
  barGlyph: string,
  fillGlyph: string,
  innerWidth: number,
): string {
  if (!bg) return BAR_FG + barGlyph + RESET_FG
  return (
    BAR_FG +
    barGlyph +
    bg.replace('[48;', '[38;') +
    fillGlyph.repeat(innerWidth) +
    RESET_FG
  )
}
