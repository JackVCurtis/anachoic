// Copied from anachoic inertia/components/fixtures/clock.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { before, FIXED_NOW, INSTANTS, TEST_TIME_ZONE } from './clock'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The local calendar day of an instant, counted in whole days since the
 * epoch, so that two days can be subtracted.
 */
function localDay(iso: string) {
  const date = new Date(iso)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

/**
 * Days since the Monday that starts the local week.
 */
function weekday(iso: string) {
  return (new Date(iso).getDay() + 6) % 7
}

describe('the fixed clock', () => {
  test('the tests run in the fixtures’ time zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(TEST_TIME_ZONE)
  })

  test('FIXED_NOW is a weekday morning after Monday', () => {
    const now = new Date(FIXED_NOW)

    expect(weekday(FIXED_NOW)).toBeGreaterThanOrEqual(2)
    expect(weekday(FIXED_NOW)).toBeLessThanOrEqual(4)
    expect(now.getHours()).toBeGreaterThanOrEqual(6)
    expect(now.getHours()).toBeLessThan(12)
  })

  test('each instant falls on the day its name says', () => {
    const today = localDay(FIXED_NOW)

    expect(localDay(INSTANTS.stepStarted)).toBe(today)
    expect(localDay(INSTANTS.earlierToday)).toBe(today)
    expect(localDay(INSTANTS.yesterday)).toBe(today - 1)
    expect(localDay(INSTANTS.earlierThisWeek)).toBeLessThan(today - 1)
    expect(today - localDay(INSTANTS.earlierThisWeek)).toBeLessThanOrEqual(weekday(FIXED_NOW))
    expect(today - localDay(INSTANTS.lastWeek)).toBeGreaterThan(weekday(FIXED_NOW))
  })

  test('every instant is before FIXED_NOW, and the step started 14m 03s before it', () => {
    for (const instant of Object.values(INSTANTS)) {
      expect(Date.parse(instant)).toBeLessThan(Date.parse(FIXED_NOW))
    }
    expect(Date.parse(FIXED_NOW) - Date.parse(INSTANTS.stepStarted)).toBe((14 * 60 + 3) * 1000)
  })

  test('before counts back from FIXED_NOW', () => {
    expect(before({})).toBe(FIXED_NOW)
    expect(before({ minutes: 14, seconds: 3 })).toBe(INSTANTS.stepStarted)
    expect(before({ days: 1, hours: 1 })).toBe('2026-03-11T08:41:00.000Z')
  })
})
