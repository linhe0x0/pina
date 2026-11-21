import type { Theme } from '@earendil-works/pi-coding-agent'
import { createPalette, type Palette } from '../src/reply/palette.ts'
import { decorate } from '../src/reply/reply-decorate.ts'

export const tagTheme = {
  fg: (color: string, text: string) => `<${color}>${text}</>`,
  getFgAnsi: (color: string) => `\x1b[38;${color}m`,
  getBgAnsi: (color: string) => `\x1b[48;${color}m`,
} as unknown as Theme

export const palette = createPalette(tagTheme, { boldColor: 'mdLink' })

export function withEnv(
  name: string,
  value: string | undefined,
  run: () => void,
) {
  const saved = process.env[name]
  try {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
    run()
  } finally {
    if (saved === undefined) delete process.env[name]
    else process.env[name] = saved
  }
}

const gl = (cp: number) => String.fromCodePoint(cp)
const CAPS = [gl(0xe0b6), gl(0xe0b4)]
const NBSP = gl(0xa0)

export const plain = (text: string, p: Palette = palette) =>
  decorate(text, p)
    .replace(/\x1b\[(?:[34][89];[A-Za-z]+|[0-9;]+)m/g, '')
    .replace(new RegExp(`[${CAPS.join('')}]`, 'g'), '|')
    .replace(new RegExp(NBSP, 'g'), ' ')
