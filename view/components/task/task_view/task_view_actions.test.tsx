import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { DONE, RUNNING, SIGNED_OFF, TWELVE_STEPS } from '../../fixtures/task'
import { renderComponent } from '../../testing/render'
import type { TaskViewData } from '../task_data'
import { TaskView, type TaskViewProps } from './task_view'

function renderView(props: Partial<TaskViewProps> & { data: TaskViewData }) {
  const onPark = vi.fn()
  const onArchive = vi.fn()
  const all: TaskViewProps = {
    task: props.data.task,
    onOpenLink: () => {},
    onPark,
    onArchive,
    ...props,
  }
  const rendered = renderComponent(<TaskView {...all} />)
  return {
    ...rendered,
    onPark,
    onArchive,
    update: (next: Partial<TaskViewProps>) => rendered.rerender(<TaskView {...all} {...next} />),
  }
}

function button(name: string) {
  return screen.getByRole('button', { name })
}

describe('Park and Archive in the task view', () => {
  test('Park reports only after its confirmation, with the task id', async () => {
    const { user, onPark } = renderView({ data: RUNNING })

    await user.click(button('Park'))
    expect(onPark).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Park “Move billing webhooks to the event bus”? Its claim is cleared and it moves to the backlog.'
      )
    ).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Park' }).at(-1)!)
    expect(onPark).toHaveBeenCalledExactlyOnceWith(RUNNING.task.id)
  })

  test('Archive reports only after its confirmation, with the task id', async () => {
    const { user, onArchive } = renderView({ data: RUNNING })

    await user.click(button('Archive'))
    expect(onArchive).not.toHaveBeenCalled()
    expect(button('Keep task')).toHaveFocus()

    await user.click(screen.getAllByRole('button', { name: 'Archive' }).at(-1)!)
    expect(onArchive).toHaveBeenCalledExactlyOnceWith(RUNNING.task.id)
  })

  test('both buttons are disabled while a confirmation shows, and focus is on its dismiss button', async () => {
    const { user } = renderView({ data: RUNNING })

    await user.click(button('Park'))

    const [park] = screen.getAllByRole('button', { name: 'Park' })
    const [archive] = screen.getAllByRole('button', { name: 'Archive' })
    expect(park).toBeDisabled()
    expect(archive).toBeDisabled()
    expect(button('Keep step')).toHaveFocus()
  })

  test('dismissing returns focus to the opening button', async () => {
    const { user } = renderView({ data: RUNNING })

    await user.click(button('Archive'))
    await user.click(button('Keep task'))

    expect(screen.queryByRole('button', { name: 'Keep task' })).toBeNull()
    expect(button('Archive')).toHaveFocus()
  })

  test('the first Escape closes the confirmation and nothing else', async () => {
    const outside = vi.fn()
    document.addEventListener('keydown', outside)
    const { user } = renderView({ data: RUNNING, onBackToBoard: () => {} })
    await user.click(button('Park'))
    screen.getByRole('heading', { level: 2 }).focus()

    await user.keyboard('{Escape}')

    document.removeEventListener('keydown', outside)
    expect(screen.queryByRole('button', { name: 'Keep step' })).toBeNull()
    expect(outside).not.toHaveBeenCalled()
  })

  test('while in flight the confirm button is busy and the dismiss button disabled', async () => {
    const { user, update } = renderView({ data: RUNNING })
    await user.click(button('Archive'))

    update({ pending: 'archive' })

    const confirm = screen.getAllByRole('button', { name: 'Archive' }).at(-1)!
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(button('Keep task')).toBeDisabled()
  })

  test('a confirmation closes once its action is no longer offered', async () => {
    const { user, update } = renderView({ data: RUNNING })
    await user.click(button('Park'))

    update({ data: { ...RUNNING, list: 'backlog', canAct: { park: false, archive: true } } })

    expect(screen.queryByRole('button', { name: 'Keep step' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Park' })).toBeNull()
  })

  test('the confirmation is hidden when the view shows another task', async () => {
    const { user, update } = renderView({ data: RUNNING })
    await user.click(button('Park'))

    update({ task: TWELVE_STEPS.task, data: TWELVE_STEPS })

    expect(screen.queryByRole('button', { name: 'Keep step' })).toBeNull()
  })

  test('an action that is not offered is not drawn', () => {
    renderView({ data: DONE })

    expect(screen.queryByRole('button', { name: 'Park' })).toBeNull()
    expect(button('Archive')).toBeVisible()
  })

  test('a signed-off task offers neither', () => {
    renderView({ data: SIGNED_OFF })

    expect(screen.queryByRole('button', { name: 'Park' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  })

  test('an archived task offers neither', () => {
    renderView({ data: RUNNING, archived: 'T-031 was archived' })

    expect(screen.queryByRole('button', { name: 'Park' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  })

  test('an error strip shows below the header, and dismissing it from the keyboard focuses the title', async () => {
    const onDismissMessage = vi.fn()
    const { user } = renderView({
      data: RUNNING,
      messages: [{ id: 'm1', kind: 'error', text: 'T-031 is not active' }],
      onDismissMessage,
    })
    const header = document.querySelector('header')!

    expect(screen.getByRole('alert')).toHaveTextContent('T-031 is not active')
    expect(
      header.compareDocumentPosition(screen.getByRole('alert')) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    button('Dismiss').focus()
    await user.keyboard('{Enter}')

    expect(onDismissMessage).toHaveBeenCalledWith('m1')
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus()
  })
})
