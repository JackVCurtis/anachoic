import { screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { DONE, RUNNING } from '../../fixtures/task'
import { renderComponent } from '../../testing/render'
import type { TimelineStepData } from '../task_data'
import { ChainTimeline } from './chain_timeline'

/**
 * The chain with its open step kept as the task view keeps it.
 */
function Owner({
  steps,
  currentStepId,
  initialOpen,
  onToggleStep,
}: {
  steps: readonly TimelineStepData[]
  currentStepId: string | null
  initialOpen: string | null
  onToggleStep?: (stepId: string) => void
}) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <ChainTimeline
      steps={steps}
      currentStepId={currentStepId}
      openStepId={open}
      onOpenLink={() => {}}
      onToggleStep={(stepId) => {
        onToggleStep?.(stepId)
        setOpen((current) => (current === stepId ? null : stepId))
      }}
    />
  )
}

function toggleOf(title: string) {
  return screen.getByRole('button', { name: new RegExp(title) })
}

describe('ChainTimeline', () => {
  test('has the Handoff chain heading, its hint, and an ordered list of the steps', () => {
    renderComponent(
      <Owner steps={RUNNING.steps} currentStepId={RUNNING.currentStepId} initialOpen={null} />
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Handoff chain' })).toBeVisible()
    expect(screen.getByText('click a step to expand')).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(4)
    expect(screen.getByRole('list').tagName).toBe('OL')
  })

  test('opening one step closes the other', async () => {
    const { user } = renderComponent(
      <Owner
        steps={RUNNING.steps}
        currentStepId={RUNNING.currentStepId}
        initialOpen={RUNNING.currentStepId}
      />
    )
    const current = toggleOf('Move the consumers')
    const first = toggleOf('Draft the bus adapter')
    expect(current).toHaveAttribute('aria-expanded', 'true')
    expect(first).toHaveAttribute('aria-expanded', 'false')

    await user.click(first)

    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(current).toHaveAttribute('aria-expanded', 'false')
  })

  test('pressing the open step closes it, leaving none open', async () => {
    const { user } = renderComponent(
      <Owner
        steps={RUNNING.steps}
        currentStepId={RUNNING.currentStepId}
        initialOpen={RUNNING.currentStepId}
      />
    )

    await user.click(toggleOf('Move the consumers'))

    for (const toggle of screen.getAllByRole('button', { expanded: false })) {
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.queryByRole('button', { expanded: true })).toBeNull()
  })

  test('raises onToggleStep with the step id', async () => {
    const onToggleStep = vi.fn()
    const { user } = renderComponent(
      <Owner
        steps={DONE.steps}
        currentStepId={null}
        initialOpen={null}
        onToggleStep={onToggleStep}
      />
    )

    await user.click(toggleOf('Fix it'))

    expect(onToggleStep).toHaveBeenCalledWith(DONE.steps[1].id)
  })

  test('the toggle controls its panel, which is its sibling and no region', async () => {
    const { user } = renderComponent(
      <Owner steps={DONE.steps} currentStepId={null} initialOpen={null} />
    )
    const toggle = toggleOf('Find the race')

    await user.click(toggle)

    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(panel).not.toBeNull()
    expect(toggle.closest('h4')!.nextElementSibling).toBe(panel)
    expect(panel.getAttribute('role')).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })
})
