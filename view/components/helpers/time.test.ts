// Copied from anachoic inertia/components/helpers/time.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import {
  formatDuration,
  formatElapsed,
  formatEventTime,
  formatFinished,
  formatSignedOff,
  formatWaited,
} from './time'

/**
 * These tests run in more than one time zone and locale (see
 * vitest.config.ts), so every instant is built from local date parts and the
 * expected wording is the same in each.
 */
function local(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0) {
  return new Date(year, month - 1, day, hours, minutes, seconds).toISOString()
}

/**
 * The instant `seconds` after another.
 */
function after(instant: string, seconds: number) {
  return new Date(Date.parse(instant) + seconds * 1000).toISOString()
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Thursday 12 March 2026, 09:41. */
const NOW = local(2026, 3, 12, 9, 41)

describe('formatDuration', () => {
  test.each<{ seconds: number | null | undefined; expected: string }>([
    { seconds: undefined, expected: '—' },
    { seconds: null, expected: '—' },
    { seconds: 0, expected: '—' },
    { seconds: 1, expected: '1m' },
    { seconds: 59, expected: '1m' },
    { seconds: MINUTE, expected: '1m' },
    { seconds: 9 * MINUTE + 59, expected: '9m' },
    { seconds: 14 * MINUTE, expected: '14m' },
    { seconds: HOUR - 1, expected: '59m' },
    { seconds: HOUR, expected: '1h' },
    { seconds: 2 * HOUR, expected: '2h' },
    { seconds: HOUR + 10 * MINUTE, expected: '1h 10m' },
    { seconds: DAY - 1, expected: '23h 59m' },
    { seconds: DAY, expected: '1d' },
    { seconds: DAY + 2 * HOUR, expected: '1d 2h' },
    { seconds: DAY + 2 * HOUR + 59 * MINUTE, expected: '1d 2h' },
    { seconds: DAY + 59 * MINUTE, expected: '1d' },
    { seconds: 3 * DAY, expected: '3d' },
  ])('$seconds seconds gives "$expected"', ({ seconds, expected }) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})

describe('formatElapsed', () => {
  const started = local(2026, 3, 12, 9, 0)

  test.each([
    { seconds: 0, expected: '0m 00s' },
    { seconds: 4, expected: '0m 04s' },
    { seconds: 9, expected: '0m 09s' },
    { seconds: 10, expected: '0m 10s' },
    { seconds: 6 * MINUTE + 4, expected: '6m 04s' },
    { seconds: 6 * MINUTE + 12, expected: '6m 12s' },
    { seconds: 59 * MINUTE + 59, expected: '59m 59s' },
    { seconds: HOUR, expected: '1h 00m' },
    { seconds: HOUR + 4 * MINUTE + 59, expected: '1h 04m' },
    { seconds: 12 * HOUR + 30 * MINUTE, expected: '12h 30m' },
  ])('$seconds seconds after the start gives "$expected"', ({ seconds, expected }) => {
    expect(formatElapsed(started, after(started, seconds))).toBe(expected)
  })

  test('earlier attempts are added', () => {
    const now = after(started, 6 * MINUTE + 12)
    expect(formatElapsed(started, now, 0)).toBe('6m 12s')
    expect(formatElapsed(started, now, 50)).toBe('7m 02s')
    expect(formatElapsed(started, after(started, 59 * MINUTE), 59)).toBe('59m 59s')
    expect(formatElapsed(started, after(started, 59 * MINUTE), 60)).toBe('1h 00m')
  })

  test('a start after now reads as no time yet', () => {
    expect(formatElapsed(after(started, 5), started)).toBe('0m 00s')
  })
})

describe('formatWaited', () => {
  const since = local(2026, 3, 12, 9, 0)

  test.each([
    { seconds: 0, expected: 'just now' },
    { seconds: 59, expected: 'just now' },
    { seconds: MINUTE, expected: '1m' },
    { seconds: 14 * MINUTE + 59, expected: '14m' },
    { seconds: 59 * MINUTE, expected: '59m' },
    { seconds: HOUR - 1, expected: '59m' },
    { seconds: HOUR, expected: '1h' },
    { seconds: 18 * HOUR + 59 * MINUTE, expected: '18h' },
    { seconds: DAY - 1, expected: '23h' },
    { seconds: DAY, expected: '1d' },
    { seconds: 2 * DAY + 23 * HOUR, expected: '2d' },
  ])('$seconds seconds of waiting gives "$expected"', ({ seconds, expected }) => {
    expect(formatWaited(since, after(since, seconds))).toBe(expected)
  })

  test('a wait that begins after now reads as just now', () => {
    expect(formatWaited(after(since, 90), since)).toBe('just now')
  })
})

describe('formatFinished', () => {
  test.each<{ finished: string | null | undefined; now: string; expected: string }>([
    { finished: undefined, now: NOW, expected: '—' },
    { finished: null, now: NOW, expected: '—' },
    { finished: NOW, now: NOW, expected: 'just now' },
    { finished: after(NOW, -59), now: NOW, expected: 'just now' },
    { finished: after(NOW, -60), now: NOW, expected: 'today 09:40' },
    { finished: local(2026, 3, 12, 9, 14), now: NOW, expected: 'today 09:14' },
    { finished: local(2026, 3, 12, 0, 0), now: NOW, expected: 'today 00:00' },
    { finished: local(2026, 3, 11, 23, 59, 59), now: NOW, expected: 'yesterday' },
    { finished: local(2026, 3, 11, 0, 0), now: NOW, expected: 'yesterday' },
    { finished: local(2026, 3, 10, 23, 59, 59), now: NOW, expected: 'Mar 10' },
    { finished: local(2026, 1, 1, 0, 0), now: NOW, expected: 'Jan 1' },
    { finished: local(2025, 12, 31, 23, 59), now: NOW, expected: 'Dec 31, 2025' },
    { finished: local(2025, 9, 19, 14, 2), now: NOW, expected: 'Sep 19, 2025' },
  ])('$finished at $now gives "$expected"', ({ finished, now, expected }) => {
    expect(formatFinished(finished, now)).toBe(expected)
  })

  describe('around local midnight', () => {
    const justAfter = local(2026, 3, 12, 0, 0, 20)
    const justBefore = local(2026, 3, 11, 23, 59, 30)

    test('a minute before midnight is yesterday once the day has turned', () => {
      expect(formatFinished(local(2026, 3, 11, 23, 58), local(2026, 3, 12, 0, 1))).toBe('yesterday')
    })

    test('a minute after midnight is today', () => {
      expect(formatFinished(local(2026, 3, 12, 0, 1), local(2026, 3, 12, 0, 5))).toBe('today 00:01')
    })

    test('under a minute across midnight is just now', () => {
      expect(formatFinished(justBefore, justAfter)).toBe('just now')
    })

    test('late in the evening, the small hours of that day are still today', () => {
      expect(formatFinished(local(2026, 3, 11, 0, 30), justBefore)).toBe('today 00:30')
    })

    test('late in the evening, the evening before is yesterday', () => {
      expect(formatFinished(local(2026, 3, 10, 23, 30), justBefore)).toBe('yesterday')
    })
  })

  describe('on the first day of a year', () => {
    const newYear = local(2026, 1, 1, 10, 0)

    test.each([
      { finished: local(2026, 1, 1, 0, 5), expected: 'today 00:05' },
      { finished: local(2025, 12, 31, 23, 55), expected: 'yesterday' },
      { finished: local(2025, 12, 30, 12, 0), expected: 'Dec 30, 2025' },
      { finished: local(2025, 1, 1, 12, 0), expected: 'Jan 1, 2025' },
    ])('$finished gives "$expected"', ({ finished, expected }) => {
      expect(formatFinished(finished, newYear)).toBe(expected)
    })

    test('the first day is yesterday on the second', () => {
      expect(formatFinished(local(2026, 1, 1, 12, 0), local(2026, 1, 2, 8, 0))).toBe('yesterday')
    })
  })
})

describe('formatEventTime', () => {
  test.each([
    { at: local(2026, 3, 12, 9, 2, 11), expected: '09:02:11' },
    { at: local(2026, 3, 12, 0, 0, 0), expected: '00:00:00' },
    { at: local(2026, 3, 11, 16, 20, 45), expected: 'Yesterday 16:20' },
    { at: local(2026, 3, 11, 0, 0), expected: 'Yesterday 00:00' },
    { at: local(2026, 3, 10, 23, 59), expected: 'Tue 23:59' },
    { at: local(2026, 3, 9, 14, 2), expected: 'Mon 14:02' },
    { at: local(2026, 3, 6, 11, 30), expected: 'Fri 11:30' },
    { at: local(2026, 3, 5, 23, 59), expected: 'Mar 5 23:59' },
    { at: local(2025, 9, 19, 14, 2), expected: 'Sep 19 14:02' },
  ])('$at gives "$expected"', ({ at, expected }) => {
    expect(formatEventTime(at, NOW)).toBe(expected)
  })

  describe('around local midnight', () => {
    test('a second before midnight is yesterday once the day has turned', () => {
      expect(formatEventTime(local(2026, 3, 11, 23, 59, 59), local(2026, 3, 12, 0, 0, 1))).toBe(
        'Yesterday 23:59'
      )
    })

    test('midnight itself is today', () => {
      expect(formatEventTime(local(2026, 3, 12, 0, 0, 0), local(2026, 3, 12, 0, 0, 1))).toBe(
        '00:00:00'
      )
    })

    test('a second before midnight, the whole day is today', () => {
      expect(formatEventTime(local(2026, 3, 11, 0, 0, 0), local(2026, 3, 11, 23, 59, 59))).toBe(
        '00:00:00'
      )
    })
  })

  describe('on the first day of a year', () => {
    const newYear = local(2026, 1, 1, 10, 0)

    test.each([
      { at: local(2026, 1, 1, 0, 0, 5), expected: '00:00:05' },
      { at: local(2025, 12, 31, 23, 59, 59), expected: 'Yesterday 23:59' },
      { at: local(2025, 12, 30, 8, 15), expected: 'Tue 08:15' },
      { at: local(2025, 12, 26, 8, 15), expected: 'Fri 08:15' },
      { at: local(2025, 12, 25, 8, 15), expected: 'Dec 25 08:15' },
    ])('$at gives "$expected"', ({ at, expected }) => {
      expect(formatEventTime(at, newYear)).toBe(expected)
    })
  })

  test('days are calendar days across a change of daylight saving time', () => {
    expect(formatEventTime(local(2026, 3, 7, 12, 0), local(2026, 3, 9, 12, 0))).toBe('Sat 12:00')
    expect(formatEventTime(local(2026, 3, 28, 12, 0), local(2026, 3, 30, 1, 0))).toBe('Sat 12:00')
    expect(formatEventTime(local(2026, 10, 31, 23, 0), local(2026, 11, 1, 23, 30))).toBe(
      'Yesterday 23:00'
    )
  })
})

describe('the wording does not follow the browser', () => {
  test('month and weekday names are English in every month', () => {
    const now = local(2026, 12, 31, 12, 0)
    const months = Array.from({ length: 12 }, (_, month) =>
      formatFinished(local(2026, month + 1, 1, 12, 0), now)
    )
    expect(months).toEqual([
      'Jan 1',
      'Feb 1',
      'Mar 1',
      'Apr 1',
      'May 1',
      'Jun 1',
      'Jul 1',
      'Aug 1',
      'Sep 1',
      'Oct 1',
      'Nov 1',
      'Dec 1',
    ])
    const weekdays = [8, 7, 6, 5, 4, 3].map((day) =>
      formatEventTime(local(2026, 3, day, 12, 0), local(2026, 3, 9, 12, 0))
    )
    expect(weekdays).toEqual([
      'Yesterday 12:00',
      'Sat 12:00',
      'Fri 12:00',
      'Thu 12:00',
      'Wed 12:00',
      'Tue 12:00',
    ])
    expect(formatEventTime(local(2026, 3, 2, 12, 0), local(2026, 3, 8, 12, 0))).toBe('Mon 12:00')
    expect(formatEventTime(local(2026, 3, 1, 12, 0), local(2026, 3, 7, 12, 0))).toBe('Sun 12:00')
  })

  test('hours use the 24-hour clock with Latin digits', () => {
    expect(formatEventTime(local(2026, 3, 12, 23, 5, 9), local(2026, 3, 12, 23, 30))).toBe(
      '23:05:09'
    )
    expect(formatFinished(local(2026, 3, 12, 13, 7), local(2026, 3, 12, 23, 30))).toBe(
      'today 13:07'
    )
  })
})

describe('in a time zone given', () => {
  /** Thursday 12 March 2026, 09:41 in Kolkata, 04:11 UTC. */
  const KOLKATA_NOW = '2026-03-12T04:11:00.000Z'
  const ZONE = 'Asia/Kolkata'

  test.each([
    { at: '2026-03-12T03:32:11.000Z', expected: '09:02:11' },
    { at: '2026-03-11T18:31:00.000Z', expected: '00:01:00' },
    { at: '2026-03-11T18:29:00.000Z', expected: 'Yesterday 23:59' },
    { at: '2026-03-09T08:32:00.000Z', expected: 'Mon 14:02' },
    { at: '2026-03-04T18:29:00.000Z', expected: 'Mar 4 23:59' },
  ])('formatEventTime of $at gives "$expected" in every browser zone', ({ at, expected }) => {
    expect(formatEventTime(at, KOLKATA_NOW, ZONE)).toBe(expected)
  })

  test.each([
    { finished: '2026-03-11T18:31:00.000Z', expected: 'today 00:01' },
    { finished: '2026-03-11T18:29:00.000Z', expected: 'yesterday' },
    { finished: '2026-03-10T18:29:00.000Z', expected: 'Mar 10' },
    { finished: '2025-12-31T18:30:00.000Z', expected: 'Jan 1' },
    { finished: '2025-12-31T18:29:00.000Z', expected: 'Dec 31, 2025' },
  ])(
    'formatFinished of $finished gives "$expected" in every browser zone',
    ({ finished, expected }) => {
      expect(formatFinished(finished, KOLKATA_NOW, ZONE)).toBe(expected)
    }
  )

  test.each([
    { at: '2026-03-11T18:31:00.000Z', expected: '12 Mar, 00:01' },
    { at: '2026-03-11T18:29:00.000Z', expected: '11 Mar, 23:59' },
    { at: '2025-12-31T18:30:00.000Z', expected: '1 Jan, 00:00' },
    { at: '2025-12-31T18:29:00.000Z', expected: '31 Dec 2025, 23:59' },
  ])('formatSignedOff of $at gives "$expected" in every browser zone', ({ at, expected }) => {
    expect(formatSignedOff(at, KOLKATA_NOW, ZONE)).toBe(expected)
  })

  test('formatSignedOff of nothing gives a dash', () => {
    expect(formatSignedOff(null, KOLKATA_NOW, ZONE)).toBe('—')
    expect(formatSignedOff('not a time', KOLKATA_NOW, ZONE)).toBe('—')
  })

  test('without a zone the browser’s zone is used', () => {
    const at = local(2026, 3, 12, 0, 1)
    expect(formatEventTime(at, NOW)).toBe('00:01:00')
    expect(formatFinished(at, NOW)).toBe('today 00:01')
    expect(formatSignedOff(at, NOW)).toBe('12 Mar, 00:01')
  })
})
