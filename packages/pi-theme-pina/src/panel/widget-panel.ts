import type {
  ExtensionContext,
  ExtensionWidgetOptions,
  Theme,
} from '@earendil-works/pi-coding-agent'
import type { Component, TUI, TuiMouseEvent } from '@earendil-works/pi-tui'
import { truecolorFg } from '../utils/ansi.ts'
import { DESIGN_TOKENS } from '../theme/design-tokens.gen.ts'
import { paintPanel } from './panel.ts'
import { createThemeSource } from '../theme/theme-source.ts'

type WidgetComponent = Component & { dispose?(): void }
type WidgetFactory = (tui: TUI, theme: Theme) => WidgetComponent
type SetWidgetFn = (
  key: string,
  content: string[] | WidgetFactory | undefined,
  options?: ExtensionWidgetOptions,
) => void

const PANEL_BG_TOKEN = 'toolPendingBg'
const TOP_ROWS = 1
const BAR_FG = truecolorFg(DESIGN_TOKENS.borderWidget)

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
  const theme = createThemeSource(getCtx)
  let innerLineCount = 0
  return {
    render(width: number): string[] {
      const lines = inner.render(Math.max(0, width - 1))
      innerLineCount = lines.length
      if (lines.length === 0) return lines
      return paintPanel(lines, width, {
        barFg: BAR_FG,
        bg: theme()?.getBgAnsi(PANEL_BG_TOKEN),
        edges: 'both',
        fit: 'pad',
        repaint: true,
      })
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
