// Syncs the `vars` field of every theme file in themes/ with the design core (tokens.json).
// Token values are hexes; `$name` references another token and resolves to its hex. Everything
// else in a theme file (name, appearance, colors, export) is hand-maintained and preserved.
// Whether a theme's vars are out of date is checked by scripts/validate.mjs (`make check`).
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const core = JSON.parse(await readFile(path.join(root, '../../tokens.json'), 'utf8'))

const hexOf = (name, seen = new Set()) => {
  if (seen.has(name)) throw new Error(`circular reference at "${name}"`)
  seen.add(name)
  const value = core.tokens?.[name]
  if (value === undefined) throw new Error(`unknown token "${name}"`)
  if (value.startsWith('#')) return value
  if (value.startsWith('$')) return hexOf(value.slice(1), seen)
  throw new Error(
    `"${name}" must be a hex value or a $reference (got "${value}")`,
  )
}

const camel = (kebab) =>
  kebab
    .split('-')
    .map((part, i) => (i ? part[0].toUpperCase() + part.slice(1) : part))
    .join('')

const vars = Object.fromEntries(
  Object.keys(core.tokens).map((name) => [camel(name), hexOf(name)]),
)

const themesDir = path.join(root, 'themes')
let failed = false

for (const file of (await readdir(themesDir)).filter((f) =>
  f.endsWith('.json'),
)) {
  const out = path.join(themesDir, file)
  try {
    const theme = JSON.parse(await readFile(out, 'utf8'))
    const ordered = {}
    let hasVars = false
    for (const [key, value] of Object.entries(theme)) {
      if (key === 'vars') hasVars = true
      ordered[key] = key === 'vars' ? vars : value
    }
    if (!hasVars) ordered.vars = vars
    const content = JSON.stringify(ordered, null, 2) + '\n'
    const current = await readFile(out, 'utf8')
    if (current === content) {
      console.log(`OK   ${file}`)
    } else {
      await writeFile(out, content)
      console.log(`SYNC ${file} (vars regenerated; colors preserved)`)
    }
  } catch (error) {
    failed = true
    console.error(`FAIL ${file}\n${error.message}`)
  }
}
process.exit(failed ? 1 : 0)
