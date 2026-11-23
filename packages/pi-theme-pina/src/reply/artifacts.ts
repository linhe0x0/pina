import {
  BRANCH_PREFIXES,
  BRANCH_PREFIX_SOURCE,
  DOTFILE_NAME_SOURCE,
  FILE_EXTENSIONS,
  FILE_EXTENSION_SOURCE,
  MARKER_WORD_SOURCE,
  BARE_FILENAME_SOURCE,
  UPPER_FILENAME_SOURCE,
} from './inference-lexicon.ts'
import { pill, swatchPill } from './pill-render.ts'
import type { Palette } from './palette.ts'

const PILL_BRACKETS =
  /(\[\[[^[\]\n]{1,32}\]\]|\[(?!\[)[A-Za-z][^[\]\n]{0,31}\](?!\[|\())/
const LINE_COL_SUFFIX = ':\\d{1,5}(?:-\\d{1,5})?(?::\\d{1,5}(?:-\\d{1,5})?)?'

const BARE_FILENAME_CHIP = new RegExp(
  `^(?:(?:${BARE_FILENAME_SOURCE})|(?:${UPPER_FILENAME_SOURCE}))(?:${LINE_COL_SUFFIX})?$`,
)

const ARTIFACT_SOURCES = [
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/
    .source,
  `(?<![\\w./@-])[\\w@.-]+(?:\\/[\\w@.-]+)*\\.(?:${FILE_EXTENSION_SOURCE})(?![\\w])(?:${LINE_COL_SUFFIX})?(?![\\w])`,
  `(?<![\\w./@-])\\.(?:${DOTFILE_NAME_SOURCE})(?:\\.\\w{1,8})*(?![\\w/-])`,
  `(?<![\\w./@-])(?:${BARE_FILENAME_SOURCE})(?:${LINE_COL_SUFFIX})?(?![\\w/-])`,
  `(?<![\\w./@-])(?:${UPPER_FILENAME_SOURCE})(?:${LINE_COL_SUFFIX})?(?![\\w/-])`,
  /(?<![\w#])#\d{1,5}\b/.source,
  /#[0-9a-fA-F]{6}(?![0-9a-fA-F])/.source,
  /(?<![\w.])\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?Z?)?/.source,
  /(?<![\d:.])\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?![\d.])/.source,
  /(?<![\w.])v?\d+\.\d+\.\d+(?:[-+][\w.]+)*(?!\.\d)/.source,
  /(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])/.source,
  /(?<!\w)[+-]?\d+(?:\.\d+)?(?:ms|s|m|h)(?:\d+(?:\.\d+)?(?:ms|s|m|h))*\b/.source,
  /\b\d+(?:\.\d+)?\s?(?:[KMGT]i?B|B)\b/.source,
  /(?<![\w/#-])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w/-])/.source,
  /\b\d+(?:\.\d+)?%/.source,
  /\b[A-Z][A-Z0-9_]+=[\w./:-]+/.source,
  `\\b(?:${MARKER_WORD_SOURCE})\\b`,
  `(?<![\\w./@-])(?:${BRANCH_PREFIX_SOURCE})\\/[a-z\\d_-]+(?:\\.[a-z\\d_-]+)*(?![\\w/-])`,
]

const ARTIFACTS = new RegExp(ARTIFACT_SOURCES.join('|'), 'g')
export const ARTIFACT_EXACT = new RegExp(`^(?:${ARTIFACT_SOURCES.join('|')})$`)

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
  if (BARE_FILENAME_CHIP.test(match)) return INFERENCE_ICONS.file
  if (/^\d{4}-\d{2}-\d{2}/.test(match) || /^\d{2}:\d{2}/.test(match))
    return INFERENCE_ICONS.time
  const prefix = match.includes('/') ? match.split('/')[0].toLowerCase() : ''
  if (BRANCH_PREFIXES.includes(prefix)) return INFERENCE_ICONS.branch
  if (/^[0-9a-f]{7,40}$/.test(match) && /\d/.test(match))
    return INFERENCE_ICONS.commit
  return undefined
}

export function chipToken(
  match: string,
  palette: Palette,
  reopen: () => string,
): string {
  if (/^#[0-9a-fA-F]{6}$/.test(match))
    return swatchPill(match, palette) + reopen()
  const icon = inferenceIcon(match)
  return pill(icon ? `${icon} ${match}` : match, palette, 'neutral') + reopen()
}

export function inferArtifacts(
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
