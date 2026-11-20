import type {
  ExtensionContext,
  MarkdownTransformer,
  Theme,
} from '@earendil-works/pi-coding-agent'
import { DESIGN_TOKENS } from './design-tokens.gen.ts'
import {
  BRANCH_PREFIXES,
  BRANCH_PREFIX_SOURCE,
  DOTFILE_NAME_SOURCE,
  FILE_EXTENSIONS,
  FILE_EXTENSION_SOURCE,
  MARKER_WORD_SOURCE,
  README_NAME_SOURCE,
} from './inference-lexicon.ts'

type Colorize = (text: string) => string

export type PillTone =
  'success' | 'error' | 'warning' | 'critical' | 'mode' | 'owner' | 'neutral'

export interface Palette {
  bold: Colorize
  passed: Colorize
  failed: Colorize
  pills: Record<PillTone, { label: string; cap: string }>
  arrow: Colorize
  tree: Colorize
  roundCaps: boolean
}

export const VOCABULARY: Record<
  Exclude<PillTone, 'neutral'>,
  { core: string[]; also: string[] }
> = {
  error: {
    core: ['Failed', 'Blocked', 'Broken', 'Unsafe'],
    also: ['fail', 'failing', 'error', 'rejected', 'down'],
  },
  warning: {
    core: [
      'Needs you',
      'Decision',
      'Unverified',
      'Partial',
      'Skipped',
      'In progress',
      'Pending',
      'At risk',
    ],
    also: ['needs review', 'waiting', 'review', 'todo', 'stale', 'draft'],
  },
  success: {
    core: [
      'Done',
      'Passed',
      'Observed',
      'Fixed',
      'Live',
      'Recommended',
      'Keep',
    ],
    also: [
      'pass',
      'ready',
      'merged',
      'safe',
      'verified',
      'shipped',
      'ok',
      'approved',
      'complete',
      'completed',
      'finished',
      'healthy',
    ],
  },
  critical: { core: ['Costs money', 'Destructive', 'Irreversible'], also: [] },
  mode: {
    core: ['Brainstorm', 'Investigate', 'Preview', 'Implement', 'Qualify'],
    also: [],
  },
  owner: { core: ['Owned', 'Shared', 'Foreign'], also: [] },
}
export const CONTEXT_WORDS = ['Inferred', 'New', 'Changed', 'Optional', 'Skill']

const TONE_WORDS = Object.fromEntries(
  Object.entries(VOCABULARY).map(([tone, words]) => [
    tone,
    [...words.core, ...words.also].map((w) => w.toLowerCase()),
  ]),
) as Record<Exclude<PillTone, 'neutral'>, string[]>

const CHECK = ''
const CROSS = ''
const CLOCK = ''
const PILL_ICONS: Record<string, string> = {
  done: CHECK,
  passed: CHECK,
  pass: CHECK,
  complete: CHECK,
  completed: CHECK,
  ok: CHECK,
  verified: CHECK,
  observed: '',
  recommended: '',
  fixed: '',
  live: '',
  shipped: '',
  approved: '',
  failed: CROSS,
  fail: CROSS,
  failing: CROSS,
  error: CROSS,
  rejected: CROSS,
  blocked: '',
  broken: '',
  unsafe: '',
  down: '',
  'needs you': '',
  decision: '',
  unverified: '',
  'at risk': '',
  'in progress': '',
  pending: CLOCK,
  waiting: CLOCK,
  partial: '',
  skipped: '',
  inferred: '',
  new: '',
  changed: '',
  optional: '',
  skill: '',
  'costs money': '',
  destructive: '',
  irreversible: '',
  review: '',
  stale: '',
  draft: '',
  safe: '',
  brainstorm: '',
  investigate: '',
  preview: '',
  implement: '',
  qualify: '',
  owned: '',
  shared: '',
  foreign: '',
  keep: '',
  ready: CHECK,
  merged: '',
  healthy: '',
  todo: '',
}

const SYNONYMS: Record<string, string> = {
  complete: 'Done',
  completed: 'Done',
  ok: 'Done',
  finished: 'Done',
  pass: 'Passed',
  fail: 'Failed',
  failing: 'Failed',
  error: 'Failed',
  waiting: 'Pending',
  'needs review': 'Review',
}

const LABEL_ICONS: Record<string, string> = {
  finding: '',
  terminal: '',
  folder: '',
  file: '',
  branch: '',
  review: '',
  ideas: '',
  cause: '',
  fix: '',
  fixed: '',
  risk: '',
  limits: '',
  next: '',
  rollback: '',
  undo: '',
  options: '',
  result: '',
  why: '',
  how: '',
  cost: '',
  rule: '',
  example: '',
  checked: '',
  pills: '',
  colors: '',
  icons: '',
  scoreboard: '',
  verdict: '',
  effect: '',
  evidence: '',
  plan: '',
  status: '',
  decision: '',
}

const OWN_ICON = /^\s*([\ue000-\uf8ff]|[\u{f0000}-\u{ffffd}])\s*/u

const KNOWN = [
  ...new Set([
    ...Object.values(TONE_WORDS).flat(),
    ...Object.keys(PILL_ICONS),
    ...Object.keys(SYNONYMS),
  ]),
].sort((a, b) => b.length - a.length)

function splitLabel(label: string): {
  icon: string | undefined
  word: string
  key: string
  known: boolean
} {
  const own = label.match(OWN_ICON)
  const text = (own ? label.slice(own[0].length) : label)
    .replace(/\s+/g, ' ')
    .trim()
  const lower = text.toLowerCase()
  const known = KNOWN.find(
    (k) => lower === k || (lower.startsWith(k) && /[ :]/.test(lower[k.length])),
  )
  const canonical = known ? SYNONYMS[known] : undefined
  const key = (canonical ?? known ?? lower).toLowerCase()
  const word = canonical && known ? canonical + text.slice(known.length) : text
  return {
    icon: own?.[1] ?? PILL_ICONS[key],
    word,
    key,
    known: known !== undefined,
  }
}

export function toneOf(label: string): PillTone {
  const { key } = splitLabel(label)
  for (const tone of [
    'critical',
    'error',
    'warning',
    'success',
    'mode',
    'owner',
  ] as const) {
    if (TONE_WORDS[tone].includes(key)) return tone
  }
  return 'neutral'
}

function bgToFg(bg: string): string {
  return bg
    .replace(/\x1b\[48;/g, '\x1b[38;')
    .replace(
      /\x1b\[(4|10)([0-7])m/g,
      (_, p: string, n: string) => `\x1b[${p === '4' ? '3' : '9'}${n}m`,
    )
}

const solid = (code: number) => ({
  label: `\x1b[${code}m\x1b[7m`,
  cap: `\x1b[${code}m`,
})

const TEXT_ANCHOR = DESIGN_TOKENS.textAnchor

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function hexColorize(hex: string): Colorize | undefined {
  const m = hex.match(HEX_COLOR)
  if (!m) return undefined
  const n = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
  const open = `\x1b[38;2;${r};${g};${b}m`
  return (text: string) => open + text + '\x1b[39m'
}

export function createPalette(
  theme: Theme,
  boldColor: string = TEXT_ANCHOR,
): Palette {
  const fg = (name: string) => (text: string) => theme.fg(name as never, text)
  const hex = hexColorize(boldColor)
  const bold = hex ?? fg(boldColor.startsWith('#') ? 'mdLink' : boldColor)
  const tone = (labelFg: string, bg: string) => {
    const bgAnsi = theme.getBgAnsi(bg as never)
    if (!bgAnsi || /^\x1b\[49m$/.test(bgAnsi)) {
      const fgAnsi = theme.getFgAnsi(
        (labelFg === 'text' ? 'accent' : labelFg) as never,
      )
      return { label: `${fgAnsi}\x1b[7m`, cap: fgAnsi }
    }
    return {
      label: bgAnsi + theme.getFgAnsi(labelFg as never),
      cap: bgToFg(bgAnsi),
    }
  }
  return {
    bold,
    passed: fg('success'),
    failed: fg('error'),
    pills: {
      success: tone('success', 'toolSuccessBg'),
      error: tone('error', 'toolErrorBg'),
      warning: tone('warning', 'customMessageBg'),
      neutral: tone('text', 'selectedBg'),
      critical: solid(35),
      mode: solid(36),
      owner: solid(34),
    },
    arrow: fg('accent'),
    tree: fg('dim'),
    roundCaps: process.env.PINA_ROUND_CAPS !== '0',
  }
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const INLINE =
  /(\\*)(\*\*|__)|\[\[([^[\]\n]{1,32})\]\]|\[(?!\[)([A-Za-z][^[\]\n]{0,31})\](?!\[|\()/g

export function decorate(markdown: string, palette: Palette): string {
  const [open, close] = palette.bold('\u0000').split('\u0000') as [
    string,
    string,
  ]
  const out: string[] = []
  let fence: string | undefined
  for (const line of markdown.split('\n')) {
    const fenceMatch = line.match(FENCE)
    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence[0] &&
        fenceMatch[1].length >= fence.length
      )
        fence = undefined
      out.push(line)
    } else if (fenceMatch) {
      fence = fenceMatch[1]
      out.push(line)
    } else if (/^ {0,3}#{1,6}\s/.test(line)) {
      out.push(
        line.replace(
          /^( {0,3}#{1,6}\s+)(.+)$/,
          (_, hashes: string, title: string) => hashes + withLabelIcon(title),
        ),
      )
    } else {
      out.push(decorateLine(line, palette, open, close))
    }
  }
  return out.join('\n')
}

const ACTION_ICONS: Record<string, string> = {
  check: '',
  do: '',
  next: '',
  unblock: '',
  left: '',
  run: '',
  guard: '',
  undo: '',
  see: '',
}
const ACTION_LABEL = new RegExp(
  `(\\*\\*)(${Object.keys(ACTION_ICONS).join('|')})(:\\*\\*)`,
  'gi',
)

function withLabelIcon(label: string): string {
  if (OWN_ICON.test(label) || process.env.PINA_PILL_ICONS === '0') return label
  const word = label
    .replace(/[:\s]+$/, '')
    .trim()
    .toLowerCase()
  const icon =
    LABEL_ICONS[word] ??
    (label.trimEnd().endsWith(':') ? ACTION_ICONS[word] : undefined)
  return icon ? `${icon} ${label}` : label
}

const LEAD_LABEL =
  /^(\s*(?:[-*+]|\d+\.)?\s*(?:[├└]──\s*)?\*\*)([^*`\n]{1,32})(\*\*)/

function pillEdges(
  palette: Palette,
  capColor: string,
): { pad: string; capL: string; capR: string } {
  const [left, right] = palette.roundCaps ? ['\uE0B6', '\uE0B4'] : ['', '']
  return {
    pad: palette.roundCaps ? '' : '\u00A0',
    capL: left ? `${capColor}${left}\x1b[39m` : '',
    capR: right ? `${capColor}${right}\x1b[39m` : '',
  }
}

function swatchChannel(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function swatchPill(match: string, palette: Palette): string {
  const r = parseInt(match.slice(1, 3), 16)
  const g = parseInt(match.slice(3, 5), 16)
  const b = parseInt(match.slice(5, 7), 16)
  const bg = `\x1b[48;2;${r};${g};${b}m`
  const cap = bgToFg(bg)
  const luma =
    0.2126 * swatchChannel(r) +
    0.7152 * swatchChannel(g) +
    0.0722 * swatchChannel(b)
  const ink = luma > 0.19 ? '\x1b[38;2;16;16;16m' : '\x1b[38;2;255;255;255m'
  const { pad, capL, capR } = pillEdges(palette, cap)
  return `${capL}${bg}${ink}\x1b[1m${pad}${match}${pad}\x1b[22;27m\x1b[39m\x1b[49m${capR}`
}

function pill(
  label: string,
  palette: Palette,
  tone: PillTone = toneOf(label),
): string {
  const style = palette.pills[tone]
  const { icon, word } = splitLabel(label)
  const text = (
    icon && word && process.env.PINA_PILL_ICONS !== '0'
      ? `${icon} ${word}`
      : word || label.trim()
  ).replace(/ /g, ' ')
  const { pad, capL, capR } = pillEdges(palette, style.cap)
  return `${capL}${style.label}\x1b[1m${pad}${text}${pad}\x1b[22;27m\x1b[39m\x1b[49m${capR}`
}

const PILL_BRACKETS =
  /(\[\[[^[\]\n]{1,32}\]\]|\[(?!\[)[A-Za-z][^[\]\n]{0,31}\](?!\[|\())/
const LINE_COL_SUFFIX = ':\\d{1,5}(?:-\\d{1,5})?(?::\\d{1,5}(?:-\\d{1,5})?)?'

const ARTIFACT_SOURCES = [
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/
    .source,
  `(?<![\\w./@-])[\\w@.-]+(?:\\/[\\w@.-]+)*\\.(?:${FILE_EXTENSION_SOURCE})(?![\\w])(?:${LINE_COL_SUFFIX})?(?![\\w])`,
  `(?<![\\w./@-])\\.(?:${DOTFILE_NAME_SOURCE})(?:\\.\\w{1,8})*(?![\\w-])`,
  `(?<![\\w./@-])${README_NAME_SOURCE}(?![\\w-])`,
  /(?<![\w#])#\d{1,5}\b/.source,
  /#[0-9a-fA-F]{6}(?![0-9a-fA-F])/.source,
  /(?<![\w.])\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?Z?)?/.source,
  /(?<![\d:.])\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?![\d.])/.source,
  /(?<![\w.])v?\d+\.\d+\.\d+(?:[-+][\w.]+)*(?!\.\d)/.source,
  /(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])/.source,
  /\b\d+(?:\.\d+)?(?:ms|s|m|h)(?:\d+(?:\.\d+)?(?:ms|s|m|h))*\b/.source,
  /\b\d+(?:\.\d+)?\s?(?:[KMGT]i?B|B)\b/.source,
  /(?<![\w/#-])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w/-])/.source,
  /\b\d+(?:\.\d+)?%/.source,
  /\b[A-Z][A-Z0-9_]+=[\w./:-]+/.source,
  `\\b(?:${MARKER_WORD_SOURCE})\\b`,
  /(?<![\w-])--[\w][\w-]*\b/.source,
  `(?<![\\w./@-])(?:${BRANCH_PREFIX_SOURCE})\\/[\\w-]+(?:\\.[\\w-]+)*(?![\\w/-])`,
]

const ARTIFACTS = new RegExp(ARTIFACT_SOURCES.join('|'), 'g')
const ARTIFACT_EXACT = new RegExp(`^(?:${ARTIFACT_SOURCES.join('|')})$`)

const INFERENCE_ICONS = {
  commit: '\uf417',
  branch: '\uf126',
  file: '\uf15b',
  time: '\uf017',
}

function inferenceIcon(match: string): string | undefined {
  const ext = new RegExp(`\\.([\\w-]{1,12})(?:${LINE_COL_SUFFIX})*$`, 'i')
    .exec(match)?.[1]
    ?.toLowerCase()
  if (ext && FILE_EXTENSIONS.includes(ext)) return INFERENCE_ICONS.file
  if (/^readme$/i.test(match)) return INFERENCE_ICONS.file
  if (/^\d{4}-\d{2}-\d{2}/.test(match) || /^\d{2}:\d{2}/.test(match))
    return INFERENCE_ICONS.time
  const prefix = match.includes('/') ? match.split('/')[0].toLowerCase() : ''
  if (BRANCH_PREFIXES.includes(prefix)) return INFERENCE_ICONS.branch
  if (/^[0-9a-f]{7,40}$/.test(match) && /\d/.test(match))
    return INFERENCE_ICONS.commit
  return undefined
}

export function splitCodeSpans(line: string): string[] {
  const parts: string[] = []
  let proseStart = 0
  let i = 0
  while (i < line.length) {
    if (line[i] !== '`') {
      i++
      continue
    }
    let openLen = 0
    while (line[i + openLen] === '`') openLen++
    let j = i + openLen
    let closer = -1
    while (j < line.length) {
      if (line[j] === '`') {
        let runLen = 0
        while (line[j + runLen] === '`') runLen++
        if (runLen === openLen) {
          closer = j
          break
        }
        j += runLen
      } else {
        j++
      }
    }
    if (closer === -1) {
      i += openLen
      continue
    }
    parts.push(line.slice(proseStart, i))
    parts.push(line.slice(i, closer + openLen))
    proseStart = closer + openLen
    i = proseStart
  }
  parts.push(line.slice(proseStart))
  return parts
}

function codeSpanContent(span: string): string {
  let n = 0
  while (span[n] === '`') n++
  let content = span.slice(n, span.length - n)
  if (
    content.length >= 2 &&
    content[0] === ' ' &&
    content[content.length - 1] === ' ' &&
    !/^\s+$/.test(content)
  )
    content = content.slice(1, -1)
  return content
}

function chipToken(
  match: string,
  palette: Palette,
  reopen: () => string,
): string {
  if (/^#[0-9a-fA-F]{6}$/.test(match))
    return swatchPill(match, palette) + reopen()
  const icon = inferenceIcon(match)
  return pill(icon ? `${icon} ${match}` : match, palette, 'neutral') + reopen()
}

function inferArtifacts(
  prose: string,
  palette: Palette,
  reopen: () => string,
): string {
  return prose
    .split(PILL_BRACKETS)
    .map((segment, i) => {
      if (i % 2 === 1) return segment
      return segment.replace(ARTIFACTS, (match) =>
        chipToken(match, palette, reopen),
      )
    })
    .join('')
}

function decorateLine(
  line: string,
  palette: Palette,
  open: string,
  close: string,
): string {
  const parts = splitCodeSpans(
    line.replace(
      LEAD_LABEL,
      (_, before: string, label: string, after: string) =>
        before + withLabelIcon(label) + after,
    ),
  )
  let result = ''
  let inBold: string | undefined
  const reopen = () => (inBold ? `\x1b[1m${open}` : '')
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (i % 2 === 1) {
      if (process.env.PINA_ARTIFACTS !== '0') {
        const content = codeSpanContent(part)
        if (ARTIFACT_EXACT.test(content)) {
          result += chipToken(content, palette, reopen)
          continue
        }
      }
      result += inBold ? `${part}${open}` : part
      continue
    }
    let prose = part
    if (process.env.PINA_ARTIFACTS !== '0')
      prose = inferArtifacts(prose, palette, reopen)
    if (process.env.PINA_PILL_ICONS !== '0')
      prose = prose.replace(
        ACTION_LABEL,
        (_, before: string, word: string, after: string) =>
          `${before}${ACTION_ICONS[word.toLowerCase()]} ${word}${after}`,
      )
    prose = prose.replace(
      /[✓✔]/g,
      (m) => palette.passed(m) + (inBold ? open : ''),
    )
    prose = prose.replace(
      /[✗✘]/g,
      (m) => palette.failed(m) + (inBold ? open : ''),
    )
    prose = prose.replace(/→/g, (m) => palette.arrow(m) + (inBold ? open : ''))
    prose = prose.replace(
      /[├└]──/g,
      (m) => palette.tree(m) + (inBold ? open : ''),
    )
    result += prose.replace(
      INLINE,
      (
        match,
        slashes: string | undefined,
        marker: string | undefined,
        label: string | undefined,
        single: string | undefined,
        offset: number,
        str: string,
      ) => {
        if (label !== undefined) {
          if (!label.trim()) return match
          return pill(label, palette) + reopen()
        }
        if (single !== undefined) {
          if (offset > 0 && str[offset - 1] === '\\') return match
          if (!splitLabel(single).known) return match
          return pill(single, palette) + reopen()
        }
        if ((slashes ?? '').length % 2 === 1) return match
        if (!inBold) {
          inBold = marker
          return `${slashes}${marker}${open}`
        }
        if (inBold === marker) {
          inBold = undefined
          return `${slashes}${close}${marker}`
        }
        return match
      },
    )
  }
  if (inBold) result += close
  return result
}

export function createReplyEmphasis(
  getCtx: () => ExtensionContext | undefined,
): MarkdownTransformer {
  let lastGoodTheme: Theme | undefined
  let built: { theme: Theme; palette: Palette } | undefined
  return (markdown, context) => {
    if (context.messageType !== 'assistant') return markdown
    let theme = lastGoodTheme
    try {
      const current = getCtx()?.ui.theme
      if (current) {
        theme = current
        lastGoodTheme = current
      }
    } catch {
    }
    if (!theme) return markdown
    if (built?.theme !== theme)
      built = {
        theme,
        palette: createPalette(
          theme,
          process.env.PINA_BOLD_COLOR || TEXT_ANCHOR,
        ),
      }
    return decorate(markdown, built.palette)
  }
}
