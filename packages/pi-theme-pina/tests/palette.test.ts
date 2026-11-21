import test from 'node:test'
import assert from 'node:assert/strict'
import type { Theme } from '@earendil-works/pi-coding-agent'
import { createPalette } from '../src/reply/palette.ts'
import { decorate } from '../src/reply/reply-decorate.ts'
import { palette, tagTheme } from './helpers.ts'

const VIOLET = '\x1b[38;2;184;161;255mx\x1b[39m'

test('pills fall back to reverse video without panel colors', () => {
  const bare = {
    ...tagTheme,
    getFgAnsi: (color: string) => `<fg-${color}>`,
    getBgAnsi: () => '\x1b[49m',
  } as unknown as Theme
  const out = decorate('[[Done]]', createPalette(bare))
  assert.ok(out.includes('\x1b[7m'))
  assert.ok(out.includes('<fg-success>'))
})

test('warning pills sit on the amber surface, not the gold search-match chip', () => {
  const out = decorate('[[Needs you]]', palette)
  assert.ok(out.includes('\x1b[48;customMessageBg'))
  assert.ok(!out.includes('\x1b[48;searchMatchBg'))
})

test('bold defaults to the textAnchor violet as direct truecolor', () => {
  const out = decorate('**x**', createPalette(tagTheme))
  assert.ok(out.includes(VIOLET))
})

test('boldColor accepts raw hex', () => {
  const out = decorate(
    '**x**',
    createPalette(tagTheme, { boldColor: '#b8a1ff' }),
  )
  assert.ok(out.includes(VIOLET))
  assert.ok(!out.includes('<mdLink>'))
})

test('three-digit hex expands', () => {
  const out = decorate('**x**', createPalette(tagTheme, { boldColor: '#f00' }))
  assert.ok(out.includes('\x1b[38;2;255;0;0mx\x1b[39m'))
})

test('an invalid hex falls back to mdLink', () => {
  const out = decorate(
    '**x**',
    createPalette(tagTheme, { boldColor: '#zzzzzz' }),
  )
  assert.ok(out.includes('<mdLink>'))
})
