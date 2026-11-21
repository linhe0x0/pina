import test from 'node:test'
import assert from 'node:assert/strict'
import { toneOf } from '../src/reply/pill-tone.ts'

test('pill words map to tones', () => {
  assert.equal(toneOf('Failed'), 'error')
  assert.equal(toneOf('Blocked'), 'error')
  assert.equal(toneOf('Needs you'), 'warning')
  assert.equal(toneOf('Decision'), 'warning')
  assert.equal(toneOf('Done'), 'success')
  assert.equal(toneOf('Observed'), 'success')
  assert.equal(toneOf('Costs money'), 'critical')
  assert.equal(toneOf('Irreversible'), 'critical')
  assert.equal(toneOf('Implement'), 'mode')
  assert.equal(toneOf('Shared'), 'owner')
  assert.equal(toneOf('Inferred'), 'neutral')
  assert.equal(toneOf('Anything else'), 'neutral')
})

test('tone ignores case and spacing', () =>
  assert.equal(toneOf('  needs   YOU '), 'warning'))

test('a known word may carry detail', () => {
  assert.equal(toneOf('Passed 12/12'), 'success')
  assert.equal(toneOf('Failed: 3 tests'), 'error')
})

test('a longer word that starts like a known one is not that word', () =>
  assert.equal(toneOf('Donezo'), 'neutral'))
