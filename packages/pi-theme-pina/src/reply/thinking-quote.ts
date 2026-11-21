import type { MarkdownTransformer } from '@earendil-works/pi-coding-agent'

export const thinkingQuote: MarkdownTransformer = (markdown) =>
  markdown
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n')
