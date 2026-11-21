import test from 'node:test'
import assert from 'node:assert/strict'
import type {
  MarkdownTransformContext,
  Theme,
} from '@earendil-works/pi-coding-agent'
import { createReplyEmphasis } from '../src/reply/reply-emphasis.ts'
import { tagTheme, withEnv } from './helpers.ts'

const contextOf = (messageType: string) =>
  ({ messageType }) as unknown as MarkdownTransformContext

const VIOLET = '\x1b[38;2;184;161;255mx\x1b[39m'

test('no theme yet leaves markdown untouched', () => {
  const transform = createReplyEmphasis(() => undefined)
  assert.equal(transform('**x**', contextOf('assistant')), '**x**')
})

test('a theme switch rebuilds the palette', () => {
  let theme: Theme | undefined = tagTheme
  const transform = createReplyEmphasis(() => theme, { boldColor: 'mdLink' })
  assert.ok(transform('**x**', contextOf('assistant')).includes('<mdLink>'))
  theme = {
    ...tagTheme,
    fg: (color: string, text: string) =>
      color === 'mdLink' ? `[bold]${text}` : `<${color}>${text}</>`,
  } as unknown as Theme
  assert.ok(transform('**x**', contextOf('assistant')).includes('[bold]'))
  assert.ok(!transform('**x**', contextOf('assistant')).includes('<mdLink>'))
})

test('options override the environment', () => {
  withEnv('PINA_BOLD_COLOR', 'accent', () => {
    const transform = createReplyEmphasis(() => tagTheme, {
      boldColor: 'mdLink',
    })
    const out = transform('**x**', contextOf('assistant'))
    assert.ok(out.includes('<mdLink>'))
    assert.ok(!out.includes('<accent>'))
  })
})

test('env knobs land at creation, not per render', () => {
  withEnv('PINA_BOLD_COLOR', undefined, () => {
    const transform = createReplyEmphasis(() => tagTheme)
    assert.ok(transform('**x**', contextOf('assistant')).includes(VIOLET))
    withEnv('PINA_BOLD_COLOR', 'mdLink', () => {
      assert.ok(transform('**x**', contextOf('assistant')).includes(VIOLET))
    })
  })
})
