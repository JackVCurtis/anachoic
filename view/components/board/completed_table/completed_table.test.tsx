// Copied from anachoic inertia/components/completed/completed_table/completed_table.test.tsx at fd99e0d
import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { HISTORY } from '../../fixtures/history'
import { history } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import type { CompletedTask } from '../board_data'
import { CompletedTable } from './completed_table'

const [FLAKY, ENV_VARS, RELEASE_NOTES] = HISTORY.onePage.rows

function renderTable(tasks: readonly CompletedTask[]) {
  const onOpenTask = vi.fn()
  const onOpenLink = vi.fn()
  const rendered = renderComponent(
    <CompletedTable tasks={tasks} onOpenTask={onOpenTask} onOpenLink={onOpenLink} />
  )
  return { ...rendered, onOpenTask, onOpenLink }
}

function rowOf(title: string): HTMLTableRowElement {
  return screen.getByRole('button', { name: title }).closest('tr') as HTMLTableRowElement
}

describe('CompletedTable', () => {
  test('pressing the title calls onOpenTask once with its id', async () => {
    const { user, onOpenTask } = renderTable([FLAKY, ENV_VARS])

    await user.click(screen.getByRole('button', { name: ENV_VARS.task.title }))

    expect(onOpenTask).toHaveBeenCalledOnce()
    expect(onOpenTask).toHaveBeenCalledWith(ENV_VARS.task.id)
  })

  test('the title button opens the task from the keyboard; the row is not a stop', async () => {
    const { user, onOpenTask } = renderTable([ENV_VARS])

    await user.tab()
    expect(screen.getByRole('button', { name: ENV_VARS.task.title })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onOpenTask).toHaveBeenCalledWith(ENV_VARS.task.id)
    expect(rowOf(ENV_VARS.task.title)).not.toHaveAttribute('tabindex')
  })

  test('an artifact link asks the host to open it, and does not open the task', async () => {
    const { user, onOpenTask, onOpenLink } = renderTable([FLAKY])

    await user.click(within(rowOf(FLAKY.task.title)).getByRole('link', { name: /Pull request/ }))

    expect(onOpenLink).toHaveBeenCalledWith(FLAKY.artifacts[0].url)
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('draws the six columns of 14, the Task column 40% wide, with no sorting', () => {
    renderTable([FLAKY])

    const headers = screen.getAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual([
      'Task',
      'Steps',
      'Agent / User',
      'Workers',
      'Artifacts',
      'Signed off',
    ])
    expect(headers[0].style.width).toBe('40%')
    for (const header of headers) {
      expect(header).not.toHaveAttribute('aria-sort')
    }
  })

  test('words each cell of a row', () => {
    renderTable([FLAKY])

    const cells = within(rowOf(FLAKY.task.title)).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'T-012Fix the flaky login test',
      '4 steps',
      '14m / 6m',
      'api-serverweb-client',
      'Pull request · step 1 ↗ opens in the browserTicket · step 3 ↗ opens in the browser',
      '12 Mar, 08:05',
    ])
    expect(within(cells[1]).getByRole('img')).toHaveAccessibleName(/^4 steps: 4 done/)
  })

  test('no workers and no artifacts read a dash, heard as "none"; a zero time reads a dash', () => {
    renderTable([RELEASE_NOTES])

    const cells = within(rowOf(RELEASE_NOTES.task.title)).getAllByRole('cell')
    for (const index of [3, 4]) {
      expect(within(cells[index]).getByText(history.noneCell)).toHaveAttribute(
        'aria-hidden',
        'true'
      )
      expect(within(cells[index]).getByText('none')).toBeInTheDocument()
    }
    expect(cells[2]).toHaveTextContent('— / 25m')
  })

  test('a sign-off in an earlier year carries its year', () => {
    renderTable([{ ...ENV_VARS, signedOffAt: '2025-10-02T14:03:00.000Z' }])

    expect(within(rowOf(ENV_VARS.task.title)).getAllByRole('cell')[5]).toHaveTextContent(
      '2 Oct 2025, 14:03'
    )
  })
})
