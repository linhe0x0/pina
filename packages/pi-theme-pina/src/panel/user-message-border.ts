import {
  UserMessageComponent,
  type Theme,
} from '@earendil-works/pi-coding-agent'
import { paintPanel } from './panel.ts'

interface PatchablePrototype {
  render: (width: number) => string[]
  pinaPristineRender?: (width: number) => string[]
}

let installed = false

export function installUserMessageBorder(
  getTheme: () => Theme | undefined,
): void {
  const proto = UserMessageComponent?.prototype as
    PatchablePrototype | undefined
  if (installed || typeof proto?.render !== 'function') return
  installed = true
  const pristine = (proto.pinaPristineRender ??= proto.render)
  proto.render = function (width: number): string[] {
    const lines = pristine.call(this, width)
    const theme = getTheme()
    if (!theme || lines.length === 0) return lines
    return paintPanel(lines, width, {
      barFg: theme.getFgAnsi('accent'),
      bg: theme.getBgAnsi('userMessageBg'),
      fit: 'truncate',
      barOn: 'bg',
    })
  }
}
