/**
 * Emphasis rendering for assistant replies, adapted from pi-emphasis
 * (github.com/johnlindquist/pi-emphasis, MIT): `[[Word]]` status pills,
 * heading and lead-label icons, colored bold, marks, and tree connectors.
 *
 * This is the render half only — no system-prompt guidance. Pills appear
 * when a reply already uses the `[[...]]` convention (rules may live in
 * AGENTS.md or a skill); every other decoration rides on Markdown the model
 * writes anyway. Machine tokens (commits, file references, timestamps, flags,
 * ...) are inferred in one pass over raw prose and drawn as neutral pills,
 * gated by the lists in src/inference-lexicon.ts, off with PINA_ARTIFACTS=0.
 * Display-only: session data, copied text, and HTML exports
 * keep the original Markdown.
 *
 * Theme resolution follows src/user-message-border.ts: ctx.ui access is
 * wrapped for the stale window after /reload or session replacement, and the
 * palette is rebuilt when the theme object changes, so /theme switches
 * recolor new output.
 */
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
  /** Wraps bold text in a color. */
  bold: Colorize
  passed: Colorize
  failed: Colorize
  /** Opening escapes for each pill tone: label colors and the cap color. */
  pills: Record<PillTone, { label: string; cap: string }>
  /** Colors for arrows and tree connectors. */
  arrow: Colorize
  tree: Colorize
  /** Rounded Nerd Font end caps; false draws square chips with a space on each side. */
  roundCaps: boolean
}

/**
 * Each tone's words. `core` are the words a guided agent is told to write;
 * `also` are accepted and colored the same when the model writes them on
 * its own.
 */
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
/** Words that are soft blue like any unknown label, but have an icon and a place in the guidance. */
export const CONTEXT_WORDS = ['Inferred', 'New', 'Changed', 'Optional', 'Skill']

const TONE_WORDS = Object.fromEntries(
  Object.entries(VOCABULARY).map(([tone, words]) => [
    tone,
    [...words.core, ...words.also].map((w) => w.toLowerCase()),
  ]),
) as Record<Exclude<PillTone, 'neutral'>, string[]>

// Font Awesome glyphs from the Nerd Font set: one cell wide in every terminal,
// written as escapes so the source survives any copy or encoding step.
const CHECK = ''
const CROSS = ''
const CLOCK = ''
/** The icon each known pill word carries. Words without an entry stay text-only. */
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

/** Words that display as one canonical word, so the same state always reads the same. */
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

/** The icon a heading or a line's leading bold label takes from its word. */
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

// A label may open with its own Private Use Area glyph, which wins over the table's icon.
const OWN_ICON = /^\s*([\ue000-\uf8ff]|[\u{f0000}-\u{ffffd}])\s*/u

const KNOWN = [
  ...new Set([
    ...Object.values(TONE_WORDS).flat(),
    ...Object.keys(PILL_ICONS),
    ...Object.keys(SYNONYMS),
  ]),
].sort((a, b) => b.length - a.length)

/** A pill label read as its word: a known word may be followed by detail ("Passed 12/12", "Failed: 3 tests"). */
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

/** A background escape turned into the same color as a foreground, for pill caps. */
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

/**
 * DESIGN.md textAnchor: violet reserved for bold anchor terms. Pi's token set
 * has no free slot to register it, so it comes from the generated design core
 * and is emitted as direct truecolor (bypassing the theme's terminal color
 * mode).
 */
const TEXT_ANCHOR = DESIGN_TOKENS.textAnchor

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** A raw hex color as a Colorize; undefined when the hex does not parse. */
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
  // A bold color is a Pi foreground token name or a raw hex; an invalid hex
  // falls back to mdLink.
  const hex = hexColorize(boldColor)
  const bold = hex ?? fg(boldColor.startsWith('#') ? 'mdLink' : boldColor)
  const tone = (labelFg: string, bg: string) => {
    const bgAnsi = theme.getBgAnsi(bg as never)
    // A theme without its own panel colors (Pi's system theme when the terminal reports
    // none) draws pills in reverse video: the tone's color becomes the background.
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
      // Pi has no warning background token. Piña exposes its amber warning
      // surface (bg-warning #442e00 in DESIGN.md) through customMessageBg, so
      // warning pills sit yellow-on-amber instead of on the gold search-match
      // chip, where textWarning would drop to ~1:1 contrast.
      warning: tone('warning', 'customMessageBg'),
      neutral: tone('text', 'selectedBg'),
      // Solid chips in the terminal's own magenta, cyan and blue: louder than the panel-colored tones.
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
// Escaped bold markers, bold markers, a [[pill]] of 1-32 characters, or a
// single-bracket [label] of a known pill word (never a link, citation, or
// checkbox: the word must start with a letter, and \](?!\[|\() keeps markdown
// reference links, inline links, and images untouched).
const INLINE =
  /(\\*)(\*\*|__)|\[\[([^[\]\n]{1,32})\]\]|\[(?!\[)([A-Za-z][^[\]\n]{0,31})\](?!\[|\()/g

/** Apply colors to assistant Markdown, leaving code blocks, inline code, and headings alone. */
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
      // Pi already colors headings; only the label icon is added.
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

/** Lead-in words that name the action a pill calls for. With a colon they take an icon anywhere in a line. */
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

/** Prefix a known label with its icon, unless it already opens with a glyph. */
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

// A line's leading bold label, after an optional list marker or tree connector.
const LEAD_LABEL =
  /^(\s*(?:[-*+]|\d+\.)?\s*(?:[├└]──\s*)?\*\*)([^*`\n]{1,32})(\*\*)/

/**
 * The end caps and inner padding shared by pills and swatches: rounded caps
 * in the given cap color, or a padding space on each side for square chips.
 */
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

/**
 * Hex color swatch: the matched color itself as the pill background, with ink
 * picked at the contrast-optimal point (relative luminance ~0.19) so text
 * stays readable on bright and dark swatches alike. Truecolor regardless of
 * the theme's color mode — the background is the matched value, not a token.
 */
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
  // No-break spaces keep a two-word pill on one line when Pi wraps the paragraph.
  const { icon, word } = splitLabel(label)
  const text = (
    icon && word && process.env.PINA_PILL_ICONS !== '0'
      ? `${icon} ${word}`
      : word || label.trim()
  ).replace(/ /g, ' ')
  const { pad, capL, capR } = pillEdges(palette, style.cap)
  return `${capL}${style.label}\x1b[1m${pad}${text}${pad}\x1b[22;27m\x1b[39m\x1b[49m${capR}`
}

// Machine-token inference, display-only: every recognized artifact becomes a
// neutral pill so its boundaries stay copy-ready. ONE combined regex, ONE
// replace pass, run on raw prose before any escape sequence exists — a later
// pass over text carrying SGR escapes would bite into sequences like \x1b[1m.
// The PILL_BRACKETS split runs first, so user-written [[...]] / [...] pills
// are never inferred over. Alternatives are ordered most-specific first and a
// match consumes greedily, so inner tokens are never carved out; the gate
// lists live in src/inference-lexicon.ts.
const PILL_BRACKETS =
  /(\[\[[^[\]\n]{1,32}\]\]|\[(?!\[)[A-Za-z][^[\]\n]{0,31}\](?!\[|\())/
// A file's optional :line-line:col-col suffix, shared by the matcher and the icon router.
const LINE_COL_SUFFIX = ':\\d{1,5}(?:-\\d{1,5})?(?::\\d{1,5}(?:-\\d{1,5})?)?'

const ARTIFACT_SOURCES = [
  // UUID: chipped whole so no commit hash is carved out of it.
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/
    .source,
  // File with optional line/col suffix, one span (a.js, src/auth.ts:42:21).
  // Case tolerance comes from the lexicon's per-char expansion, not a flag.
  `(?<![\\w./@-])[\\w@.-]+(?:\\/[\\w@.-]+)*\\.(?:${FILE_EXTENSION_SOURCE})(?![\\w])(?:${LINE_COL_SUFFIX})?(?![\\w])`,
  // Dotfile names.
  `(?<![\\w./@-])\\.(?:${DOTFILE_NAME_SOURCE})(?:\\.\\w{1,8})*(?![\\w-])`,
  // Bare README; README.md is consumed by the file branch above, and a
  // colon not followed by digits stays prose.
  `(?<![\\w./@-])${README_NAME_SOURCE}(?![\\w-])`,
  // Issue reference: 1-5 digits leaves 6-digit numbers free for hex colors.
  /(?<![\w#])#\d{1,5}\b/.source,
  // Hex color: exactly six hex digits, pure digits included; 3/4/8-digit
  // forms stay untouched.
  /#[0-9a-fA-F]{6}(?![0-9a-fA-F])/.source,
  // Datetime with an optional time part as one span; the lookbehind keeps
  // glued digit runs (12024-01-15) from half-matching.
  /(?<![\w.])\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?Z?)?/.source,
  // Clock time.
  /(?<![\d:.])\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?![\d.])/.source,
  // Semver; the trailing lookahead keeps IPs from half-matching.
  /(?<![\w.])v?\d+\.\d+\.\d+(?:[-+][\w.]+)*(?!\.\d)/.source,
  // IPv4.
  /(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])/.source,
  // Duration as one span: compound (1h30m30s) and plain (1.4s, 350ms).
  /\b\d+(?:\.\d+)?(?:ms|s|m|h)(?:\d+(?:\.\d+)?(?:ms|s|m|h))*\b/.source,
  // Size (uppercase-B forms).
  /\b\d+(?:\.\d+)?\s?(?:[KMGT]i?B|B)\b/.source,
  // Commit hash with at least one digit, lowercase-only: git never emits
  // uppercase, so mixed-case hex runs (CapsuleEventFlowTests, DeadBeef123)
  // are identifiers; the lookbehind keeps #1234567 out of it.
  /(?<![\w/#-])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w/-])/.source,
  // Percent.
  /\b\d+(?:\.\d+)?%/.source,
  // Env assignment: all-caps key of at least 2 characters (A=1 stays
  // prose), non-empty value.
  /\b[A-Z][A-Z0-9_]+=[\w./:-]+/.source,
  // Markers, uppercase-only.
  `\\b(?:${MARKER_WORD_SOURCE})\\b`,
  // CLI long option.
  /(?<![\w-])--[\w][\w-]*\b/.source,
  // Branch: exact lowercase prefix over a name; trailing path chars excluded.
  `(?<![\\w./@-])(?:${BRANCH_PREFIX_SOURCE})\\/[\\w-]+(?:\\.[\\w-]+)*(?![\\w/-])`,
]

// One combined matcher for bare prose, and its anchored twin for testing a
// code span's entire content — the same alternatives, no free text around
// the token. The anchored twin carries no `g` flag, so repeated `.test()`
// calls stay stateless.
const ARTIFACTS = new RegExp(ARTIFACT_SOURCES.join('|'), 'g')
const ARTIFACT_EXACT = new RegExp(`^(?:${ARTIFACT_SOURCES.join('|')})$`)

// Icons for inferred tokens, routed through pill()'s own-glyph path: a label
// opening with a Private Use Area glyph keeps it as the icon. Only reference
// kinds carry icons — context tokens (size/percent/env/flag...) read quieter
// without one.
const INFERENCE_ICONS = {
  commit: '\uf417',
  branch: '\uf126',
  file: '\uf15b',
  time: '\uf017',
}

/**
 * The icon an inferred token carries, or undefined for icon-less kinds.
 * Whitelisted extensions and branch prefixes come from the lexicon; branch
 * detection runs after the extension check so docs/readme.md reads as a file.
 */
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

/**
 * Split a line into prose and inline-code parts by CommonMark backtick-run
 * pairing: an opening run of N backticks closes at the next run of exactly N,
 * runs of any other length in between are content, and an unclosed opening
 * run stays literal prose (scanning resumes after it). Odd indices are full
 * code spans (delimiters included), even indices are prose — the parity
 * contract the old regex split had, but pairing-exact: `` `` `x` `` `` is one
 * span whose content contains backticks, never three mispaired fragments.
 */
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

/**
 * The content of a full code-span part: the characters between its delimiter
 * runs, with CommonMark's one-space strip applied when both ends carry one
 * and the content is not all spaces.
 */
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

/**
 * One inferred token as a pill (hex colors as swatches), reopening bold when
 * the chip sits inside a bold span — the pill resets both weight and color.
 */
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
  // Odd parts are inline code spans, which stay untouched.
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
      // A code span whose entire content is exactly one inferred token chips
      // like its bare form — models habitually backtick references — while
      // anything else (commands with words, prose identifiers, user pills,
      // padded spans) stays literal with its delimiters preserved.
      if (process.env.PINA_ARTIFACTS !== '0') {
        const content = codeSpanContent(part)
        if (ARTIFACT_EXACT.test(content)) {
          result += chipToken(content, palette, reopen)
          continue
        }
      }
      // Pi's code color ends with a foreground reset; restore the bold color after it.
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
          // Single brackets only pill known words; anything else (citations,
          // checkboxes, plain bracketed prose) stays as typed. A preceding
          // backslash means an escaped bracket.
          if (offset > 0 && str[offset - 1] === '\\') return match
          if (!splitLabel(single).known) return match
          return pill(single, palette) + reopen()
        }
        if ((slashes ?? '').length % 2 === 1) return match // escaped marker
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
  // An unclosed span (streaming or literal asterisks) ends its color at the line end.
  if (inBold) result += close
  return result
}

/**
 * The reply-emphasis transformer: decorates assistant Markdown with the
 * current theme's palette. Surfaces it does not own (thinking blocks pass
 * through src/thinking-quote.ts at the entry) and messages rendered before
 * a theme is known are returned unchanged.
 */
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
      // ctx rejected (stale after reload/session replacement): keep last good.
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
