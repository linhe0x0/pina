import test from 'node:test'
import assert from 'node:assert/strict'
import type { ExtensionContext, Theme } from '@earendil-works/pi-coding-agent'
import { createThemeSource } from '../src/theme/theme-source.ts'

const themeA = { fg: () => 'a' } as unknown as Theme
const themeB = { fg: () => 'b' } as unknown as Theme

function ctxReading(read: () => Theme): ExtensionContext {
  return {
    ui: {
      get theme() {
        return read()
      },
    },
  } as unknown as ExtensionContext
}

test('returns undefined before any ctx exists', () => {
  const theme = createThemeSource(() => undefined)
  assert.equal(theme(), undefined)
})

test('reads the live theme from a live ctx', () => {
  let ctx: ExtensionContext | undefined = ctxReading(() => themeA)
  const theme = createThemeSource(() => ctx)
  assert.equal(theme(), themeA)
})

test('a stale ctx keeps the last good theme', () => {
  let ctx: ExtensionContext | undefined = ctxReading(() => themeA)
  const theme = createThemeSource(() => ctx)
  assert.equal(theme(), themeA)
  ctx = ctxReading(() => {
    throw new Error('stale ctx')
  })
  assert.equal(theme(), themeA)
})

test('a new ctx refreshes the theme', () => {
  let ctx: ExtensionContext | undefined = ctxReading(() => themeA)
  const theme = createThemeSource(() => ctx)
  assert.equal(theme(), themeA)
  ctx = ctxReading(() => themeB)
  assert.equal(theme(), themeB)
})

test('never throws, even before the first good theme', () => {
  const theme = createThemeSource(() => {
    throw new Error('stale ctx')
  })
  assert.equal(theme(), undefined)
})
