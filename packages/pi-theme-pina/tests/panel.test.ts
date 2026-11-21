import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleWidth } from '@earendil-works/pi-tui'
import { paintPanel } from '../src/panel/panel.ts'

const BAR_FG = '\x1b[38;5;99m'
const BAR = BAR_FG + '▌\x1b[39m'
const BG = '\x1b[48;5;201m'
const BG_AS_FG = '\x1b[38;5;201m'
const WIDTH = 20

test('pad mode repaints the background, pads to width, and closes the row', () => {
  const line = '\x1b[1mhead\x1b[0mtail'
  const painted = paintPanel([line], WIDTH, {
    barFg: BAR_FG,
    bg: BG,
    repaint: true,
  })
  assert.equal(painted.length, 1)
  const expected =
    BAR +
    BG +
    '\x1b[1mhead\x1b[0m' +
    BG +
    'tail' +
    ' '.repeat(WIDTH - 1 - 8) +
    '\x1b[49m'
  assert.equal(painted[0], expected)
  assert.equal(visibleWidth(painted[0]), WIDTH)
  assert.ok(painted[0].endsWith('\x1b[49m'), 'surface must close at row end')
  assert.ok(painted[0].includes(`\x1b[0m${BG}tail`), 'repaint after reset')
  assert.equal(
    paintPanel([line], WIDTH, { barFg: BAR_FG, bg: BG })[0],
    BAR + BG + '\x1b[1mhead\x1b[0mtail' + ' '.repeat(11) + '\x1b[49m',
    'repaint defaults to off',
  )
})

test('truncate mode keeps OSC 133 zones ahead of the bar and truncates the body', () => {
  const zones = '\x1b]133;A\x07\x1b]133;B\x1b\\'
  const body = 'x'.repeat(WIDTH + 5)
  const out = paintPanel([zones + body], WIDTH, {
    barFg: BAR_FG,
    fit: 'truncate',
  })
  assert.equal(out.length, 1)
  assert.equal(out[0], zones + BAR + 'x'.repeat(WIDTH - 1) + '\x1b[0m')
})

test('edge rows frame the panel and degrade to bare glyphs without a background', () => {
  const top = BAR_FG + '▖' + BG_AS_FG + '▄'.repeat(WIDTH - 1) + '\x1b[39m'
  const bottom = BAR_FG + '▘' + BG_AS_FG + '▀'.repeat(WIDTH - 1) + '\x1b[39m'
  assert.deepEqual(
    paintPanel([], WIDTH, { barFg: BAR_FG, bg: BG, edges: 'both' }),
    [top, bottom],
  )
  assert.deepEqual(
    paintPanel([], WIDTH, { barFg: BAR_FG, bg: BG, edges: 'top' }),
    [top],
  )
  assert.deepEqual(
    paintPanel([], WIDTH, { barFg: BAR_FG, bg: BG, edges: 'bottom' }),
    [bottom],
  )
  assert.deepEqual(paintPanel([], WIDTH, { barFg: BAR_FG, edges: 'both' }), [
    BAR_FG + '▖\x1b[39m',
    BAR_FG + '▘\x1b[39m',
  ])
})

test('barOn bg leaves lines without the background untouched', () => {
  const plain = 'no background here'
  const styled = '\x1b[38;5;71m' + BG + 'with background\x1b[39m'
  const out = paintPanel([plain, styled], WIDTH, {
    barFg: BAR_FG,
    bg: BG,
    fit: 'truncate',
    repaint: false,
    barOn: 'bg',
  })
  assert.equal(out[0], plain, 'line without bg passes through byte-identical')
  assert.equal(out[1], BAR + styled)
  assert.deepEqual(
    paintPanel([plain], WIDTH, { barFg: BAR_FG, fit: 'truncate', barOn: 'bg' }),
    [plain],
  )
})

test('without a background, pad mode paints bare bar lines', () => {
  const out = paintPanel(['hello'], WIDTH, { barFg: BAR_FG })
  assert.deepEqual(out, [BAR + 'hello'])
})
