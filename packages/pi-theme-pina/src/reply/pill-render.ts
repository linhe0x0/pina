import { bgToFg } from '../utils/ansi.ts'
import { OWN_ICON, splitLabel, toneOf, type PillTone } from './pill-tone.ts'
import type { Palette } from './palette.ts'

const LABEL_ICONS: Record<string, string> = {
  finding: '\u{f002}',
  terminal: '\u{f120}',
  folder: '\u{f07b}',
  file: '\u{f15b}',
  branch: '\u{f126}',
  review: '\u{f06e}',
  ideas: '\u{f0eb}',
  cause: '\u{f0e7}',
  fix: '\u{f0ad}',
  fixed: '\u{f0ad}',
  risk: '\u{f071}',
  limits: '\u{f071}',
  next: '\u{f061}',
  rollback: '\u{f0e2}',
  undo: '\u{f0e2}',
  options: '\u{f0ca}',
  result: '\u{f11e}',
  why: '\u{f059}',
  how: '\u{f013}',
  cost: '\u{f155}',
  rule: '\u{f0e3}',
  example: '\u{f121}',
  checked: '\u{f00c}',
  pills: '\u{f02b}',
  colors: '\u{f1fc}',
  icons: '\u{f005}',
  scoreboard: '\u{f080}',
  verdict: '\u{f0e3}',
  effect: '\u{f140}',
  evidence: '\u{f06e}',
  plan: '\u{f0ae}',
  status: '\u{f012}',
  decision: '\u{f126}',
}

export const ACTION_ICONS: Record<string, string> = {
  check: '\u{f046}',
  do: '\u{f0a4}',
  next: '\u{f061}',
  unblock: '\u{f09c}',
  left: '\u{f141}',
  run: '\u{f04b}',
  guard: '\u{f132}',
  undo: '\u{f0e2}',
  see: '\u{f08e}',
}
export const ACTION_LABEL = new RegExp(
  `(\\*\\*)(${Object.keys(ACTION_ICONS).join('|')})(:\\*\\*)`,
  'gi',
)

export function withLabelIcon(label: string): string {
  if (OWN_ICON.test(label)) return label
  const word = label
    .replace(/[:\s]+$/, '')
    .trim()
    .toLowerCase()
  const icon =
    LABEL_ICONS[word] ??
    (label.trimEnd().endsWith(':') ? ACTION_ICONS[word] : undefined)
  return icon ? `${icon} ${label}` : label
}

function pillEdges(
  palette: Palette,
  capColor: string,
): { pad: string; capL: string; capR: string } {
  const [left, right] = palette.roundCaps ? ['\uE0B6', '\uE0B4'] : ['', '']
  return {
    pad: palette.roundCaps ? '' : '\u00A0',
    capL: left ? `${capColor}${left}\x1b[39m` : '',
    capR: right ? `${capColor}${right}\x1b[39m` : '',
  }
}

function swatchChannel(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function swatchPill(match: string, palette: Palette): string {
  const r = parseInt(match.slice(1, 3), 16)
  const g = parseInt(match.slice(3, 5), 16)
  const b = parseInt(match.slice(5, 7), 16)
  const bg = `\x1b[48;2;${r};${g};${b}m`
  const cap = bgToFg(bg)
  const luma =
    0.2126 * swatchChannel(r) +
    0.7152 * swatchChannel(g) +
    0.0722 * swatchChannel(b)
  const ink = luma > 0.19 ? '\x1b[38;2;16;16;16m' : '\x1b[38;2;255;255;255m'
  const { pad, capL, capR } = pillEdges(palette, cap)
  return `${capL}${bg}${ink}\x1b[1m${pad}${match}${pad}\x1b[22;27m\x1b[39m\x1b[49m${capR}`
}

export function pill(
  label: string,
  palette: Palette,
  tone: PillTone = toneOf(label),
): string {
  const style = palette.pills[tone]
  const { icon, word } = splitLabel(label)
  const text = (
    icon && word && palette.pillIcons ? `${icon} ${word}` : word || label.trim()
  ).replace(/ /g, ' ')
  const { pad, capL, capR } = pillEdges(palette, style.cap)
  return `${capL}${style.label}\x1b[1m${pad}${text}${pad}\x1b[22;27m\x1b[39m\x1b[49m${capR}`
}
