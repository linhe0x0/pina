import type { ExtensionContext, Theme } from '@earendil-works/pi-coding-agent'

export function createThemeSource(
  getCtx: () => ExtensionContext | undefined,
): () => Theme | undefined {
  let lastGood: Theme | undefined
  return () => {
    try {
      const theme = getCtx()?.ui.theme
      if (theme) {
        lastGood = theme
        return theme
      }
    } catch {}
    return lastGood
  }
}
