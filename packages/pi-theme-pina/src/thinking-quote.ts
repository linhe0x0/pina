import type { MarkdownTransformer } from '@earendil-works/pi-coding-agent'

export const thinkingQuote: MarkdownTransformer = (markdown, context) => {
  if (context.messageType !== 'assistant-thinking') return markdown
  return markdown
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n')
}
