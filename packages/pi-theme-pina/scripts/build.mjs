import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadTokens, packageRoot } from './tokens.mjs'

const vars = await loadTokens()

const themesDir = path.join(packageRoot, 'themes')
let failed = false

const GENERATED = path.join(packageRoot, 'src/theme/design-tokens.gen.ts')
const generated = `export const DESIGN_TOKENS = {
${Object.entries(vars)
  .map(([name, hex]) => `  ${name}: '${hex}',`)
  .join('\n')}
} as const
`
try {
  let current = null
  try {
    current = await readFile(GENERATED, 'utf8')
  } catch {}
  if (current === generated) {
    console.log('OK   src/theme/design-tokens.gen.ts')
  } else {
    await writeFile(GENERATED, generated)
    console.log('SYNC src/theme/design-tokens.gen.ts')
  }
} catch (error) {
  failed = true
  console.error(`FAIL src/theme/design-tokens.gen.ts\n${error.message}`)
}

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
