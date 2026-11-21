export type PillTone =
  'success' | 'error' | 'warning' | 'critical' | 'mode' | 'owner' | 'neutral'

const VOCABULARY: Record<
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

const TONE_WORDS = Object.fromEntries(
  Object.entries(VOCABULARY).map(([tone, words]) => [
    tone,
    [...words.core, ...words.also].map((w) => w.toLowerCase()),
  ]),
) as Record<Exclude<PillTone, 'neutral'>, string[]>

const CHECK = '\u{f00c}'
const CROSS = '\u{f00d}'
const CLOCK = '\u{f017}'

const PILL_ICONS: Record<string, string> = {
  done: CHECK,
  passed: CHECK,
  pass: CHECK,
  complete: CHECK,
  completed: CHECK,
  ok: CHECK,
  verified: CHECK,
  observed: '\u{f06e}',
  recommended: '\u{f005}',
  fixed: '\u{f0ad}',
  live: '\u{f135}',
  shipped: '\u{f135}',
  approved: '\u{f164}',
  failed: CROSS,
  fail: CROSS,
  failing: CROSS,
  error: CROSS,
  rejected: CROSS,
  blocked: '\u{f05e}',
  broken: '\u{f127}',
  unsafe: '\u{f132}',
  down: '\u{f063}',
  'needs you': '\u{f007}',
  decision: '\u{f126}',
  unverified: '\u{f128}',
  'at risk': '\u{f071}',
  'in progress': '\u{f110}',
  pending: CLOCK,
  waiting: CLOCK,
  partial: '\u{f042}',
  skipped: '\u{f04e}',
  inferred: '\u{f0eb}',
  new: '\u{f067}',
  changed: '\u{f040}',
  optional: '\u{f10c}',
  skill: '\u{f02d}',
  'costs money': '\u{f155}',
  destructive: '\u{f1f8}',
  irreversible: '\u{f023}',
  review: '\u{f06e}',
  stale: '\u{f1da}',
  draft: '\u{f044}',
  safe: '\u{f132}',
  brainstorm: '\u{f0eb}',
  investigate: '\u{f002}',
  preview: '\u{f06e}',
  implement: '\u{f0ad}',
  qualify: '\u{f0c3}',
  owned: '\u{f007}',
  shared: '\u{f0c0}',
  foreign: '\u{f023}',
  keep: '\u{f08d}',
  ready: CHECK,
  merged: '\u{f126}',
  healthy: '\u{f004}',
  todo: '\u{f0ae}',
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

export const OWN_ICON = /^\s*([\ue000-\uf8ff]|[\u{f0000}-\u{ffffd}])\s*/u

const KNOWN = [
  ...new Set([
    ...Object.values(TONE_WORDS).flat(),
    ...Object.keys(PILL_ICONS),
    ...Object.keys(SYNONYMS),
  ]),
].sort((a, b) => b.length - a.length)

export function splitLabel(label: string): {
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
