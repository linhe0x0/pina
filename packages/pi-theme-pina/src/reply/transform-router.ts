import type { MarkdownTransformer } from '@earendil-works/pi-coding-agent'

export function routeTransformers(
  byType: Record<string, MarkdownTransformer>,
): MarkdownTransformer {
  return (markdown, context) => {
    const transform = byType[context.messageType]
    return transform ? transform(markdown, context) : markdown
  }
}
