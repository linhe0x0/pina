import test from 'node:test'
import assert from 'node:assert/strict'
import { createPalette } from '../src/reply/palette.ts'
import { toneOf } from '../src/reply/pill-tone.ts'
import { decorate } from '../src/reply/reply-decorate.ts'
import { palette, plain, tagTheme } from './helpers.ts'

const gl = (cp: number) => String.fromCodePoint(cp)
const CHECK = gl(0xf00c)
const NBSP = gl(0xa0)

test('a known word gets its icon', () =>
  assert.equal(plain('[[Done]]'), `|${CHECK} Done|`))

test('an unknown word has no icon', () =>
  assert.equal(plain('[[Anything else]]'), '|Anything else|'))

test('synonyms display as one word and keep their detail', () =>
  assert.equal(plain('[[Completed 12/12]]'), `|${CHECK} Done 12/12|`))

test("a label's own glyph wins over the table's", () =>
  assert.equal(plain(`[[${gl(0xf0e7)} Unsafe]]`), `|${gl(0xf0e7)} Unsafe|`))

test('case-insensitive matching keeps the typed display form', () => {
  assert.equal(plain('[[DONE]]'), `|${CHECK} DONE|`)
  assert.equal(plain('[[Completed]]'), `|${CHECK} Done|`)
  assert.equal(toneOf('needs   YOU'), 'warning')
})

test('a two-word pill is joined with no-break spaces', () => {
  const out = decorate('[[Needs you]]', palette)
  assert.ok(out.includes(`${gl(0xf007)}${NBSP}Needs${NBSP}you`))
})

test('a heading takes an icon from its word', () =>
  assert.equal(plain('## Finding'), `## ${gl(0xf002)} Finding`))

test('an unknown heading is untouched', () =>
  assert.equal(plain('## What happened'), '## What happened'))

test('past-tense lead labels take the same icon as their verb stem', () => {
  assert.equal(plain('**Fixed:** x'), `**<mdLink>${gl(0xf0ad)} Fixed:</>** x`)
  assert.equal(plain('## Fixed'), `## ${gl(0xf0ad)} Fixed`)
})

test('a leading bold label takes an icon, after list markers and tree connectors', () => {
  assert.equal(
    plain('- **Cause:** x'),
    `- **<mdLink>${gl(0xf0e7)} Cause:</>** x`,
  )
  assert.equal(
    plain('└── **Fix:** y'),
    `<dim>└──</> **<mdLink>${gl(0xf0ad)} Fix:</>** y`,
  )
})

test('bold later in a line gets color but no icon', () =>
  assert.equal(plain('see **detail** here'), 'see **<mdLink>detail</>** here'))

test('action lead-ins take an icon anywhere in a line when they end in a colon', () =>
  assert.equal(
    plain('[[Unverified]] then **Check:** reload'),
    `|${gl(0xf128)} Unverified| then **<mdLink>${gl(0xf046)} Check:</>** reload`,
  ))

test('a line-leading lead-in gets exactly one icon', () =>
  assert.equal(plain('**Next:** go'), `**<mdLink>${gl(0xf061)} Next:</>** go`))

test('a lead-in word without a colon stays ordinary bold', () =>
  assert.equal(plain('please **do** it'), 'please **<mdLink>do</>** it'))

test('hex color pills use the matched color as the swatch background', () => {
  const out = decorate('#a576c7', palette)
  assert.ok(out.includes('\x1b[48;2;165;118;199m'))
  assert.ok(out.includes('\x1b[38;2;165;118;199m'))
  assert.ok(out.includes('\x1b[38;2;16;16;16m'))
  assert.ok(decorate('#ffd859', palette).includes('\x1b[38;2;16;16;16m'))
  assert.ok(decorate('#442e00', palette).includes('\x1b[38;2;255;255;255m'))
  assert.ok(decorate('#A576C7', palette).includes('\x1b[48;2;165;118;199m'))
  assert.ok(decorate('#123456', palette).includes('\x1b[48;2;18;52;86m'))
})

test('pillIcons: false drops icons and keeps color', () => {
  const gated = createPalette(tagTheme, { pillIcons: false })
  assert.equal(plain('[[Done]]', gated), '|Done|')
  assert.equal(plain('## Finding', gated), '## Finding')
})
