import type {
  MarkdownTransformer,
  Theme,
} from '@earendil-works/pi-coding-agent'
import { pinaConfigFromEnv, type PinaConfig } from '../config.ts'
import { createPalette, type Palette } from './palette.ts'
import { decorate } from './reply-decorate.ts'

export function createReplyEmphasis(
  getTheme: () => Theme | undefined,
  options?: Partial<PinaConfig>,
): MarkdownTransformer {
  const config = { ...pinaConfigFromEnv(), ...options }
  let built: { theme: Theme; palette: Palette } | undefined
  return (markdown) => {
    const theme = getTheme()
    if (!theme) return markdown
    if (built?.theme !== theme)
      built = { theme, palette: createPalette(theme, config) }
    return decorate(markdown, built.palette)
  }
}
