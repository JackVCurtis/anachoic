import { useState } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { TASK_ENTRY_DRAFTS, TASK_ENTRY_WORKERS } from '../../fixtures/task_entry'
import { taskEntry } from '../../helpers/strings'
import type { TaskEntryDraft, TaskEntryWorker } from '../../helpers/task_entry'
import { renderComponent } from '../../testing/render'
import { TaskEntry, type TaskEntryDestination } from './task_entry'

/**
 * Task entry with its draft and its open state held as the board entry holds
 * them.
 */
function Harness({
  initial,
  startOpen,
  workers,
  onSubmit,
  onDraftChange,
}: {
  initial: TaskEntryDraft
  startOpen: boolean
  workers?: readonly TaskEntryWorker[]
  onSubmit: (destination: TaskEntryDestination) => void
  onDraftChange?: (draft: TaskEntryDraft) => void
}) {
  const [open, setOpen] = useState(startOpen)
  const [draft, setDraft] = useState(initial)
  return (
    <TaskEntry
      open={open}
      draft={draft}
      workers={workers}
      onOpen={() => setOpen(true)}
      onCancel={() => setOpen(false)}
      onDraftChange={(next) => {
        setDraft(next)
        onDraftChange?.(next)
      }}
      onSubmit={onSubmit}
    />
  )
}

function renderEntry(
  initial: TaskEntryDraft = TASK_ENTRY_DRAFTS.typed,
  startOpen = true,
  workers?: readonly TaskEntryWorker[]
) {
  const onSubmit = vi.fn()
  const onDraftChange = vi.fn()
  const rendered = renderComponent(
    <Harness
      initial={initial}
      startOpen={startOpen}
      workers={workers}
      onSubmit={onSubmit}
      onDraftChange={onDraftChange}
    />
  )
  return { ...rendered, onSubmit, onDraftChange }
}

function workerField() {
  return screen.getByRole('combobox', { name: taskEntry.workerLabel })
}

function titleField() {
  return screen.getByRole('textbox', { name: taskEntry.title })
}

describe('TaskEntry', () => {
  test('Enter in the title adds to the backlog, Shift+Enter to the queue', async () => {
    const { user, onSubmit } = renderEntry()

    await user.click(titleField())
    await user.keyboard('{Enter}')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(onSubmit.mock.calls).toEqual([['backlog'], ['queue']])
  })

  test.each([
    ['the title', TASK_ENTRY_DRAFTS.empty],
    ['a step title', TASK_ENTRY_DRAFTS.stepUntitled],
  ])('neither key nor button submits while %s is empty', async (_, draft) => {
    const { user, onSubmit } = renderEntry(draft)

    await user.click(titleField())
    await user.keyboard('{Enter}')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.click(screen.getByRole('button', { name: taskEntry.add }))
    await user.click(screen.getByRole('button', { name: taskEntry.addToQueue }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: taskEntry.add })).toBeDisabled()
    expect(screen.getByRole('button', { name: taskEntry.addToQueue })).toBeDisabled()
  })

  test('spaces alone are empty, and the hint says what is missing', async () => {
    const { user } = renderEntry({ title: '   ', steps: [{ ...TASK_ENTRY_DRAFTS.empty.steps[0] }] })

    expect(titleField()).toHaveAccessibleDescription(taskEntry.needsTitle)
    await user.type(titleField(), 'Ship it')
    expect(titleField()).toHaveAccessibleDescription(taskEntry.stepNeedsTitle)
    await user.type(screen.getByRole('textbox', { name: 'Title of step 1' }), 'Write it')
    expect(titleField()).toHaveAccessibleDescription('Enter to add, Shift Enter to queue')
  })

  test('Enter while an input method composes does not submit', () => {
    const { onSubmit } = renderEntry()

    fireEvent.keyDown(titleField(), { key: 'Enter', isComposing: true })
    fireEvent.keyDown(titleField(), { key: 'Enter', keyCode: 229 })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('the owner group is one tab stop, and the arrow keys switch between Agent and You', async () => {
    const { user } = renderEntry(TASK_ENTRY_DRAFTS.typed)
    const firstStep = screen.getAllByRole('listitem')[0]
    const group = within(firstStep).getByRole('group', { name: 'Owner of step 1' })
    const agent = within(group).getByRole('radio', { name: 'Agent' })
    const you = within(group).getByRole('radio', { name: 'You' })

    within(firstStep).getByRole('textbox', { name: 'Title of step 1' }).focus()
    await user.tab()
    expect(agent).toHaveFocus()
    expect(agent).toBeChecked()

    await user.keyboard('{ArrowRight}')
    expect(you).toHaveFocus()
    expect(you).toBeChecked()

    await user.keyboard('{ArrowLeft}')
    expect(agent).toBeChecked()

    await user.tab()
    expect(group).not.toContainElement(document.activeElement as HTMLElement)
  })

  test('opening focuses the title; Escape collapses and returns focus to Add task', async () => {
    const { user } = renderEntry(TASK_ENTRY_DRAFTS.empty, false)

    await user.click(screen.getByRole('button', { name: taskEntry.addTask }))
    expect(titleField()).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: taskEntry.title })).toBeNull()
    expect(screen.getByRole('button', { name: taskEntry.addTask })).toHaveFocus()
  })

  test('Cancel collapses and keeps the draft for the next opening', async () => {
    const { user } = renderEntry(TASK_ENTRY_DRAFTS.typed)

    await user.click(screen.getByRole('button', { name: taskEntry.cancel }))
    expect(screen.getByRole('button', { name: taskEntry.addTask })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: taskEntry.addTask }))
    expect(titleField()).toHaveValue(TASK_ENTRY_DRAFTS.typed.title)
  })

  test('a step can be added, owned and removed, and the new step takes focus', async () => {
    const { user } = renderEntry(TASK_ENTRY_DRAFTS.typed)

    await user.click(screen.getByRole('button', { name: taskEntry.addStep }))
    const third = screen.getByRole('textbox', { name: 'Title of step 3' })
    expect(third).toHaveFocus()
    expect(screen.getByRole('group', { name: 'Owner of step 3' })).toContainElement(
      screen.getAllByRole('radio', { name: 'Agent', checked: true })[2]
    )

    await user.click(screen.getByRole('button', { name: 'Remove step 1' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: 'Title of step 1' })).toHaveValue(
      TASK_ENTRY_DRAFTS.typed.steps[1].title
    )
  })

  test('twenty steps offer no Add step, and one step cannot be removed', () => {
    renderEntry(TASK_ENTRY_DRAFTS.twenty)
    expect(screen.queryByRole('button', { name: taskEntry.addStep })).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(20)
  })

  test('a single step has no Remove button', () => {
    renderEntry(TASK_ENTRY_DRAFTS.empty)
    expect(screen.queryByRole('button', { name: 'Remove step 1' })).toBeNull()
  })

  test('Detail opens the detail field and focuses it', async () => {
    const { user } = renderEntry(TASK_ENTRY_DRAFTS.typed)

    await user.click(screen.getByRole('button', { name: 'Detail of step 1' }))
    const detail = screen.getByRole('textbox', { name: 'Detail of step 1' })
    expect(detail).toHaveFocus()

    await user.type(detail, 'One{Enter}Two')
    expect(detail).toHaveValue('One\nTwo')
  })

  test('while a task is added the pressed button is busy, the other disabled, the fields editable', async () => {
    const onSubmit = vi.fn()
    const { user } = renderComponent(
      <TaskEntry
        open
        draft={TASK_ENTRY_DRAFTS.typed}
        busy="queue"
        onOpen={vi.fn()}
        onCancel={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByRole('button', { name: taskEntry.addToQueue })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByRole('button', { name: taskEntry.add })).toBeDisabled()
    expect(titleField()).toBeEnabled()
    await user.click(titleField())
    await user.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('TaskEntry worker field', () => {
  test('lists Any worker first and then each live worker by name, after the title', () => {
    renderEntry(TASK_ENTRY_DRAFTS.typed, true, TASK_ENTRY_WORKERS.two)

    expect(
      within(workerField())
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual([taskEntry.anyWorker, 'api-server', 'web-client'])
    expect(workerField()).toHaveValue('')
    expect(
      titleField().compareDocumentPosition(workerField()) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      workerField().compareDocumentPosition(
        screen.getByRole('textbox', { name: 'Title of step 1' })
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  test.each([
    ['no workers are given', undefined],
    ['no worker is live', []],
  ])('is absent when %s', (_, workers) => {
    renderEntry(TASK_ENTRY_DRAFTS.typed, true, workers)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  test('choosing a worker puts its id in the draft, and Any worker clears it', async () => {
    const { user, onDraftChange } = renderEntry(
      TASK_ENTRY_DRAFTS.typed,
      true,
      TASK_ENTRY_WORKERS.two
    )

    await user.selectOptions(workerField(), 'web-client')
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ assignTo: 'worker-web-client' })
    )
    expect(workerField()).toHaveValue('worker-web-client')

    await user.selectOptions(workerField(), taskEntry.anyWorker)
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ assignTo: null }))
    expect(workerField()).toHaveValue('')
  })

  test('a chosen worker that is no longer live shows as Any worker', () => {
    renderEntry(TASK_ENTRY_DRAFTS.assigned, true, [TASK_ENTRY_WORKERS.two[0]])

    expect(workerField()).toHaveValue('')
    expect(screen.queryByRole('option', { name: 'web-client' })).toBeNull()
  })
})
