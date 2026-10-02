import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { WAIT_TIMINGS, waitTimings } from '../../server/wait_timings.js'

test('the defaults poll every 2 s, send progress every minute and return after 20 minutes', () => {
  expect(waitTimings({})).toEqual({ pollMs: 2_000, progressMs: 60_000, timeoutMs: 1_200_000 })
})

test('environment variables shorten the timings', () => {
  expect(
    waitTimings({
      ANACHOIC_WAIT_POLL_MS: '50',
      ANACHOIC_WAIT_PROGRESS_MS: '100',
      ANACHOIC_WAIT_TIMEOUT_MS: '500',
    })
  ).toEqual({ pollMs: 50, progressMs: 100, timeoutMs: 500 })
})

test.each(['0', '-5', 'soon', '1.5', '99999999'])(
  'a value of %s is ignored, so a wait is never lengthened',
  (value) => {
    expect(waitTimings({ ANACHOIC_WAIT_TIMEOUT_MS: value })).toEqual(WAIT_TIMINGS)
  }
)

test('the extension’s manifest never sets them', () => {
  const manifest = readFileSync(resolve(import.meta.dirname, '../../mcpb/manifest.json'), 'utf8')
  expect(manifest).not.toContain('ANACHOIC_WAIT_')
})
