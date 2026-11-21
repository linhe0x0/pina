import test from 'node:test'
import assert from 'node:assert/strict'
import { decorate, splitCodeSpans } from '../src/reply/reply-decorate.ts'
import { palette, plain, tagTheme } from './helpers.ts'

const gl = (cp: number) => String.fromCodePoint(cp)
const CHECK = gl(0xf00c)
const CROSS = gl(0xf00d)

test('a single-bracket known word pills like the double-bracket form', () => {
  assert.equal(plain('[Done]'), `|${CHECK} Done|`)
  assert.equal(plain('[done]'), `|${CHECK} done|`)
  assert.equal(plain('[Failed: 3 tests]'), `|${CROSS} Failed: 3 tests|`)
  assert.equal(plain('[Done] [Failed]'), `|${CHECK} Done| |${CROSS} Failed|`)
})

test('a single-bracket context word pills with its icon', () => {
  assert.equal(plain('[skill]'), `|${gl(0xf02d)} skill|`)
  assert.equal(plain('[[Skill]]'), `|${gl(0xf02d)} Skill|`)
  assert.equal(plain('[New]'), `|${gl(0xf067)} New|`)
})

test('a single-bracket unknown word stays as typed', () => {
  assert.equal(plain('[Anything else]'), '[Anything else]')
  assert.equal(plain('[1]'), '[1]')
  assert.equal(plain('[2,3]'), '[2,3]')
})

test('markdown bracket constructs stay untouched', () => {
  assert.equal(plain('- [x] done'), '- [x] done')
  assert.equal(plain('- [ ] todo'), '- [ ] todo')
  assert.equal(plain('[Done](https://pi.dev)'), '[Done](https://pi.dev)')
  assert.equal(plain('![Done](x.png)'), '![Done](x.png)')
  assert.equal(plain('[Done][ref]'), '[Done][ref]')
  assert.equal(plain('`[Done]`'), '`[Done]`')
  assert.equal(plain('\\[Done\\]'), '\\[Done\\]')
})

test('labels over 32 characters are left alone', () => {
  const long = `[[${'x'.repeat(33)}]]`
  assert.equal(plain(long), long)
})

test('fenced code stays untouched', () => {
  const md = 'before\n\n```sh\n[[Done]] **x** ✓\n```\n\nafter'
  assert.equal(plain(md), md)
})

test('inline code stays untouched', () =>
  assert.equal(plain('`[[Done]] → **x**`'), '`[[Done]] → **x**`'))

test('escaped asterisks stay untouched', () =>
  assert.equal(plain('\\*\\*not bold\\*\\*'), '\\*\\*not bold\\*\\*'))

test('marks and tree connectors take theme colors', () => {
  const out = decorate('✓ pass ✗ fail → next\n├── one', palette)
  assert.ok(out.includes('<success>✓</>'))
  assert.ok(out.includes('<error>✗</>'))
  assert.ok(out.includes('<accent>→</>'))
  assert.ok(out.includes('<dim>├──</>'))
})

test('an unclosed bold span ends its color at the line end', () => {
  const [first, second] = decorate('**open span\nnext line', palette).split(
    '\n',
  )
  assert.equal(first, '**<mdLink>open span</>')
  assert.ok(!second.includes('<mdLink>'))
})

test('splitCodeSpans pairs equal-length backtick runs', () => {
  assert.deepEqual(splitCodeSpans('a `b` c'), ['a ', '`b`', ' c'])
  assert.deepEqual(splitCodeSpans('x `` `git abc1234` `` y'), [
    'x ',
    '`` `git abc1234` ``',
    ' y',
  ])
  assert.deepEqual(splitCodeSpans('`abc1234``'), ['`abc1234``'])
  assert.deepEqual(splitCodeSpans('``abc`'), ['``abc`'])
  assert.deepEqual(splitCodeSpans('`foo``bar``'), ['`foo', '``bar``', ''])
})

test('a double-wrapped code span passes through untouched', () => {
  const line = 'fixed in `` `abc1234` `` and `` `npm install` ``'
  assert.equal(plain(line), line)
  assert.equal(
    plain('`` `git abc1234` `` then abc1234 bare'),
    '`` `git abc1234` `` then |' + gl(0xf417) + ' abc1234| bare',
  )
})

test('mismatched backtick runs render whole and stay literal', () => {
  assert.equal(plain('run `deadbee1``x` now'), 'run `deadbee1``x` now')
  assert.equal(
    plain('`abc1234`` stays'),
    '`|' + gl(0xf417) + ' abc1234|`` stays',
  )
})

test('a chip inside bold reopens weight and color', () => {
  const out = decorate('**see `b5a0d9f` now**', palette)
  assert.ok(out.includes('\x1b[1m<mdLink> now'))
})
