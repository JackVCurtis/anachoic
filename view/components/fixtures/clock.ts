// Copied from anachoic inertia/components/fixtures/clock.ts at fd99e0d
/**
 * The present moment of every story and component test: Thursday
 * 12 March 2026, 09:41 in the time zone the tests run in. A weekday morning,
 * so fixtures can fall today, yesterday, earlier this week and last week.
 */
export const FIXED_NOW = '2026-03-12T09:41:00.000Z'

/**
 * Instants around FIXED_NOW, one for each kind of time label.
 */
export const INSTANTS = {
  /** 14 minutes 3 seconds before FIXED_NOW. */
  stepStarted: '2026-03-12T09:26:57.000Z',
  earlierToday: '2026-03-12T08:05:00.000Z',
  yesterday: '2026-03-11T16:20:00.000Z',
  /** The Monday of the same week. */
  earlierThisWeek: '2026-03-09T14:02:00.000Z',
  /** The Friday of the week before. */
  lastWeek: '2026-03-06T11:30:00.000Z',
} as const

/**
 * The time zone the component tests run in, so that local clock times and
 * calendar days are the same on every machine.
 */
export const TEST_TIME_ZONE = 'UTC'

export interface Offset {
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
}

/**
 * The instant the given time before FIXED_NOW, so a fixture's time labels
 * read the same in every story and test.
 */
export function before({ days = 0, hours = 0, minutes = 0, seconds = 0 }: Offset): string {
  const totalSeconds = ((days * 24 + hours) * 60 + minutes) * 60 + seconds
  return new Date(Date.parse(FIXED_NOW) - totalSeconds * 1000).toISOString()
}
