import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui'
import { bgToFg } from '../utils/ansi.ts'

export interface PanelSpec {
  barFg: string
  bg?: string
  edges?: 'top' | 'bottom' | 'both'
  fit?: 'pad' | 'truncate'
  repaint?: boolean
  barOn?: 'all' | 'bg'
}

const OSC133_ZONES = /^(?:\x1b\]133;[ABC](?:\x07|\x1b\\))+/
const BAR = '▌'
const BAR_FOOT = '▖'
const BAR_CAP = '▘'
const LOWER_HALF = '▄'
const UPPER_HALF = '▀'
const RESET_FG = '\x1b[39m'
const RESET_BG = '\x1b[49m'
const FULL_RESET = '\x1b[0m'

function edgeRow(
  bg: string | undefined,
  barFg: string,
  glyph: string,
  fill: string,
  width: number,
): string {
  if (!bg) return barFg + glyph + RESET_FG
  return barFg + glyph + bgToFg(bg) + fill.repeat(width - 1) + RESET_FG
}

export function paintPanel(
  lines: string[],
  width: number,
  spec: PanelSpec,
): string[] {
  const { barFg, bg, edges, fit = 'pad', repaint = false, barOn = 'all' } = spec
  const content = Math.max(0, width - 1)
  const out: string[] = []
  if (edges === 'top' || edges === 'both') {
    out.push(edgeRow(bg, barFg, BAR_FOOT, LOWER_HALF, width))
  }
  for (const line of lines) {
    if (barOn === 'bg' && (!bg || !line.includes(bg))) {
      out.push(line)
      continue
    }
    const zones = line.match(OSC133_ZONES)?.[0] ?? ''
    const body = line.slice(zones.length)
    if (fit === 'truncate') {
      out.push(
        zones + barFg + BAR + RESET_FG + truncateToWidth(body, content, ''),
      )
      continue
    }
    if (!bg) {
      out.push(zones + barFg + BAR + RESET_FG + body)
      continue
    }
    const pad = ' '.repeat(Math.max(0, content - visibleWidth(body)))
    const painted = repaint
      ? body.replaceAll(FULL_RESET, FULL_RESET + bg)
      : body
    out.push(zones + barFg + BAR + RESET_FG + bg + painted + pad + RESET_BG)
  }
  if (edges === 'bottom' || edges === 'both') {
    out.push(edgeRow(bg, barFg, BAR_CAP, UPPER_HALF, width))
  }
  return out
}
