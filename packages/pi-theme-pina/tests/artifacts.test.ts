import test from 'node:test'
import assert from 'node:assert/strict'
import { createPalette } from '../src/reply/palette.ts'
import { decorate } from '../src/reply/reply-decorate.ts'
import { palette, plain, tagTheme } from './helpers.ts'

const gl = (cp: number) => String.fromCodePoint(cp)

const chips = (out: string) => (out.match(/\|/g) ?? []).length / 2

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

test('signed durations chip whole, with the sign inside the chip', () => {
  const out = plain('offset +1s, drift -1s, took +1h30m and saved -1.5s')
  assert.ok(out.includes('|+1s|'))
  assert.ok(out.includes('|-1s|'))
  assert.ok(out.includes('|+1h30m|'))
  assert.ok(out.includes('|-1.5s|'))
  assert.equal(chips(out), 4)
  assert.equal(plain('x+1s and -x stay apart'), 'x+|1s| and -x stay apart')
})

test('a uuid chips once and no hash is carved out of it', () => {
  const out = plain('id 550e8400-e29b-41d4-a716-446655440000')
  assert.ok(out.includes('|550e8400-e29b-41d4-a716-446655440000|'))
  assert.equal(chips(out), 1)
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
    'a.js README.md src/auth.ts .env README README.MD a.js:12 src/auth.ts:42:21',
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
  ]) {
    assert.ok(out.includes(`|${gl(0xf15b)} ${token}|`), token)
  }
  assert.equal(chips(out), 8)
})

test('non-whitelisted lookalikes stay untouched', () => {
  const line = 'pi.dev e.g. No.1 documents x.test run.app y.io a.local'
  assert.equal(plain(line), line)
})

test('bare Makefile and Dockerfile names chip with the file icon', () => {
  const out = plain('edit Makefile or makefile then Dockerfile')
  assert.ok(out.includes(`|${gl(0xf15b)} Makefile|`))
  assert.ok(out.includes(`|${gl(0xf15b)} makefile|`))
  assert.ok(out.includes(`|${gl(0xf15b)} Dockerfile|`))
  assert.equal(chips(out), 3)
})

test('bare Makefile name binds line and column suffixes', () => {
  const out = plain('Makefile:12 and Makefile:42:7')
  assert.ok(out.includes(`|${gl(0xf15b)} Makefile:12|`))
  assert.ok(out.includes(`|${gl(0xf15b)} Makefile:42:7|`))
  assert.equal(chips(out), 2)
})

test('new dotfile names chip; bare-name lookalikes stay untouched', () => {
  const out = plain(
    'tune .prettierignore .eslintignore .swiftformat keep .gitignore',
  )
  assert.ok(out.includes('|.prettierignore|'))
  assert.ok(out.includes('|.eslintignore|'))
  assert.ok(out.includes('|.swiftformat|'))
  assert.ok(out.includes(`|${gl(0xf15b)} .gitignore|`))
  assert.equal(chips(out), 4)
  assert.equal(
    plain('makefiles and GNUmakefile stay'),
    'makefiles and GNUmakefile stay',
  )
})

test('slash-joined bare names, dotfiles and directory forms stay untouched', () => {
  const out = plain(
    'readme/makefile/dockerfile pair .prettierrc/.eslintrc src/README docs/README src/Makefile config/.prettierrc Makefile/ Dockerfile/',
  )
  assert.equal(chips(out), 0)
  assert.ok(out.includes('readme/makefile/dockerfile'))
  assert.ok(out.includes('.prettierrc/.eslintrc'))
})

test('new bare filenames and uppercase fixed names chip with the file icon', () => {
  const out = plain(
    'update Jenkinsfile Vagrantfile Procfile Justfile Gemfile Rakefile Podfile Cartfile Brewfile CODEOWNERS LICENSE CONTRIBUTING CHANGELOG',
  )
  for (const token of [
    'Jenkinsfile',
    'Vagrantfile',
    'Procfile',
    'Justfile',
    'Gemfile',
    'Rakefile',
    'Podfile',
    'Cartfile',
    'Brewfile',
    'CODEOWNERS',
    'LICENSE',
    'CONTRIBUTING',
    'CHANGELOG',
  ]) {
    assert.ok(out.includes(`|${gl(0xf15b)} ${token}|`), token)
  }
  assert.equal(chips(out), 13)
})

test('lowercase and mixed-case english-word file names stay untouched', () => {
  const line =
    'need a license, thanks for contributing, read the changelog, a License form'
  assert.equal(plain(line), line)
})

test('new dotfile names chip, including compound and hyphenated forms', () => {
  const tokens = [
    '.gitattributes',
    '.gitmodules',
    '.gitkeep',
    '.gitconfig',
    '.node-version',
    '.ruby-version',
    '.python-version',
    '.tool-versions',
    '.babelrc',
    '.browserslistrc',
    '.stylelintrc',
    '.npmignore',
    '.yarnrc',
    '.clang-format',
  ]
  const out = plain([...tokens, '.swiftlint.yml'].join(' '))
  for (const token of tokens) {
    assert.ok(out.includes(`|${token}|`), token)
  }
  assert.ok(out.includes(`|${gl(0xf15b)} .swiftlint.yml|`))
  assert.equal(chips(out), tokens.length + 1)
})

test('new build-file extensions chip', () => {
  const out = plain(
    'go.mod go.sum main.tf vars.tfvars flake.nix BUILD.bazel app.xcconfig',
  )
  for (const token of [
    'go.mod',
    'go.sum',
    'main.tf',
    'vars.tfvars',
    'flake.nix',
    'BUILD.bazel',
    'app.xcconfig',
  ]) {
    assert.ok(out.includes(`|${gl(0xf15b)} ${token}|`), token)
  }
  assert.equal(chips(out), 7)
})

test('markers, env assignments and branches chip', () => {
  const out = plain(
    '87% done, TODO: fix --dry-run, set NODE_ENV=prod on feat/x',
  )
  assert.ok(out.includes('|87%|'))
  assert.ok(out.includes(`|${gl(0xf0ae)} TODO|`))
  assert.ok(out.includes('|NODE_ENV=prod|'))
  assert.ok(out.includes(`|${gl(0xf126)} feat/x|`))
  assert.equal(chips(out), 4)
  assert.ok(out.includes('--dry-run'))
})

test('lowercase env keys, short and long flags, triple dashes and marker lookalikes stay untouched', () => {
  const line =
    'node_env=prod stays, -x --dry-run ---weird too, TODOS and fixup remain'
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

test('a code span that is exactly one inferred token chips like its bare form', () => {
  const fork = gl(0xf126)
  const out = plain(
    'see `b5a0d9f`, `src/auth.ts:42:21`, `NODE_ENV=prod`, `#123`, `feat/x`, `refactor/module`, `2024-01-15 14:02`, `1h30m30s`, `87%`, `v1.2.3`, `.env`',
  )
  assert.ok(out.includes(`|${gl(0xf417)} b5a0d9f|`))
  assert.ok(out.includes(`|${gl(0xf15b)} src/auth.ts:42:21|`))
  assert.ok(out.includes('|NODE_ENV=prod|'))
  assert.ok(out.includes('|#123|'))
  assert.ok(out.includes(`|${fork} feat/x|`))
  assert.ok(out.includes(`|${fork} refactor/module|`))
  assert.ok(out.includes(`|${gl(0xf017)} 2024-01-15 14:02|`))
  assert.ok(out.includes('|1h30m30s|'))
  assert.ok(out.includes('|87%|'))
  assert.ok(out.includes('|v1.2.3|'))
  assert.ok(out.includes(`|${gl(0xf15b)} .env|`))
  assert.equal(chips(out), 11)
})

test('conventional branch prefixes chip with the fork icon', () => {
  const fork = gl(0xf126)
  const out = plain('`perf/http` `revert/abc123` `ci/lint` `build/api` chip')
  assert.ok(out.includes(`|${fork} perf/http|`))
  assert.ok(out.includes(`|${fork} revert/abc123|`))
  assert.ok(out.includes(`|${fork} ci/lint|`))
  assert.ok(out.includes(`|${fork} build/api|`))
  assert.equal(chips(out), 4)
  assert.equal(plain('feat/Auth-Flow and docs/README stay'), 'feat/Auth-Flow and docs/README stay')
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

test('artifacts: false turns the inference layer off', () => {
  const gated = createPalette(tagTheme, { artifacts: false })
  const line = 'commit abc1234 at 14:02 on feat/x with --dry-run'
  assert.equal(plain(line, gated), line)
  assert.equal(plain('`b5a0d9f` stays', gated), '`b5a0d9f` stays')
})
