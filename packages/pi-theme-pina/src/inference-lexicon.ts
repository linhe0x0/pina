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

export const MARKER_WORDS: readonly string[] = ['TODO', 'FIXME', 'HACK']

const longestFirst = (words: readonly string[]): string[] =>
  [...words].sort((a, b) => b.length - a.length)

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
