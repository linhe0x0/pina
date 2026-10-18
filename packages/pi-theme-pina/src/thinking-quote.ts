/**
 * Render the expanded thinking block as a blockquote.
 *
 * Pi exposes no theme token or hook for a thinking-block background: the
 * transcript renderer builds the thinking Markdown with a text color only.
 * Prefixing every line with "> " routes the block through pi's blockquote
 * renderer instead, which draws a left rule in `mdQuoteBorder` and colors
 * text with `mdQuote` — and re-applies the quote style after every nested
 * ANSI reset, so the region stays intact across bold, code, and headings
 * inside thinking. Display-only: session data and model context keep the
 * raw text.
 */
import type { MarkdownTransformer } from '@earendil-works/pi-coding-agent'

export const thinkingQuote: MarkdownTransformer = (markdown, context) => {
  if (context.messageType !== 'assistant-thinking') return markdown
  return markdown
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n')
}
