/**
 * Widget panel: paint extension widgets on an elevated surface and give them
 * room to breathe.
 *
 * pi renders extension widgets (pi-subagents' "async subagent · background"
 * status, fleet status) as bare ANSI lines on the terminal canvas directly
 * above the input editor: no surface color, so live status text blends into
 * the transcript, and no gap, so the block sits flush against the editor's
 * panel. pi exposes no hook for either — widgets are opaque components owned
 * by the extension that set them — so this module wraps ctx.ui.setWidget (one
 * ExtensionUIContext instance is shared by every extension in a session) and
 * decorates the component each factory returns: every rendered line gets the
 * toolPendingBg surface (bg-tertiary, the recessed rung of the elevation
 * ladder — the editor's panel stays one rung above on bg-primary) across the
 * full width, re-applied after every embedded ANSI reset (the editor panel
 * uses the same technique), so the block reads as a single recessed card. A left
 * accent bar (▌ in the border-widget design token) mirrors the input editor's left
 * bar; the widget renders one column to its right, inside the surface. pi
 * already puts a canvas-colored spacer above the panel, and the editor panel
 * below opens with its own blank surface row that would merge with the card's
 * padding, so full padding rows would read heavy and lopsided. Instead the
 * panel frames its content with half-height edge rows: the top edge paints ▖
 * and ▄ on the lower half of the cell, the bottom edge paints ▘ and ▀ on the
 * upper half, and the outer halves stay canvas — padding and the gap to the
 * editor each read as half a line, matching the editor panel's own bottom
 * edge.
 * String-array widgets pass through untouched: pi caps those at ten lines and
 * wraps them itself, so re-wrapping would either duplicate that internal cap
 * or drop it. In TUI mode every pi-subagents widget is a factory component,
 * which is the surface this treatment targets.
 *
 * Reload safety: each bind creates a fresh ExtensionUIContext, so each install
 * wraps a fresh setWidget and wrappers replace each other instead of stacking.
 * Theme resolution tolerates the stale window after session replacement or
 * reload the same way user-message-border does: pi rejects ctx.ui access there,
 * which is caught and the last good theme is reused until the fresh session's
 * ctx takes over.
 */
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
/** The half-height edge row above the content; mouse y offsets past it. */
const TOP_ROWS = 1
const BAR = '▌'
/** Lower-left quadrant: feet the bar at half height without widening it. */
const BAR_FOOT = '▖'
/** Upper-left quadrant: caps the bar at half height without widening it. */
const BAR_CAP = '▘'
/** Lower-half block: paints only the bottom half of its cell. */
const HALF_BLOCK_LOWER = '▄'
/** Upper-half block: paints only the top half of its cell. */
const HALF_BLOCK = '▀'
/** Fixed left-bar color: the border-widget design token, as truecolor. */
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

/**
 * Wrap a widget component so its lines render on the panel surface framed by
 * half-height edge rows above and below. Invalidation and disposal delegate
 * unchanged. Mouse clicks translate by the top edge row so the inner
 * component keeps its own geometry (the pi-subagents widget collapses on
 * clicks to its first row); clicks on the edge rows are ignored.
 */
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
      // ctx rejected (stale after reload/session replacement): keep last good.
    }
    return lastGoodTheme
  }
  return {
    render(width: number): string[] {
      const innerWidth = Math.max(0, width - 1) // reserve the left bar column
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
        // Full resets inside a line would end the panel background; restore
        // it after each one.
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
      const x = event.x - 1 // compensate for the bar column
      if (y < 0 || y >= innerLineCount || x < 0) return undefined
      return inner.handleMouse?.({ ...event, x, y, height: innerLineCount })
    },
    dispose(): void {
      inner.dispose?.()
    },
  }
}

/**
 * A half-height edge row framing the card: the bar glyph (▖ foot on the top
 * edge, ▘ cap on the bottom) and the surface fill (▄ or ▀) paint only half of
 * the cell while the outer half stays canvas, so the padding and the gap each
 * read as half a line. Without a usable theme only the bar glyph renders. The
 * surface background color doubles as the block foreground by swapping its
 * SGR base 48 for 38.
 */
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
