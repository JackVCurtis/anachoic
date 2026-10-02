// Copied from anachoic inertia/components/helpers/time.ts at fd99e0d
import { fillTemplate, times } from './strings'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Whole seconds from one instant to another. Negative when `to` is earlier.
 */
function secondsBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 1000)
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The calendar and clock parts of an instant in a time zone.
 */
type LocalParts = {
  year: number
  /** 0 for January, as `Date.prototype.getMonth`. */
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
}

const PART_FORMATS = new Map<string | undefined, Intl.DateTimeFormat>()

/**
 * A formatter that writes every part of an instant as Latin digits on the
 * 24-hour clock, in the zone given or the browser's. Formatters are kept,
 * because building one is slow.
 */
function partFormat(timeZone: string | undefined): Intl.DateTimeFormat {
  let format = PART_FORMATS.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US-u-nu-latn', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    PART_FORMATS.set(timeZone, format)
  }
  return format
}

/**
 * The calendar day and clock time of an instant in `timeZone`, or in the
 * browser's zone when it is absent.
 */
function localParts(date: Date, timeZone: string | undefined): LocalParts {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}
  for (const part of partFormat(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value)
    }
  }
  return {
    year: parts.year!,
    month: parts.month! - 1,
    day: parts.day!,
    hours: parts.hour!,
    minutes: parts.minute!,
    seconds: parts.second!,
  }
}

/**
 * The calendar day of some local parts, counted in whole days since the
 * epoch, so a day with a daylight saving change still counts as one.
 */
function dayNumber(local: LocalParts): number {
  return Date.UTC(local.year, local.month, local.day) / (DAY * 1000)
}

/**
 * The day of the week of some local parts, 0 for Sunday, as
 * `Date.prototype.getDay`. The epoch fell on a Thursday.
 */
function weekday(local: LocalParts): number {
  return (dayNumber(local) + 4) % 7
}

/**
 * "14:02", on the 24-hour clock.
 */
function clockTime(local: LocalParts): string {
  return `${twoDigits(local.hours)}:${twoDigits(local.minutes)}`
}

/**
 * The time a finished step took, or a total: "14m", "2h", "1h 10m", "1d 2h",
 * "1d". Zero or missing gives "—". Minutes are rounded down, but anything
 * above zero is at least "1m". A part that is zero is dropped.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !(seconds > 0)) {
    return times.none
  }
  const totalMinutes = Math.max(1, Math.floor(seconds / MINUTE))
  const days = Math.floor(totalMinutes / (DAY / MINUTE))
  const hours = Math.floor((totalMinutes % (DAY / MINUTE)) / (HOUR / MINUTE))
  const minutes = totalMinutes % (HOUR / MINUTE)

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}

/**
 * The running time of a step that started at `startedAt`, plus the seconds
 * spent on its earlier attempts: "6m 12s", "0m 04s", and from one hour
 * "1h 04m". Seconds and, from one hour, minutes are always two digits.
 */
export function formatElapsed(startedAt: string, now: string, earlierSeconds = 0): string {
  const total = Math.max(0, secondsBetween(startedAt, now) + Math.floor(earlierSeconds))
  const hours = Math.floor(total / HOUR)
  const minutes = Math.floor((total % HOUR) / MINUTE)
  const seconds = total % MINUTE

  if (hours > 0) {
    return `${hours}h ${twoDigits(minutes)}m`
  }
  return `${minutes}m ${twoDigits(seconds)}s`
}

/**
 * How long a step has waited since `waitingSince`, the instant it last began
 * to wait, in one unit rounded down: "just now", "14m", "18h", "2d".
 */
export function formatWaited(waitingSince: string, now: string): string {
  const waited = secondsBetween(waitingSince, now)

  if (waited < MINUTE) {
    return times.justNow
  }
  if (waited < HOUR) {
    return `${Math.floor(waited / MINUTE)}m`
  }
  if (waited < DAY) {
    return `${Math.floor(waited / HOUR)}h`
  }
  return `${Math.floor(waited / DAY)}d`
}

/**
 * When a task finished, as a day phrase: "just now", "today 09:14",
 * "yesterday", "Sep 19", or "Sep 19, 2025" in an earlier year. Missing gives
 * "—". Today and yesterday are calendar days in `timeZone`, or in the
 * browser's zone when it is absent.
 */
export function formatFinished(
  finishedAt: string | null | undefined,
  now: string,
  timeZone?: string
): string {
  if (finishedAt === null || finishedAt === undefined || Number.isNaN(Date.parse(finishedAt))) {
    return times.none
  }
  if (Math.abs(secondsBetween(finishedAt, now)) < MINUTE) {
    return times.justNow
  }

  const finished = localParts(new Date(finishedAt), timeZone)
  const today = localParts(new Date(now), timeZone)
  const days = dayNumber(today) - dayNumber(finished)

  if (days === 0) {
    return fillTemplate(times.finishedToday, { time: clockTime(finished) })
  }
  if (days === 1) {
    return times.finishedYesterday
  }

  const month = times.months[finished.month]
  const day = finished.day
  if (finished.year === today.year) {
    return fillTemplate(times.finishedThisYear, { month, day })
  }
  return fillTemplate(times.finishedEarlierYear, { month, day, year: finished.year })
}

/**
 * When an event happened: "09:02:11" today, "Yesterday 16:20", "Mon 14:02"
 * two to six days ago, and "Sep 19 14:02" before that. Days and times are in
 * `timeZone`, or in the browser's zone when it is absent.
 */
export function formatEventTime(at: string, now: string, timeZone?: string): string {
  const event = localParts(new Date(at), timeZone)
  const days = dayNumber(localParts(new Date(now), timeZone)) - dayNumber(event)
  const time = clockTime(event)

  if (days === 0) {
    return `${time}:${twoDigits(event.seconds)}`
  }
  if (days === 1) {
    return fillTemplate(times.eventYesterday, { time })
  }
  if (days >= 2 && days <= 6) {
    return fillTemplate(times.eventThisWeek, { weekday: times.weekdays[weekday(event)], time })
  }
  return fillTemplate(times.eventEarlier, {
    month: times.months[event.month],
    day: event.day,
    time,
  })
}

/**
 * When a task was signed off, as a date and a clock time: "2 Oct, 14:03",
 * or "2 Oct 2025, 14:03" in an earlier year than `now`. Missing gives "—".
 * The day and time are in `timeZone`, or in the browser's zone when it is
 * absent.
 */
export function formatSignedOff(
  signedOffAt: string | null | undefined,
  now: string,
  timeZone?: string
): string {
  if (signedOffAt === null || signedOffAt === undefined || Number.isNaN(Date.parse(signedOffAt))) {
    return times.none
  }
  const signed = localParts(new Date(signedOffAt), timeZone)
  const values = { day: signed.day, month: times.months[signed.month], time: clockTime(signed) }
  if (signed.year === localParts(new Date(now), timeZone).year) {
    return fillTemplate(times.signedOffThisYear, values)
  }
  return fillTemplate(times.signedOffEarlierYear, { ...values, year: signed.year })
}
