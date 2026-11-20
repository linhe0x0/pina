import {
  UserMessageComponent,
  type ExtensionContext,
  type Theme,
} from '@earendil-works/pi-coding-agent'
import { truncateToWidth } from '@earendil-works/pi-tui'

const BAR = '▌'

const OSC133_ZONE_PREFIX = /^(?:\x1b\]133;[ABC](?:\x07|\x1b\\))+/

interface PatchablePrototype {
  render: (width: number) => string[]
  pinaPristineRender?: (width: number) => string[]
}

let installed = false

export function installUserMessageBorder(
  getCtx: () => ExtensionContext | undefined,
): void {
  const proto = UserMessageComponent?.prototype as
    PatchablePrototype | undefined
  if (installed || typeof proto?.render !== 'function') return
  installed = true
  const pristine = (proto.pinaPristineRender ??= proto.render)
  let lastGoodTheme: Theme | undefined
  proto.render = function (width: number): string[] {
    const lines = pristine.call(this, width)
    let theme = lastGoodTheme
    try {
      const current = getCtx()?.ui.theme
      if (current) {
        theme = current
        lastGoodTheme = current
      }
    } catch {
    }
    if (!theme || lines.length === 0) return lines
    const bg = theme.getBgAnsi('userMessageBg')
    const bar = theme.fg('accent', BAR)
    return lines.map((line) => {
      if (!bg || !line.includes(bg)) return line
      const zones = line.match(OSC133_ZONE_PREFIX)?.[0] ?? ''
      const body = zones ? line.slice(zones.length) : line
      return zones + bar + truncateToWidth(body, width - 1, '')
    })
  }
}
