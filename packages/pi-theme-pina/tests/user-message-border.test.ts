/**
 * Regression test for the Ghostty OSC 133 fresh-line bug.
 *
 * Upstream UserMessageComponent.render prepends ESC]133;A (semantic prompt
 * start) to the first rendered line. Ghostty treats 133;A as an implicit
 * fresh-line (CR+LF) whenever the cursor is not at column 0, so any bytes the
 * border extension writes AHEAD of the marker (the ▌ bar) displace the rest of
 * the row — the userMessageBg band — one line down, where the next row write
 * erases it. The block's first row then renders bar-only, without background.
 *
 * Invariant: every OSC 133 zone marker must stay at the start of its line,
 * ahead of the accent bar.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { UserMessageComponent } from '@earendil-works/pi-coding-agent'
import { installUserMessageBorder } from '../src/user-message-border.ts'

const OSC_PROMPT_START = '\x1b]133;A\x07'
const OSC_PROMPT_END = '\x1b]133;B\x07\x1b]133;C\x07'
const BG = '\x1b[48;2;30;33;38m'
const BAR = '▌'
const WIDTH = 40

const fakeTheme = {
  getBgAnsi: () => BG,
  fg: (_token: string, text: string) => `\x1b[38;2;255;216;89m${text}\x1b[39m`,
}
const BAR_STYLED = fakeTheme.fg('accent', BAR)

const fakeChild = {
  render: (width: number) => [`${BG}hello`, `${BG}${' '.repeat(width - 5)}`],
}

function renderWithBorder(): string[] {
  // Bare prototype instance: Container.render only touches `children`, so a
  // stub child exercises the exact render chain without the theme system.
  const component = Object.create(
    UserMessageComponent.prototype,
  ) as UserMessageComponent
  ;(component as unknown as { children: unknown[] }).children = [fakeChild]
  return component.render(WIDTH)
}

test('OSC 133 markers stay ahead of the accent bar', () => {
  installUserMessageBorder(() => ({ ui: { theme: fakeTheme } }) as never)
  const lines = renderWithBorder()
  assert.ok(lines.length >= 2, 'expected a multi-line render')
  assert.ok(
    lines[0].startsWith(OSC_PROMPT_START),
    `first line must start with the OSC 133;A marker, got ${JSON.stringify(lines[0].slice(0, 16))}`,
  )
  assert.ok(
    lines[0].startsWith(OSC_PROMPT_START + BAR_STYLED),
    `accent bar must follow the marker, got ${JSON.stringify(lines[0].slice(0, 24))}`,
  )
  assert.ok(
    lines.at(-1)!.startsWith(OSC_PROMPT_END + BAR_STYLED),
    `last line must start with the OSC 133;B/C markers, got ${JSON.stringify(lines.at(-1)!.slice(0, 24))}`,
  )
  assert.ok(lines.every((line) => line.includes(BAR)))
})
