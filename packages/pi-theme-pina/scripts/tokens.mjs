import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

export { packageRoot }

const camel = (kebab) =>
  kebab
    .split('-')
    .map((part, i) => (i ? part[0].toUpperCase() + part.slice(1) : part))
    .join('')

export async function loadTokens() {
  const core = JSON.parse(
    await readFile(path.join(packageRoot, '../../tokens.json'), 'utf8'),
  )
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
  return Object.fromEntries(
    Object.keys(core.tokens).map((name) => [camel(name), hexOf(name)]),
  )
}

export async function loadTheme(name) {
  return JSON.parse(
    await readFile(path.join(packageRoot, 'themes', `${name}.json`), 'utf8'),
  )
}
