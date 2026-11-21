import test from 'node:test'
import assert from 'node:assert/strict'
import type { ExtensionContext, Theme } from '@earendil-works/pi-coding-agent'
import { stripTerminalSequences } from '@earendil-works/pi-tui'
import { installWidgetPanel } from '../src/panel/widget-panel.ts'

const BG = '\x1b[48;2;25;27;31m'
const BAR = '\x1b[38;2;165;118;199m▌\x1b[39m'
const WIDTH = 40
const SURFACE_FG = '\x1b[38;2;25;27;31m'
const TOP_EDGE =
  '\x1b[38;2;165;118;199m▖' + SURFACE_FG + '▄'.repeat(WIDTH - 1) + '\x1b[39m'
const TOP_EDGE_BAR_ONLY = '\x1b[38;2;165;118;199m▖\x1b[39m'
const BOTTOM_EDGE =
  '\x1b[38;2;165;118;199m▘' + SURFACE_FG + '▀'.repeat(WIDTH - 1) + '\x1b[39m'
const BOTTOM_EDGE_BAR_ONLY = '\x1b[38;2;165;118;199m▘\x1b[39m'

const fakeTheme = {
  getBgAnsi: () => BG,
} as unknown as Theme

type Mounted = {
  key: string
  content: unknown
  options?: { placement?: string }
}

function fakeContext(theme: Theme | null): {
  ctx: ExtensionContext
  mounted: Mounted[]
} {
  const mounted: Mounted[] = []
  const ctx = {
    ui: {
      get theme() {
        if (!theme) throw new Error('stale ctx')
        return theme
      },
      setWidget: (key: string, content: unknown, options?: unknown) => {
        mounted.push({ key, content, options: options as Mounted['options'] })
      },
    },
  } as unknown as ExtensionContext
  return { ctx, mounted }
}

function fakeInner(
  lines: string[],
  handlers: {
    mouse?: (event: { x: number; y: number }) => unknown
    invalidate?: () => void
    dispose?: () => void
  } = {},
) {
  return {
    render: () => lines,
    invalidate: handlers.invalidate ?? (() => {}),
    handleMouse: handlers.mouse,
    dispose: handlers.dispose,
  }
}

type Panel = {
  render(width: number): string[]
  invalidate(): void
  dispose(): void
  handleMouse(event: unknown): unknown
}

function mountWidget(
  ctx: ExtensionContext,
  mounted: Mounted[],
  inner: unknown,
): Panel {
  installWidgetPanel(() => ctx)
  ctx.ui.setWidget('subagent-async', (() => inner) as never)
  const factory = mounted.at(-1)?.content
  assert.equal(typeof factory, 'function', 'factory was wrapped')
  return (factory as () => unknown)() as Panel
}

test('paints the panel surface across the full width of every line', () => {
  const { ctx, mounted } = fakeContext(fakeTheme)
  const panel = mountWidget(
    ctx,
    mounted,
    fakeInner([
      '\x1b[38;5;71m\x1b[1masync subagent\x1b[22m \x1b[2m· background\x1b[22;39m',
      '\x1b[38;5;71m●\x1b[39m worker \x1b[2m· running\x1b[22;39m',
    ]),
  )
  const lines = panel.render(WIDTH)
  assert.equal(lines.length, 4)
  for (const line of lines.slice(1, 3)) {
    assert.ok(line.startsWith(BAR), 'line must start with the left bar')
    assert.ok(line.includes(BG), 'line must carry the surface color')
    assert.equal(
      stripTerminalSequences(line).length,
      WIDTH,
      'line must span the full width',
    )
    assert.ok(line.endsWith('\x1b[49m'), 'surface must close at line end')
  }
  assert.equal(lines[0], TOP_EDGE, 'top edge paints the lower half of its cell')
  assert.equal(stripTerminalSequences(lines[0]).length, WIDTH)
  assert.equal(
    lines[3],
    BOTTOM_EDGE,
    'bottom edge paints the upper half of its cell',
  )
  assert.equal(stripTerminalSequences(lines[3]).length, WIDTH)
})

test('re-applies the surface after every embedded full reset', () => {
  const { ctx, mounted } = fakeContext(fakeTheme)
  const panel = mountWidget(
    ctx,
    mounted,
    fakeInner(['\x1b[1mhead\x1b[0mtail \x1b[0mend']),
  )
  const painted = panel.render(WIDTH)[1]
  assert.ok(painted.includes(`\x1b[0m${BG}tail`))
  assert.ok(painted.includes(`\x1b[0m${BG}end`))
})

test('frames the content with half-height edge rows', () => {
  const { ctx, mounted } = fakeContext(fakeTheme)
  const panel = mountWidget(
    ctx,
    mounted,
    fakeInner(['\x1b[38;5;71mrow\x1b[39m']),
  )
  const lines = panel.render(WIDTH)
  assert.equal(lines.length, 3)
  assert.equal(lines[0], TOP_EDGE, 'top edge paints the lower half of its cell')
  assert.equal(
    lines[2],
    BOTTOM_EDGE,
    'bottom edge paints the upper half of its cell',
  )
})

test('pads short lines to the full width on the surface', () => {
  const { ctx, mounted } = fakeContext(fakeTheme)
  const panel = mountWidget(
    ctx,
    mounted,
    fakeInner(['\x1b[38;5;71mshort\x1b[39m']),
  )
  const painted = panel.render(WIDTH)[1]
  assert.equal(stripTerminalSequences(painted).length, WIDTH)
  assert.ok(painted.includes(BG))
})

test('empty widget renders nothing, not even padding rows', () => {
  const { ctx, mounted } = fakeContext(fakeTheme)
  const panel = mountWidget(ctx, mounted, fakeInner([]))
  assert.deepEqual(panel.render(WIDTH), [])
})

test('string-array and undefined widget content pass through untouched', () => {
  const { ctx, mounted } = fakeContext(fakeTheme)
  installWidgetPanel(() => ctx)
  const lines = ['\x1b[38;5;71msnapshot\x1b[39m', 'row 2']
  ctx.ui.setWidget('snapshot', lines as never)
  assert.equal(mounted.at(-1)?.content, lines, 'same array reference')
  ctx.ui.setWidget('snapshot', undefined as never)
  assert.equal(mounted.at(-1)?.content, undefined)
})

test('clicks translate past the bar and edge rows; bar and edge row clicks are ignored', () => {
  const { ctx, mounted } = fakeContext(fakeTheme)
  const clicks: { x: number; y: number; height?: number }[] = []
  let invalidated = 0
  let disposed = 0
  const panel = mountWidget(
    ctx,
    mounted,
    fakeInner(['header'], {
      mouse: (event: { x: number; y: number; height?: number }) => {
        clicks.push({ x: event.x, y: event.y, height: event.height })
        return { handled: true, focus: false }
      },
      invalidate: () => {
        invalidated++
      },
      dispose: () => {
        disposed++
      },
    }),
  )
  panel.render(WIDTH)
  panel.handleMouse({ type: 'click', button: 'left', y: 0, x: 3 } as never)
  assert.deepEqual(clicks, [], 'click on the top edge row is ignored')
  panel.handleMouse({ type: 'click', button: 'left', y: 1, x: 0 } as never)
  assert.deepEqual(clicks, [], 'click on the left bar column is ignored')
  const result = panel.handleMouse({
    type: 'click',
    button: 'left',
    y: 1,
    x: 3,
    height: 3,
  } as never) as { handled: boolean }
  assert.deepEqual(
    clicks,
    [{ x: 2, y: 0, height: 1 }],
    'first content row translates past the bar to inner row 0 (collapse row)',
  )
  assert.equal(result.handled, true)
  panel.handleMouse({ type: 'click', button: 'left', y: 2, x: 3 } as never)
  assert.equal(clicks.length, 1, 'click on the bottom edge row is ignored')
  panel.invalidate()
  panel.dispose()
  assert.equal(invalidated, 1)
  assert.equal(disposed, 1)
})

test('a stale ctx keeps the last good theme', () => {
  const good = fakeContext(fakeTheme)
  let current: ExtensionContext = good.ctx
  installWidgetPanel(() => current)
  const inner = fakeInner(['\x1b[38;5;71mrow\x1b[39m'])
  current.ui.setWidget('subagent-async', (() => inner) as never)
  const factory = good.mounted.at(-1)?.content as () => unknown
  const panel = factory() as Panel
  assert.ok(panel.render(WIDTH)[0].includes(SURFACE_FG))

  current = fakeContext(null).ctx
  assert.ok(
    panel.render(WIDTH)[0].includes(SURFACE_FG),
    'last good theme survives',
  )
})

test('without any usable theme the lines render bare behind the bar, edges show only bar glyphs', () => {
  const { ctx, mounted } = fakeContext(null)
  const raw = '\x1b[38;5;71mrow\x1b[39m'
  const panel = mountWidget(ctx, mounted, fakeInner([raw]))
  const lines = panel.render(WIDTH)
  assert.equal(lines.length, 3)
  assert.equal(
    lines[0],
    TOP_EDGE_BAR_ONLY,
    'without a surface only the bar foots',
  )
  assert.equal(lines[1], BAR + raw)
  assert.equal(
    lines[2],
    BOTTOM_EDGE_BAR_ONLY,
    'without a surface only the bar caps',
  )
})
