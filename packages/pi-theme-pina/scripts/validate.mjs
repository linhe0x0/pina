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

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const themesDir = path.join(root, 'themes')
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

const expectedVars = Object.fromEntries(
  Object.keys(core.tokens).map((name) => [camel(name), hexOf(name)]),
)
const knownVars = new Set(Object.keys(expectedVars))

const generatedPath = path.join(root, 'src', 'design-tokens.gen.ts')
try {
  const source = await readFile(generatedPath, 'utf8')
  const entries = [...source.matchAll(/^  (\w+): '(#[0-9a-fA-F]{6})',$/gm)].map(
    ([, name, hex]) => [name, hex],
  )
  const generatedVars = Object.fromEntries(entries)
  if (
    source.trim().length === 0 ||
    JSON.stringify(generatedVars) !== JSON.stringify(expectedVars)
  ) {
    throw new Error(
      'src/design-tokens.gen.ts is out of date with tokens.json (run `make build`)',
    )
  }
  console.log('OK   src/design-tokens.gen.ts')
} catch (error) {
  failed = true
  console.error(`FAIL src/design-tokens.gen.ts\n${error.message}`)
}

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
    if (json.name !== path.basename(file, '.json')) {
      throw new Error(
        `theme name "${json.name}" must match filename (expected "${json.name}.json")`,
      )
    }
    if (JSON.stringify(json.vars ?? {}) !== JSON.stringify(expectedVars)) {
      throw new Error(
        `vars are out of date with tokens.json (run \`make build\`)`,
      )
    }
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
