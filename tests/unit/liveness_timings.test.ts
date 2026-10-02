import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { LIVENESS_TIMINGS, livenessTimings } from '../../server/liveness_timings.js'

test('the defaults beat every 30 s and end a session unseen for 2 minutes', () => {
  expect(livenessTimings({})).toEqual({ heartbeatMs: 30_000, deadWindowMs: 120_000 })
})

test('environment variables shorten the timings', () => {
  expect(
    livenessTimings({ ANACHOIC_HEARTBEAT_MS: '100', ANACHOIC_DEAD_WINDOW_MS: '1000' })
  ).toEqual({ heartbeatMs: 100, deadWindowMs: 1000 })
})

test.each(['0', '-5', 'soon', '1.5', '99999999'])(
  'a value of %s is ignored, so the window is never lengthened',
  (value) => {
    expect(livenessTimings({ ANACHOIC_DEAD_WINDOW_MS: value })).toEqual(LIVENESS_TIMINGS)
  }
)

test('neither the extension’s manifest nor the worker plugin sets them', () => {
  for (const file of ['../../mcpb/manifest.json', '../../scripts/plugin.mjs']) {
    const text = readFileSync(resolve(import.meta.dirname, file), 'utf8')
    expect(text).not.toMatch(/ANACHOIC_(HEARTBEAT|DEAD_WINDOW)_MS/)
  }
})
