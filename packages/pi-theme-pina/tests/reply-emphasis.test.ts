import test from 'node:test'
import assert from 'node:assert/strict'
import type {
  ExtensionContext,
  MarkdownTransformContext,
  Theme,
} from '@earendil-works/pi-coding-agent'
import {
  createPalette,
  createReplyEmphasis,
  decorate,
  splitCodeSpans,
  toneOf,
  type Palette,
} from '../src/reply-emphasis.ts'

const tagTheme = {
  fg: (color: string, text: string) => `<${color}>${text}</>`,
  getFgAnsi: (color: string) => `\x1b[38;${color}m`,
  getBgAnsi: (color: string) => `\x1b[48;${color}m`,
} as unknown as Theme

const palette = createPalette(tagTheme, 'mdLink')

const gl = (cp: number) => String.fromCodePoint(cp)
const CHECK = gl(0xf00c)
const CROSS = gl(0xf00d)
const CAPS = [gl(0xe0b6), gl(0xe0b4)]
const NBSP = gl(0xa0)

const plain = (text: string, p: Palette = palette) =>
  decorate(text, p)
    .replace(/\x1b\[(?:[34][89];[A-Za-z]+|[0-9;]+)m/g, '')
    .replace(new RegExp(`[${CAPS.join('')}]`, 'g'), '|')
    .replace(new RegExp(NBSP, 'g'), ' ')

const chips = (out: string) => (out.match(/\|/g) ?? []).length / 2

const contextOf = (messageType: string) =>
  ({ messageType }) as unknown as MarkdownTransformContext

test('pill words map to tones', () => {
  assert.equal(toneOf('Failed'), 'error')
  assert.equal(toneOf('Blocked'), 'error')
  assert.equal(toneOf('Needs you'), 'warning')
  assert.equal(toneOf('Decision'), 'warning')
  assert.equal(toneOf('Done'), 'success')
  assert.equal(toneOf('Observed'), 'success')
  assert.equal(toneOf('Costs money'), 'critical')
  assert.equal(toneOf('Irreversible'), 'critical')
  assert.equal(toneOf('Implement'), 'mode')
  assert.equal(toneOf('Shared'), 'owner')
  assert.equal(toneOf('Inferred'), 'neutral')
  assert.equal(toneOf('Anything else'), 'neutral')
})

test('tone ignores case and spacing', () =>
  assert.equal(toneOf('  needs   YOU '), 'warning'))

test('a known word may carry detail', () => {
  assert.equal(toneOf('Passed 12/12'), 'success')
  assert.equal(toneOf('Failed: 3 tests'), 'error')
})

test('a longer word that starts like a known one is not that word', () =>
  assert.equal(toneOf('Donezo'), 'neutral'))

test('a known word gets its icon', () =>
  assert.equal(plain('[[Done]]'), `|${CHECK} Done|`))

test('an unknown word has no icon', () =>
  assert.equal(plain('[[Anything else]]'), '|Anything else|'))

test('synonyms display as one word and keep their detail', () =>
  assert.equal(plain('[[Completed 12/12]]'), `|${CHECK} Done 12/12|`))

test("a label's own glyph wins over the table's", () =>
  assert.equal(plain(`[[${gl(0xf0e7)} Unsafe]]`), `|${gl(0xf0e7)} Unsafe|`))

test('labels over 32 characters are left alone', () => {
  const long = `[[${'x'.repeat(33)}]]`
  assert.equal(plain(long), long)
})

test('a single-bracket known word pills like the double-bracket form', () => {
  assert.equal(plain('[Done]'), `|${CHECK} Done|`)
  assert.equal(plain('[done]'), `|${CHECK} done|`)
  assert.equal(plain('[Failed: 3 tests]'), `|${CROSS} Failed: 3 tests|`)
  assert.equal(plain('[Done] [Failed]'), `|${CHECK} Done| |${CROSS} Failed|`)
})

test('case-insensitive matching keeps the typed display form', () => {
  assert.equal(plain('[[DONE]]'), `|${CHECK} DONE|`)
  assert.equal(plain('[[Completed]]'), `|${CHECK} Done|`)
  assert.equal(toneOf('needs   YOU'), 'warning')
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

test('reference artifacts chip whole, with no tint path left', () => {
  const out = plain(
    'commit abc1234 (full 0123456789abcdef0123456789abcdef01234567), see src/auth.ts:42-47, fixes #123',
  )
  assert.ok(out.includes(`|${gl(0xf417)} abc1234|`))
  assert.ok(
    out.includes(`|${gl(0xf417)} 0123456789abcdef0123456789abcdef01234567|`),
  )
  assert.ok(out.includes(`|${gl(0xf15b)} src/auth.ts:42-47|`))
  assert.ok(out.includes('|#123|'))
  assert.equal(chips(out), 4)
  assert.ok(!out.includes('<syntaxType>'))
})

test('english words made of hex letters stay untouched', () => {
  assert.equal(plain('defaced and deadbeef'), 'defaced and deadbeef')
  assert.equal(plain('a decade of accede'), 'a decade of accede')
})

test('context tokens chip whole, date and time as one span', () => {
  const out = plain('2024-01-15 14:02 took 1.4s wrote 4.2GB v1.2.3 ip 10.0.0.1')
  assert.ok(out.includes(`|${gl(0xf017)} 2024-01-15 14:02|`))
  assert.ok(out.includes('|1.4s|'))
  assert.ok(out.includes('|4.2GB|'))
  assert.ok(out.includes('|v1.2.3|'))
  assert.ok(out.includes('|10.0.0.1|'))
  assert.equal(chips(out), 5)
})

test('compound durations chip as one span, never split', () => {
  const out = plain('ran 1h30m30s of 2m30s')
  assert.ok(out.includes('|1h30m30s|'))
  assert.ok(out.includes('|2m30s|'))
  assert.equal(chips(out), 2)
})

test('a uuid chips once and no hash is carved out of it', () => {
  const out = plain('id 550e8400-e29b-41d4-a716-446655440000')
  assert.ok(out.includes('|550e8400-e29b-41d4-a716-446655440000|'))
  assert.equal(chips(out), 1)
})

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

test('six-digit hex colors chip; odd lengths stay untouched', () => {
  const out = plain('colors #a576c7 #123456 #a576c7ff #123 #1234567')
  assert.ok(out.includes('|#a576c7|'))
  assert.ok(out.includes('|#123456|'))
  assert.ok(out.includes('|#123|'))
  assert.ok(out.includes('#a576c7ff'))
  assert.ok(out.includes('#1234567'))
  assert.equal(chips(out), 3)
})

test('bare file names chip whole, with line and column suffixes', () => {
  const out = plain(
    'a.js README.md src/auth.ts .env README README.MD a.js:12 src/auth.ts:42:21 init.nvim',
  )
  for (const token of [
    'a.js',
    'README.md',
    'src/auth.ts',
    '.env',
    'README',
    'README.MD',
    'a.js:12',
    'src/auth.ts:42:21',
    'init.nvim',
  ]) {
    assert.ok(out.includes(`|${gl(0xf15b)} ${token}|`), token)
  }
  assert.equal(chips(out), 9)
})

test('non-whitelisted lookalikes stay untouched', () => {
  const line = 'pi.dev e.g. No.1 Makefile x.test run.app y.io a.local'
  assert.equal(plain(line), line)
})

test('markers, flags, env assignments and branches chip', () => {
  const out = plain(
    '87% done, TODO: fix --dry-run, set NODE_ENV=prod on feat/x',
  )
  assert.ok(out.includes('|87%|'))
  assert.ok(out.includes(`|${gl(0xf0ae)} TODO|`))
  assert.ok(out.includes('|--dry-run|'))
  assert.ok(out.includes('|NODE_ENV=prod|'))
  assert.ok(out.includes(`|${gl(0xf126)} feat/x|`))
  assert.equal(chips(out), 5)
})

test('lowercase env keys, short flags, triple dashes and marker lookalikes stay untouched', () => {
  const line =
    'node_env=prod stays, -x and ---weird too, TODOS and fixup remain'
  assert.equal(plain(line), line)
})

test('edge guards: branch trailing dot, glued dates, compound dotfiles', () => {
  assert.equal(plain('on feat/x. done'), `on |${gl(0xf126)} feat/x|. done`)
  assert.equal(plain('id 12024-01-15'), 'id 12024-01-15')
  assert.equal(plain('feat/v1.2.3'), `|${gl(0xf126)} feat/v1.2.3|`)
  assert.equal(
    plain('check .prettierrc.json'),
    `check |${gl(0xf15b)} .prettierrc.json|`,
  )
  assert.equal(
    plain('keep .env and .prettierrc'),
    `keep |${gl(0xf15b)} .env| and |${gl(0xf15b)} .prettierrc|`,
  )
})
test('README with a colon does not glue the colon', () => {
  const out = plain('README: how to run')
  assert.ok(out.includes(`|${gl(0xf15b)} README|`))
  assert.ok(out.includes(': how to run'))
  assert.equal(chips(out), 1)
})

test('pill brackets stay protected, but a code span that is exactly a commit hash chips', () => {
  assert.equal(plain('[[Fix abc1234]]'), '|Fix abc1234|')
  assert.equal(plain('[abc1234]'), '[abc1234]')
  assert.equal(plain('`b5a0d9f`'), `|${gl(0xf417)} b5a0d9f|`)
  assert.equal(
    plain('`0123456789abcdef0123456789abcdef01234567`'),
    `|${gl(0xf417)} 0123456789abcdef0123456789abcdef01234567|`,
  )
  assert.equal(plain('`deadbeef` and `abc123`'), '`deadbeef` and `abc123`')
  assert.equal(
    plain('`git abc1234` and `npm install`'),
    '`git abc1234` and `npm install`',
  )
  assert.ok(plain('**see `b5a0d9f` now**').includes(`|${gl(0xf417)} b5a0d9f|`))
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

test('a code span that is exactly one inferred token chips like its bare form', () => {
  const fork = gl(0xf126)
  const out = plain(
    'see `b5a0d9f`, `src/auth.ts:42:21`, `NODE_ENV=prod`, `--dry-run`, `#123`, `feat/x`, `refactor/module`, `2024-01-15 14:02`, `1h30m30s`, `87%`, `v1.2.3`, `.env`',
  )
  assert.ok(out.includes(`|${gl(0xf417)} b5a0d9f|`))
  assert.ok(out.includes(`|${gl(0xf15b)} src/auth.ts:42:21|`))
  assert.ok(out.includes('|NODE_ENV=prod|'))
  assert.ok(out.includes('|--dry-run|'))
  assert.ok(out.includes('|#123|'))
  assert.ok(out.includes(`|${fork} feat/x|`))
  assert.ok(out.includes(`|${fork} refactor/module|`))
  assert.ok(out.includes(`|${gl(0xf017)} 2024-01-15 14:02|`))
  assert.ok(out.includes('|1h30m30s|'))
  assert.ok(out.includes('|87%|'))
  assert.ok(out.includes('|v1.2.3|'))
  assert.ok(out.includes(`|${gl(0xf15b)} .env|`))
  assert.equal(chips(out), 12)
})

test('conventional branch prefixes chip with the fork icon', () => {
  const fork = gl(0xf126)
  const out = plain('`perf/http` `revert/abc123` `ci/lint` chip')
  assert.ok(out.includes(`|${fork} perf/http|`))
  assert.ok(out.includes(`|${fork} revert/abc123|`))
  assert.ok(out.includes(`|${fork} ci/lint|`))
  assert.equal(chips(out), 3)
})

test('file and branch tokens chip inside code spans with their icons', () => {
  const file = gl(0xf15b)
  const fork = gl(0xf126)
  const out = plain('`a.js` `a.js:12` `README` `docs/guide` chip')
  assert.ok(out.includes(`|${file} a.js|`))
  assert.ok(out.includes(`|${file} a.js:12|`))
  assert.ok(out.includes(`|${file} README|`))
  assert.ok(out.includes(`|${fork} docs/guide|`))
  assert.equal(chips(out), 4)
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

test('uppercase hex runs are identifiers, not commits', () => {
  assert.equal(plain('DeadBeef123 ABCDEF1 stay'), 'DeadBeef123 ABCDEF1 stay')
  assert.equal(
    plain('`DeadBeef123` `ABCDEF1` `defaced` stay'),
    '`DeadBeef123` `ABCDEF1` `defaced` stay',
  )
})

test('env assignments need at least two key characters', () => {
  assert.equal(plain('set A=1 and B=2'), 'set A=1 and B=2')
  assert.equal(
    plain('`A=1` stays, `PATH=/bin` chips'),
    '`A=1` stays, |PATH=/bin| chips',
  )
})

test('a hash after a command word chips bare; inside code the command stays literal', () => {
  assert.equal(
    plain('run git abc1234 now'),
    `run git |${gl(0xf417)} abc1234| now`,
  )
  assert.equal(plain('`git abc1234` stays'), '`git abc1234` stays')
})

test('hex colors chip inside code spans as swatches', () => {
  const out = decorate('`#a576c7`', palette)
  assert.ok(out.includes('\x1b[48;2;165;118;199m'))
  assert.equal(
    plain('`#1234567` `#a576c7ff` stay'),
    '`#1234567` `#a576c7ff` stay',
  )
})

test('a padded code span chips after commonmark space stripping', () => {
  assert.equal(
    plain('padded ` abc1234 ` end'),
    `padded |${gl(0xf417)} abc1234| end`,
  )
  assert.equal(plain('one-sided ` abc1234` end'), 'one-sided ` abc1234` end')
})

test('a chip inside bold reopens weight and color', () => {
  const out = decorate('**see `b5a0d9f` now**', palette)
  assert.ok(out.includes('\x1b[1m<mdLink> now'))
})

test('PINA_ARTIFACTS=0 turns the inference layer off', () => {
  process.env.PINA_ARTIFACTS = '0'
  try {
    const line = 'commit abc1234 at 14:02 on feat/x with --dry-run'
    assert.equal(plain(line), line)
    assert.equal(plain('`b5a0d9f` stays'), '`b5a0d9f` stays')
  } finally {
    delete process.env.PINA_ARTIFACTS
  }
})

test('PINA_PILL_ICONS=0 drops icons and keeps color', () => {
  process.env.PINA_PILL_ICONS = '0'
  try {
    assert.equal(plain('[[Done]]', palette), '|Done|')
    assert.equal(plain('## Finding'), '## Finding')
  } finally {
    delete process.env.PINA_PILL_ICONS
  }
})

function themedContext(initial: Theme | null) {
  let current = initial
  const ctx = {
    ui: {
      get theme() {
        if (!current) throw new Error('stale ctx')
        return current
      },
    },
  } as unknown as ExtensionContext
  return {
    ctx,
    set theme(t: Theme | null) {
      current = t
    },
  }
}

function withEnv(name: string, value: string | undefined, run: () => void) {
  const saved = process.env[name]
  try {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
    run()
  } finally {
    if (saved === undefined) delete process.env[name]
    else process.env[name] = saved
  }
}

const VIOLET = '\x1b[38;2;184;161;255mx\x1b[39m'

test('the transformer decorates only assistant messages', () => {
  withEnv('PINA_BOLD_COLOR', 'mdLink', () => {
    const { ctx } = themedContext(tagTheme)
    const transform = createReplyEmphasis(() => ctx)
    assert.ok(transform('**x**', contextOf('assistant')).includes('<mdLink>'))
    assert.equal(transform('**x**', contextOf('user')), '**x**')
    assert.equal(transform('**x**', contextOf('assistant-thinking')), '**x**')
  })
})

test('a stale ctx keeps the last good theme', () => {
  withEnv('PINA_BOLD_COLOR', 'mdLink', () => {
    const session = themedContext(tagTheme)
    const transform = createReplyEmphasis(() => session.ctx)
    assert.ok(transform('**x**', contextOf('assistant')).includes('<mdLink>'))
    session.theme = null
    assert.ok(transform('**x**', contextOf('assistant')).includes('<mdLink>'))
  })
})

test('a theme switch rebuilds the palette', () => {
  withEnv('PINA_BOLD_COLOR', 'mdLink', () => {
    const session = themedContext(tagTheme)
    const transform = createReplyEmphasis(() => session.ctx)
    assert.ok(transform('**x**', contextOf('assistant')).includes('<mdLink>'))
    const other = {
      ...tagTheme,
      fg: (color: string, text: string) =>
        color === 'mdLink' ? `[bold]${text}` : `<${color}>${text}</>`,
    } as unknown as Theme
    session.theme = other
    assert.ok(transform('**x**', contextOf('assistant')).includes('[bold]'))
    assert.ok(!transform('**x**', contextOf('assistant')).includes('<mdLink>'))
  })
})

test('bold defaults to the textAnchor violet as direct truecolor', () => {
  withEnv('PINA_BOLD_COLOR', undefined, () => {
    const { ctx } = themedContext(tagTheme)
    const transform = createReplyEmphasis(() => ctx)
    assert.ok(transform('**x**', contextOf('assistant')).includes(VIOLET))
  })
})

test('PINA_BOLD_COLOR accepts raw hex', () => {
  const out = decorate('**x**', createPalette(tagTheme, '#b8a1ff'))
  assert.ok(out.includes(VIOLET))
  assert.ok(!out.includes('<mdLink>'))
})

test('three-digit hex expands', () => {
  const out = decorate('**x**', createPalette(tagTheme, '#f00'))
  assert.ok(out.includes('\x1b[38;2;255;0;0mx\x1b[39m'))
})

test('an invalid hex falls back to mdLink', () => {
  const out = decorate('**x**', createPalette(tagTheme, '#zzzzzz'))
  assert.ok(out.includes('<mdLink>'))
})
