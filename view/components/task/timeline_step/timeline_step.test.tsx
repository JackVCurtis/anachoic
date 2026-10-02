import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { FIXED_NOW } from '../../fixtures/clock'
import { ASKING, BLOCKED, LONG_TITLE, REVIEW, RUNNING, TEN_LINKS } from '../../fixtures/task'
import { renderComponent } from '../../testing/render'
import type { TimelineStepData } from '../task_data'
import { TimelineStep } from './timeline_step'
import { fullText } from '../../testing/text'

function renderStep(
  step: TimelineStepData,
  { isCurrent = false, open = true }: { isCurrent?: boolean; open?: boolean } = {}
) {
  const onToggle = vi.fn()
  const onOpenLink = vi.fn()
  const rendered = renderComponent(
    <ol>
      <TimelineStep
        step={step}
        isCurrent={isCurrent}
        open={open}
        onToggle={onToggle}
        onOpenLink={onOpenLink}
      />
    </ol>
  )
  return { ...rendered, onToggle, onOpenLink }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('TimelineStep', () => {
  test("a running step's label ticks when the clock advances by one second", () => {
    vi.useFakeTimers({
      now: Date.parse(FIXED_NOW),
      toFake: ['setInterval', 'clearInterval', 'Date'],
    })
    render(
      <ol>
        <TimelineStep
          step={RUNNING.steps[2]}
          isCurrent
          open={false}
          onToggle={() => {}}
          onOpenLink={() => {}}
        />
      </ol>
    )
    expect(screen.getByText(fullText('Running · 6m 12s'))).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText(fullText('Running · 6m 13s'))).toBeDefined()
  })

  test('a waiting step reads Waiting on user with its waited time', () => {
    renderStep(ASKING.steps[0], { isCurrent: true, open: false })

    expect(screen.getByText(fullText('Waiting on user · 14m'))).toBeVisible()
  })

  test('the header has the two-digit number, the claiming session and the title', () => {
    renderStep(RUNNING.steps[2], { isCurrent: true, open: false })
    const toggle = screen.getByRole('button')

    expect(within(toggle).getByText('03')).toBeVisible()
    expect(within(toggle).getByText('api-server')).toBeVisible()
    expect(within(toggle).getByText('Move the consumers one queue at a time')).toBeVisible()
    expect(toggle.parentElement!.tagName).toBe('H4')
  })

  test('a user step reads user in its chip', () => {
    renderStep(REVIEW.steps[1], { isCurrent: true, open: false })

    expect(within(screen.getByRole('button')).getByText('user')).toBeVisible()
  })

  test('a current waiting step is inverted', () => {
    renderStep(ASKING.steps[0], { isCurrent: true })

    expect(screen.getByRole('listitem').querySelector('[data-tone="inverse"]')).not.toBeNull()
  })

  test('the panel shows the claiming session, the question and the answer', () => {
    renderStep(ASKING.steps[0], { isCurrent: true })

    expect(screen.getByText('Claimed by')).toBeVisible()
    expect(screen.getByText('web-client', { selector: 'dd' })).toBeVisible()
    expect(screen.getByText('Asks')).toBeVisible()
    expect(screen.getByText(ASKING.steps[0].question!)).toBeVisible()
    expect(screen.getByText('Answer')).toBeVisible()
    expect(screen.getByText(ASKING.steps[0].answer!)).toBeVisible()
  })

  test('a pending agent step no session claimed reads Unclaimed', () => {
    renderStep(LONG_TITLE.steps[0], { isCurrent: true })

    expect(screen.getByText('Unclaimed')).toBeVisible()
  })

  test('a blocked step reads Blocked with its time, its reason, and where to unblock it, and offers no action', () => {
    renderStep(BLOCKED.steps[1], { isCurrent: true })

    expect(screen.getByText(fullText('Blocked · 14m'))).toBeVisible()
    expect(screen.getByText(BLOCKED.steps[1].blocked!.reason)).toBeVisible()
    expect(screen.getByText('Unblock it in api-server’s session')).toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  test('a running step with an output format says what it produces', () => {
    renderStep(RUNNING.steps[2], { isCurrent: true })

    expect(screen.getByText('Produces a ticket')).toBeVisible()
    expect(screen.getByText('Moved invoices and refunds; payouts next.')).toBeVisible()
  })

  test('a done step links to its artifact and its links', () => {
    renderStep(RUNNING.steps[0])

    expect(screen.getByRole('link', { name: /Pull request step 1/ })).toBeVisible()
    expect(screen.getByRole('link', { name: /CI run/ })).toBeVisible()
    expect(screen.getByText(RUNNING.steps[0].summary!)).toBeVisible()
    expect(screen.getByText(RUNNING.steps[0].detail!)).toBeVisible()
  })

  test('a user step links to its input', () => {
    renderStep(REVIEW.steps[1], { isCurrent: true })

    expect(screen.getByRole('link', { name: /Pull request from step 1/ })).toBeVisible()
  })

  test('pressing a link raises onOpenLink with its url and does not navigate', async () => {
    const { user, onOpenLink } = renderStep(RUNNING.steps[0])
    const before = window.location.href
    const link = screen.getByRole('link', { name: /CI run/ })

    await user.click(link)

    expect(onOpenLink).toHaveBeenCalledWith('https://ci.acme.dev/runs/9921')
    expect(window.location.href).toBe(before)
    expect(link).toHaveAttribute('title', 'https://ci.acme.dev/runs/9921')
  })

  test('the arrow is hidden from the accessibility tree, and the link says it opens in a new tab', () => {
    renderStep(RUNNING.steps[0])
    const link = screen.getByRole('link', { name: /CI run/ })

    expect(link).toHaveAccessibleName('CI run opens in a new tab')
    expect(within(link).getByText('↗', { exact: false })).toHaveAttribute('aria-hidden', 'true')
  })

  test("a click in a step's panel does not toggle the step", async () => {
    const { user, onToggle } = renderStep(ASKING.steps[0], { isCurrent: true })

    await user.click(screen.getByText(ASKING.steps[0].answer!))
    await user.click(screen.getByText('Claimed by'))

    expect(onToggle).not.toHaveBeenCalled()
  })

  test('pressing the header raises onToggle', async () => {
    const { user, onToggle } = renderStep(RUNNING.steps[0], { open: false })

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test('ten links are each listed', () => {
    renderStep(TEN_LINKS.steps[0])

    expect(screen.getAllByRole('link')).toHaveLength(11)
  })
})
