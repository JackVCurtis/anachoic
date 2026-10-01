// Copied from anachoic inertia/components/foundations/clock.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { INSTANTS, TEST_TIME_ZONE } from '../fixtures/clock'
import { useNow } from '../hooks/use_now/use_now'

const DAY_MS = 24 * 60 * 60 * 1000

const TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: TEST_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { timeZone: TEST_TIME_ZONE, weekday: 'short' })
const DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: TEST_TIME_ZONE,
  day: 'numeric',
  month: 'short',
})
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: TEST_TIME_ZONE, dateStyle: 'short' })

/**
 * The calendar day of an instant in the fixtures' time zone, counted in days
 * since 1 January 1970, which was a Thursday.
 */
function dayNumber(iso: string) {
  return Date.parse(DAY.format(new Date(iso))) / DAY_MS
}

function daysSinceMonday(day: number) {
  return (day + 3) % 7
}

/**
 * Stands in for the time helpers, which are not written yet. It formats in
 * the fixtures' time zone so the story reads the same on every machine.
 */
function eventTime(iso: string, now: string) {
  const date = new Date(iso)
  const today = dayNumber(now)
  const days = today - dayNumber(iso)
  const time = TIME.format(date)
  if (days === 0) return time
  if (days === 1) return `Yesterday ${time}`
  if (days <= daysSinceMonday(today)) return `${WEEKDAY.format(date)} ${time}`
  return `${DATE.format(date)} ${time}`
}

function elapsed(from: string, now: string) {
  const seconds = Math.floor((Date.parse(now) - Date.parse(from)) / 1000)
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

function TimeLabels() {
  const now = useNow('second')
  const rows = [
    ['Now', eventTime(now, now)],
    ['Step running for', elapsed(INSTANTS.stepStarted, now)],
    ['Earlier today', eventTime(INSTANTS.earlierToday, now)],
    ['Yesterday', eventTime(INSTANTS.yesterday, now)],
    ['Earlier this week', eventTime(INSTANTS.earlierThisWeek, now)],
    ['Last week', eventTime(INSTANTS.lastWeek, now)],
  ]
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'max-content max-content',
        gap: 'var(--space-2) var(--space-6)',
      }}
    >
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'contents' }}>
          <dt className="text-body-sm">{label}</dt>
          <dd className="text-status text-tabular" style={{ color: 'inherit' }}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const EXPECTED = ['09:41', '14m 03s', '08:05', 'Yesterday 16:20', 'Mon 14:02', '6 Mar 11:30']

const meta = {
  title: 'Foundations/Clock',
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const FixedMorning: Story = {
  name: 'Thursday morning, fixed',
  render: () => <TimeLabels />,
  play: async ({ canvasElement }) => {
    const read = () =>
      within(canvasElement)
        .getAllByRole('definition')
        .map((cell) => cell.textContent)

    expect(read()).toEqual(EXPECTED)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(read()).toEqual(EXPECTED)
  },
}
