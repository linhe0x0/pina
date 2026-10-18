// Validates themes/*.json against pi's published theme schema and against the design core
// (tokens.json):
// 1. schema conformance, and the theme name matches the filename
// 2. `vars` matches the core exactly — when out of date, run `make build`
// 3. every var value resolves to a core hex
// 4. `colors` / `export` reference vars only, never raw hex
// The schema validator comes from @earendil-works/pi-coding-agent (devDependency). Its exports
// map does not expose the schema module, so import the installed file directly from node_modules.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  '@earendil-works',
  'pi-coding-agent',
  'dist',
  'modes',
  'interactive',
  'theme',
  'theme-schema.js',
)

let validateThemeJson
try {
  ;({ validateThemeJson } = await import(pathToFileURL(schemaPath).href))
} catch {
  console.error(
    'Could not load @earendil-works/pi-coding-agent. Run `pnpm install` first.',
  )
  process.exit(1)
}

const themesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'themes',
)
const core = JSON.parse(
  await readFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../',
      'tokens.json',
    ),
    'utf8',
  ),
)

// Token values are hexes; $name references another token and resolves to its hex.
const hexOf = (name, seen = new Set()) => {
  if (seen.has(name)) throw new Error(`circular reference at "${name}"`)
  seen.add(name)
  const value = core.tokens[name]
  if (value === undefined) throw new Error(`unknown token "${name}"`)
  if (value.startsWith('#')) return value
  if (value.startsWith('$')) return hexOf(value.slice(1), seen)
  throw new Error(
    `token "${name}" must be a hex value or a $reference (got "${value}")`,
  )
}

const camel = (kebab) =>
  kebab
    .split('-')
    .map((part, i) => (i ? part[0].toUpperCase() + part.slice(1) : part))
    .join('')

// What `make build` would produce for vars, and the var names colors may reference.
const expectedVars = Object.fromEntries(
  Object.keys(core.tokens).map((name) => [camel(name), hexOf(name)]),
)
const knownVars = new Set(Object.keys(expectedVars))

const files = (await readdir(themesDir)).filter((f) => f.endsWith('.json'))
if (files.length === 0) {
  console.error(`No theme files found in ${themesDir}`)
  process.exit(1)
}

let failed = false
for (const file of files) {
  const json = JSON.parse(await readFile(path.join(themesDir, file), 'utf8'))
  try {
    validateThemeJson(file, json)
    // Pi resolves the user theme by <name>.json, so the filename must match the theme name.
    if (json.name !== path.basename(file, '.json')) {
      throw new Error(
        `theme name "${json.name}" must match filename (expected "${json.name}.json")`,
      )
    }
    // Vars are generated, never hand-edited: they must equal the core mirror byte for byte.
    if (JSON.stringify(json.vars ?? {}) !== JSON.stringify(expectedVars)) {
      throw new Error(
        `vars are out of date with tokens.json (run \`make build\`)`,
      )
    }
    // Colors and export may only reference vars — never raw hex, never unknown names.
    for (const [key, value] of [
      ...Object.entries(json.colors ?? {}),
      ...Object.entries(json.export ?? {}),
    ]) {
      if (typeof value !== 'string' || !knownVars.has(value)) {
        throw new Error(
          `color "${key}" must reference a var (got ${JSON.stringify(value)})`,
        )
      }
    }
    console.log(`OK   ${file} (${json.name})`)
  } catch (error) {
    failed = true
    console.error(`FAIL ${file}\n${error.message}`)
  }
}
process.exit(failed ? 1 : 0)
