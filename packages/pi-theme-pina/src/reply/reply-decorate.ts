import { ARTIFACT_EXACT, chipToken, inferArtifacts } from './artifacts.ts'
import { splitLabel } from './pill-tone.ts'
import {
  ACTION_ICONS,
  ACTION_LABEL,
  pill,
  withLabelIcon,
} from './pill-render.ts'
import type { Palette } from './palette.ts'

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
          (_, hashes: string, title: string) =>
            hashes + (palette.pillIcons ? withLabelIcon(title) : title),
        ),
      )
    } else {
      out.push(decorateLine(line, palette, open, close))
    }
  }
  return out.join('\n')
}

const LEAD_LABEL =
  /^(\s*(?:[-*+]|\d+\.)?\s*(?:[├└]──\s*)?\*\*)([^*`\n]{1,32})(\*\*)/

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
        before + (palette.pillIcons ? withLabelIcon(label) : label) + after,
    ),
  )
  let result = ''
  let inBold: string | undefined
  const reopen = () => (inBold ? `\x1b[1m${open}` : '')
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (i % 2 === 1) {
      if (palette.artifacts) {
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
    if (palette.artifacts) prose = inferArtifacts(prose, palette, reopen)
    if (palette.pillIcons)
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
