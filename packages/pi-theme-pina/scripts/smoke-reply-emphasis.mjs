/**
 * Smoke run for reply-emphasis: decorate() a mixed sample line against a stub
 * of the real pina-dark theme (themes/pina-dark.json vars resolved to
 * truecolor ANSI), proving inferred chips and pill edges render with balanced
 * escape sequences and no adjacent escapes ("\x1b\x1b"). Exits non-zero on any
 * failed check. Run: node scripts/smoke-reply-emphasis.mjs
 */
import { readFileSync } from 'node:fs'
import { createPalette, decorate } from '../src/reply-emphasis.ts'

const themeJson = JSON.parse(
  readFileSync(new URL('../themes/pina-dark.json', import.meta.url), 'utf8'),
)
const hexOf = (token) => {
  const hex = themeJson.vars[themeJson.colors[token]]
  if (!/^#[0-9a-f]{6}$/i.test(hex))
    throw new Error(`pina-dark has no hex color for ${token}`)
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
const sgr = (code, token) => `\x1b[${code};2;${hexOf(token).join(';')}m`
// The slice of the Theme interface createPalette uses, backed by pina-dark.
const theme = {
  fg: (token, text) => sgr(38, token) + text + '\x1b[39m',
  getFgAnsi: (token) => sgr(38, token),
  getBgAnsi: (token) => sgr(48, token),
}

const line = [
  '**Fixed:** commit abc1234 in src/auth.ts:42-47 — [[Done]] ✓',
  'at 2024-01-15 14:02, ran 1h30m30s, wrote 4.2GB, v1.2.3, ip 10.0.0.1,',
  'colors #a576c7, fixes #123, NODE_ENV=prod, --dry-run, feat/x, 87%,',
  'code `b5a0d9f` chips, `` `git abc1234` `` stays literal, `refactor/mod`,',
].join(' ')

const out = decorate(line, createPalette(theme))

// Terminal-shaped escape stripping: numeric SGR runs and token-named runs.
const strip = (text) =>
  text.replace(/\x1b\[(?:[34][89];[A-Za-z]+|[0-9;]+)m/g, '')
const plainText = strip(out)
  .replace(/[\u{e0b6}\u{e0b4}]/gu, '|')
  .replace(/\u{a0}/gu, ' ')
const count = (re) => (out.match(re) ?? []).length

const failures = []
const check = (ok, message) => {
  if (!ok) failures.push(message)
}
check(!out.includes('\x1b\x1b'), 'adjacent escapes (\\x1b\\x1b) found')
check(
  !strip(out).includes('\x1b'),
  'a lone ESC survived stripping: malformed sequence',
)
check(count(/\x1b\[1m/g) === count(/\x1b\[22/g), 'bold open/close unbalanced')
check(count(/\x1b\[38;/g) === count(/\x1b\[39m/g), 'fg open/close unbalanced')
check(count(/\x1b\[48;/g) === count(/\x1b\[49m/g), 'bg open/close unbalanced')
check(out.includes('\u{e0b6}'), 'round cap glyphs missing')
for (const chip of [
  '|\uf417 abc1234|',
  '|\uf15b src/auth.ts:42-47|',
  '|\uf017 2024-01-15 14:02|',
  '|1h30m30s|',
  '|4.2GB|',
  '|v1.2.3|',
  '|10.0.0.1|',
  '|#a576c7|',
  '|#123|',
  '|NODE_ENV=prod|',
  '|--dry-run|',
  '|\uf126 feat/x|',
  '|87%|',
])
  check(plainText.includes(chip), `missing chip ${chip}`)
check(plainText.includes('|\uf417 b5a0d9f|'), 'code-span chip missing')
check(
  plainText.includes('`` `git abc1234` ``'),
  'double-wrapped span did not survive untouched',
)
check(
  plainText.includes('|\uf126 refactor/mod|'),
  'refactor branch chip missing',
)
check(plainText.includes(`\u{f00c} Done`), 'user pill with icon missing')

if (failures.length) {
  for (const f of failures) console.error('FAIL:', f)
  process.exit(1)
}
console.log('sample line:')
console.log(line)
console.log('\nplain (chips as |):')
console.log(plainText)
console.log('\nrendered (truecolor via pina-dark vars):')
console.log(out)
console.log(
  `\nsmoke ok: bold ${count(/\x1b\[1m/g)}↔${count(/\x1b\[22/g)}, fg ${count(/\x1b\[38;/g)}↔${count(/\x1b\[39m/g)}, bg ${count(/\x1b\[48;/g)}↔${count(/\x1b\[49m/g)}, no \\x1b\\x1b`,
)
