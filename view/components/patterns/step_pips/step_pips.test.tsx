// Copied from anachoic inertia/components/patterns/step_pips/step_pips.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { EACH_APPEARANCE, QUEUED_CHAIN } from '../../fixtures/pip_steps'
import { renderComponent } from '../../testing/render'
import { StepPips, type StepPip } from './step_pips'

/**
 * Two steps done, your third waiting, two not started.
 */
const FIVE_STEPS: StepPip[] = [
  {
    id: 's1',
    owner: 'agent',
    status: 'done',
    title: 'Draft the migration',
    sessionName: 'api-server',
  },
  { id: 's2', owner: 'agent', status: 'done', title: 'Write the tests', sessionName: 'api-server' },
  { id: 's3', owner: 'you', status: 'waiting', title: 'Review the migration', sessionName: null },
  { id: 's4', owner: 'agent', status: 'pending', title: 'Open the PR', sessionName: null },
  { id: 's5', owner: 'you', status: 'pending', title: 'Merge', sessionName: null },
]

function barsOf(image: HTMLElement): HTMLElement[] {
  return [...image.children] as HTMLElement[]
}

describe('StepPips', () => {
  test('the row is one image named by the summary, with zero counts left out', () => {
    renderComponent(<StepPips steps={FIVE_STEPS} />)

    const image = screen.getByRole('img')
    expect(image).toHaveAccessibleName('5 steps: 2 done, 1 waiting on you, 2 not started')
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  test('the bars are hidden from assistive technology', () => {
    renderComponent(<StepPips steps={FIVE_STEPS} />)

    const bars = barsOf(screen.getByRole('img'))
    expect(bars).toHaveLength(5)
    for (const bar of bars) {
      expect(bar).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('each bar carries the owner label, a middle dot and the step title as its tooltip', () => {
    renderComponent(<StepPips steps={FIVE_STEPS} />)

    expect(barsOf(screen.getByRole('img')).map((bar) => bar.title)).toEqual([
      'api-server · Draft the migration',
      'api-server · Write the tests',
      'you · Review the migration',
      'agent · Open the PR',
      'you · Merge',
    ])
  })

  test('the look follows status, not position: a queued chain has no running or waiting bar', () => {
    renderComponent(<StepPips steps={QUEUED_CHAIN} />)

    const image = screen.getByRole('img')
    expect(barsOf(image).map((bar) => bar.dataset.appearance)).toEqual([
      'done',
      'done',
      'pending',
      'pending',
    ])
    expect(image).toHaveAccessibleName('4 steps: 2 done, 2 not started')
  })

  test("an agent's waiting step and your running step both look waiting", () => {
    renderComponent(
      <StepPips
        steps={[
          {
            id: 'a',
            owner: 'agent',
            status: 'waiting',
            title: 'Ask which cache to use',
            sessionName: 'api-server',
          },
          { id: 'h', owner: 'you', status: 'running', title: 'Review', sessionName: null },
          { id: 'r', owner: 'agent', status: 'running', title: 'Build', sessionName: 'web-client' },
        ]}
      />
    )

    expect(barsOf(screen.getByRole('img')).map((bar) => bar.dataset.appearance)).toEqual([
      'waiting',
      'waiting',
      'running',
    ])
  })

  test.each(['light', 'inverse'] as const)(
    'on the %s tone every bar is 5px high with a 1px border and square corners',
    (tone) => {
      renderComponent(<StepPips steps={EACH_APPEARANCE} />, { tone })

      for (const bar of barsOf(screen.getByRole('img'))) {
        const style = getComputedStyle(bar)
        expect(style.height).toBe('5px')
        expect(style.borderTopWidth).toBe('1px')
        expect(style.borderTopStyle).toBe('solid')
        expect(style.borderRadius).toBe('0px')
      }
    }
  )

  test('tight spacing is 2px by default and loose spacing is 4px', () => {
    const { rerender } = renderComponent(<StepPips steps={FIVE_STEPS} />)
    expect(getComputedStyle(screen.getByRole('img')).columnGap).toBe('2px')

    rerender(<StepPips steps={FIVE_STEPS} spacing="loose" />)
    expect(getComputedStyle(screen.getByRole('img')).columnGap).toBe('4px')
  })
})
