import { DESIGN_TOKENS } from './theme/design-tokens.gen.ts'

const TEXT_ANCHOR = DESIGN_TOKENS.textAnchor

export interface PinaConfig {
  boldColor: string
  roundCaps: boolean
  pillIcons: boolean
  artifacts: boolean
}

export const DEFAULT_CONFIG: PinaConfig = {
  boldColor: TEXT_ANCHOR,
  roundCaps: true,
  pillIcons: true,
  artifacts: true,
}

export function pinaConfigFromEnv(): PinaConfig {
  return {
    boldColor: process.env.PINA_BOLD_COLOR || DEFAULT_CONFIG.boldColor,
    roundCaps: process.env.PINA_ROUND_CAPS !== '0',
    pillIcons: process.env.PINA_PILL_ICONS !== '0',
    artifacts: process.env.PINA_ARTIFACTS !== '0',
  }
}
