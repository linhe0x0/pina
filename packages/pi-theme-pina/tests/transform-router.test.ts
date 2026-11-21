import test from 'node:test'
import assert from 'node:assert/strict'
import type {
  MarkdownTransformContext,
  MarkdownTransformer,
} from '@earendil-works/pi-coding-agent'
import { routeTransformers } from '../src/reply/transform-router.ts'

const contextOf = (messageType: string) =>
  ({ messageType }) as unknown as MarkdownTransformContext

const marked =
  (tag: string): MarkdownTransformer =>
  (markdown) =>
    `<${tag}>${markdown}</>`

test('routes each message type to its transformer', () => {
  const transform = routeTransformers({
    assistant: marked('reply'),
    'assistant-thinking': marked('thinking'),
  })
  assert.equal(transform('**x**', contextOf('assistant')), '<reply>**x**</>')
  assert.equal(
    transform('> x', contextOf('assistant-thinking')),
    '<thinking>> x</>',
  )
})

test('unknown message types pass the markdown through untouched', () => {
  const transform = routeTransformers({ assistant: marked('reply') })
  assert.equal(transform('**x**', contextOf('user')), '**x**')
  assert.equal(transform('**x**', contextOf('assistant-later')), '**x**')
})
