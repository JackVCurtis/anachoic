import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { before } from '../../fixtures/clock'
import { ASSIGNED, DONE, RUNNING, TWELVE_STEPS } from '../../fixtures/task'
import { renderComponent } from '../../testing/render'
import type { TaskViewData } from '../task_data'
import { TaskView, type TaskViewProps } from './task_view'

/** RUNNING once its step 3 is done and the chain is at step 4, the user's. */
const ADVANCED: TaskViewData = {
  ...RUNNING,
  steps: RUNNING.steps.map((step) => {
    if (step.number === 3) {
      return { ...step, status: 'done', runningSince: null, durationSeconds: 7 * 60 }
    }
    if (step.number === 4) {
      return { ...step, status: 'waiting', waitingSince: before({ minutes: 1 }) }
    }
    return step
  }),
  currentStepId: RUNNING.steps[3].id,
}

function renderView(props: Partial<TaskViewProps> & { data: TaskViewData | null }) {
  const all: TaskViewProps = {
    task: (props.data ?? RUNNING).task,
    onOpenLink: () => {},
    ...props,
  }
  const rendered = renderComponent(<TaskView {...all} />)
  return {
    ...rendered,
    update: (next: Partial<TaskViewProps>) => rendered.rerender(<TaskView {...all} {...next} />),
  }
}

function expanded(): string[] {
  return screen
    .queryAllByRole('button', { expanded: true })
    .map((button) => button.textContent ?? '')
}

describe('TaskView', () => {
  test('opens on the current step', () => {
    renderView({ data: RUNNING })

    expect(expanded()).toHaveLength(1)
    expect(expanded()[0]).toContain('Move the consumers one queue at a time')
  })

  test('a done task opens with no step open', () => {
    renderView({ data: DONE })

    expect(expanded()).toEqual([])
  })

  test('when the props advance the chain the open step follows, until a step is pressed, after which it stays', async () => {
    const { user, update } = renderView({ data: RUNNING })

    update({ data: ADVANCED })
    expect(expanded()[0]).toContain('Watch the error rate for a day')

    await user.click(screen.getByRole('button', { name: /Draft the bus adapter/ }))
    update({ data: RUNNING })
    expect(expanded()).toHaveLength(1)
    expect(expanded()[0]).toContain('Draft the bus adapter')

    update({ data: ADVANCED })
    expect(expanded()[0]).toContain('Draft the bus adapter')
  })

  test('closing the open step leaves none open, even when the chain moves on', async () => {
    const { user, update } = renderView({ data: RUNNING })

    await user.click(screen.getByRole('button', { name: /Move the consumers/ }))
    update({ data: ADVANCED })

    expect(expanded()).toEqual([])
  })

  test('another task opens on its own current step', async () => {
    const { user, update } = renderView({ data: RUNNING })

    await user.click(screen.getByRole('button', { name: /Draft the bus adapter/ }))
    update({ task: TWELVE_STEPS.task, data: TWELVE_STEPS })

    expect(expanded()).toHaveLength(1)
    expect(expanded()[0]).toContain('Carve out service 5')
  })

  test('the header has the badge, the id, the step label, the title as an h2 focusable by script, and the meta line', () => {
    renderView({ data: ASSIGNED })
    const title = screen.getByRole('heading', { level: 2, name: RUNNING.task.title })

    expect(screen.getByText('running')).toBeVisible()
    expect(screen.getByText('T-031')).toBeVisible()
    expect(screen.getByText('Step 3 of 4')).toBeVisible()
    expect(title).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('2 agent steps')).toBeVisible()
    expect(screen.getByText('agent 9m')).toBeVisible()
    expect(screen.getByText('user 14m')).toBeVisible()
    expect(screen.getByText('Assigned to api-server')).toBeVisible()
  })

  test('a done task reads All 3 steps done', () => {
    renderView({ data: DONE })

    expect(screen.getByText('All 3 steps done')).toBeVisible()
  })

  test('offers Open in full screen when the host has it and the view is inline', async () => {
    const onRequestDisplayMode = vi.fn()
    const { user } = renderView({ data: RUNNING, fullscreenAvailable: true, onRequestDisplayMode })

    await user.click(screen.getByRole('button', { name: 'Open in full screen' }))

    expect(onRequestDisplayMode).toHaveBeenCalledWith('fullscreen')
    expect(screen.queryByRole('button', { name: 'Back to inline' })).toBeNull()
  })

  test('offers no full screen when the host does not have it', () => {
    renderView({ data: RUNNING, fullscreenAvailable: false, onRequestDisplayMode: () => {} })

    expect(screen.queryByRole('button', { name: 'Open in full screen' })).toBeNull()
  })

  test('offers Back to inline in full screen', async () => {
    const onRequestDisplayMode = vi.fn()
    const { user } = renderView({
      data: RUNNING,
      displayMode: 'fullscreen',
      fullscreenAvailable: true,
      onRequestDisplayMode,
    })

    await user.click(screen.getByRole('button', { name: 'Back to inline' }))

    expect(onRequestDisplayMode).toHaveBeenCalledWith('inline')
    expect(screen.queryByRole('button', { name: 'Open in full screen' })).toBeNull()
  })

  test('offers Back to board only when given it', async () => {
    const onBackToBoard = vi.fn()
    const { user, update } = renderView({ data: RUNNING })
    expect(screen.queryByRole('button', { name: 'Back to board' })).toBeNull()

    update({ onBackToBoard })
    await user.click(screen.getByRole('button', { name: 'Back to board' }))

    expect(onBackToBoard).toHaveBeenCalledTimes(1)
  })

  test('the way back takes the label it is given, as "Back to history"', async () => {
    const onBackToBoard = vi.fn()
    const { user } = renderView({ data: RUNNING, onBackToBoard, backLabel: 'Back to history' })

    expect(screen.queryByRole('button', { name: 'Back to board' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back to history' }))
    expect(onBackToBoard).toHaveBeenCalledTimes(1)
  })

  test('while loading, the header shows what is known and the body a busy indicator', () => {
    renderView({ task: RUNNING.task, data: null })

    expect(screen.getByRole('heading', { level: 2, name: RUNNING.task.title })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Loading task…')
    expect(screen.queryByText('Handoff chain')).toBeNull()
  })

  test('an archived task shows the sentence in place of the chain', () => {
    renderView({ data: RUNNING, archived: 'T-031 was archived' })

    expect(screen.getByText('T-031 was archived')).toBeVisible()
    expect(screen.queryByText('Handoff chain')).toBeNull()
  })

  test('the padding gives way to larger safe-area insets', () => {
    const { container } = renderView({
      data: RUNNING,
      safeAreaInsets: { top: 40, right: 0, bottom: 0, left: 50 },
    })
    const style = getComputedStyle(container.querySelector('header')!.parentElement!)

    expect(style.paddingTop).toBe('40px')
    expect(style.paddingLeft).toBe('50px')
  })
})
