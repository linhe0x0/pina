import type { Theme } from '@earendil-works/pi-coding-agent'
import { bgToFg, truecolorFg } from '../utils/ansi.ts'
import { DEFAULT_CONFIG, type PinaConfig } from '../config.ts'
import type { PillTone } from './pill-tone.ts'

type Colorize = (text: string) => string

export interface Palette {
  bold: Colorize
  passed: Colorize
  failed: Colorize
  pills: Record<PillTone, { label: string; cap: string }>
  arrow: Colorize
  tree: Colorize
  roundCaps: boolean
  pillIcons: boolean
  artifacts: boolean
}

const solid = (code: number) => ({
  label: `\x1b[${code}m\x1b[7m`,
  cap: `\x1b[${code}m`,
})

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function hexColorize(hex: string): Colorize | undefined {
  const m = hex.match(HEX_COLOR)
  if (!m) return undefined
  const n = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  const open = truecolorFg(`#${n}`)
  return (text: string) => open + text + '\x1b[39m'
}

export function createPalette(
  theme: Theme,
  options: Partial<PinaConfig> = {},
): Palette {
  const { boldColor, roundCaps, pillIcons, artifacts } = {
    ...DEFAULT_CONFIG,
    ...options,
  }
  const fg = (name: string) => (text: string) => theme.fg(name as never, text)
  const hex = hexColorize(boldColor)
  const bold = hex ?? fg(boldColor.startsWith('#') ? 'mdLink' : boldColor)
  const tone = (labelFg: string, bg: string) => {
    const bgAnsi = theme.getBgAnsi(bg as never)
    if (!bgAnsi || /^\x1b\[49m$/.test(bgAnsi)) {
      const fgAnsi = theme.getFgAnsi(
        (labelFg === 'text' ? 'accent' : labelFg) as never,
      )
      return { label: `${fgAnsi}\x1b[7m`, cap: fgAnsi }
    }
    return {
      label: bgAnsi + theme.getFgAnsi(labelFg as never),
      cap: bgToFg(bgAnsi),
    }
  }
  return {
    bold,
    passed: fg('success'),
    failed: fg('error'),
    pills: {
      success: tone('success', 'toolSuccessBg'),
      error: tone('error', 'toolErrorBg'),
      warning: tone('warning', 'customMessageBg'),
      neutral: tone('text', 'selectedBg'),
      critical: solid(35),
      mode: solid(36),
      owner: solid(34),
    },
    arrow: fg('accent'),
    tree: fg('dim'),
    roundCaps,
    pillIcons,
    artifacts,
  }
}
