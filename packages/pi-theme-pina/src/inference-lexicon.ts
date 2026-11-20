/**
 * Gate lists for reply-emphasis machine-token inference. The lists live here,
 * apart from the matcher, so the vocabulary of accepted artifacts can be read
 * and extended in one place; reply-emphasis compiles them into its single
 * combined regex through the *_SOURCE consts below.
 *
 * Deliberately not listed: dev, io, com, app, local, test — domain and
 * collision lookalikes (`pi.dev`, `x.test`) must stay prose. Makefile has no
 * extension and stays unmatched — accepted limitation.
 */

/** File extensions that make `[path/]name.EXT[:line[:col]]` a machine reference. */
export const FILE_EXTENSIONS: readonly string[] = [
  'js',
  'ts',
  'tsx',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'md',
  'mdx',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'kts',
  'swift',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'sh',
  'bash',
  'zsh',
  'fish',
  'yml',
  'yaml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'lock',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'xml',
  'sql',
  'txt',
  'log',
  'env',
  'gitignore',
  'npmrc',
  'prettierrc',
  'dockerfile',
  'proto',
  'graphql',
  'vue',
  'svelte',
  'astro',
  'lua',
  'ex',
  'exs',
  'erl',
  'hs',
  'scala',
  'dart',
  'r',
  'jl',
  'pl',
  'pm',
  'bat',
  'ps1',
  'mk',
  'cmake',
  'gradle',
  'properties',
  'csv',
  'tsv',
  'patch',
  'diff',
  'readme',
]

/** Leading-dot files matched by name, with no extension required. */
export const DOTFILE_NAMES: readonly string[] = [
  'env',
  'gitignore',
  'npmrc',
  'nvmrc',
  'prettierrc',
  'eslintrc',
  'editorconfig',
  'dockerignore',
  'bashrc',
  'zshrc',
  'profile',
]

/**
 * Exact lowercase `prefix/name` branch prefixes (conventional-commit style).
 * Deliberately not listed: test, build, style — plain English words whose
 * `prefix/name` shape reads more like a path or prose than a branch.
 */
export const BRANCH_PREFIXES: readonly string[] = [
  'feat',
  'feature',
  'fix',
  'bug',
  'hotfix',
  'release',
  'chore',
  'docs',
  'refactor',
  'perf',
  'revert',
  'ci',
]

/** Uppercase-only task markers; lowercase todo/hack stay ordinary words. */
export const MARKER_WORDS: readonly string[] = ['TODO', 'FIXME', 'HACK']

/** Longer words first, so `jsx` is tried before a `js` prefix of it. */
const longestFirst = (words: readonly string[]): string[] =>
  [...words].sort((a, b) => b.length - a.length)

/**
 * Per-character case-insensitive expansion (`ts` -> `[tT][sS]`; digits stay
 * literal). The combined matcher never carries the `i` flag — TODO/FIXME/HACK
 * and the hex classes depend on case — so list-driven case tolerance is baked
 * into the alternation itself.
 */
function caseInsensitiveSource(words: readonly string[]): string {
  return longestFirst(words)
    .map((word) =>
      [...word]
        .map((ch) => (/[a-zA-Z]/.test(ch) ? `[${ch}${ch.toUpperCase()}]` : ch))
        .join(''),
    )
    .join('|')
}

export const FILE_EXTENSION_SOURCE = caseInsensitiveSource(FILE_EXTENSIONS)
export const DOTFILE_NAME_SOURCE = longestFirst(DOTFILE_NAMES).join('|')
export const BRANCH_PREFIX_SOURCE = longestFirst(BRANCH_PREFIXES).join('|')
export const MARKER_WORD_SOURCE = MARKER_WORDS.join('|')
export const README_NAME_SOURCE = caseInsensitiveSource(['readme'])
