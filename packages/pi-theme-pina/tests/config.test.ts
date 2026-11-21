import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, pinaConfigFromEnv } from '../src/config.ts'
import { withEnv } from './helpers.ts'

test('defaults carry the textAnchor violet and every knob on', () => {
  assert.deepEqual(DEFAULT_CONFIG, {
    boldColor: '#b8a1ff',
    roundCaps: true,
    pillIcons: true,
    artifacts: true,
  })
})

test('pinaConfigFromEnv reads the four PINA knobs', () => {
  withEnv('PINA_BOLD_COLOR', undefined, () => {
    withEnv('PINA_ROUND_CAPS', undefined, () => {
      withEnv('PINA_PILL_ICONS', undefined, () => {
        withEnv('PINA_ARTIFACTS', undefined, () => {
          assert.deepEqual(pinaConfigFromEnv(), DEFAULT_CONFIG)
        })
      })
    })
  })
  withEnv('PINA_BOLD_COLOR', 'mdLink', () => {
    withEnv('PINA_ROUND_CAPS', '0', () => {
      withEnv('PINA_PILL_ICONS', '0', () => {
        withEnv('PINA_ARTIFACTS', '0', () => {
          assert.deepEqual(pinaConfigFromEnv(), {
            boldColor: 'mdLink',
            roundCaps: false,
            pillIcons: false,
            artifacts: false,
          })
        })
      })
    })
  })
})
