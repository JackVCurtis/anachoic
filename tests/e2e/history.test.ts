import type { FrameLocator } from '@playwright/test'
import { callFromHost, expect, ok, test, type Board } from './support/harness.js'

const SIGNED_OFF = 25

async function signOffTasks(board: Board) {
  const chat = await board.chat()
  for (let task = 1; task <= SIGNED_OFF; task += 1) {
    await ok(chat, 'add_task_from_view', {
      title: `Task ${task}`,
      steps: [{ title: 'Do it', owner: 'user' }],
    })
    await ok(chat, 'complete_my_step', { task })
    await ok(chat, 'sign_off', { task })
  }
}

/**
 * The display ids in the History table, top to bottom.
 */
function shownIds(view: FrameLocator) {
  return view
    .getByRole('table')
    .getByRole('row')
    .filter({ hasText: /T-\d{3}/ })
    .allInnerTexts()
    .then((rows) => rows.map((row) => /T-\d{3}/.exec(row)![0]))
}

const ids = (from: number, to: number) =>
  Array.from({ length: from - to + 1 }, (_, index) => `T-${String(from - index).padStart(3, '0')}`)

async function pagesThrough(view: FrameLocator) {
  await expect(view.getByText('Page 1 of 2')).toBeVisible()
  await expect.poll(() => shownIds(view)).toEqual(ids(25, 6))

  await view.getByRole('button', { name: 'Next' }).click()
  await expect(view.getByText('Page 2 of 2')).toBeVisible()
  await expect.poll(() => shownIds(view)).toEqual(ids(5, 1))
  await expect(view.getByRole('button', { name: 'Next' })).toBeDisabled()

  await view.getByRole('button', { name: 'Previous' }).click()
  await expect(view.getByText('Page 1 of 2')).toBeVisible()
  await expect.poll(() => shownIds(view)).toEqual(ids(25, 6))
}

test('show_history pages through the completed tasks, newest first', async ({ page, board }) => {
  await signOffTasks(board)
  const view = await callFromHost(page, 'show_history')

  await expect(view.getByText(`${SIGNED_OFF} completed tasks`)).toBeVisible()
  await pagesThrough(view)
})

test('the board’s History panel pages too, and Back to board returns to the board', async ({
  page,
  board,
}) => {
  await signOffTasks(board)
  const view = await callFromHost(page, 'show_board')

  await view.getByRole('button', { name: 'Show all completed tasks' }).click()
  await pagesThrough(view)

  await view.getByRole('button', { name: 'Back to board' }).click()
  await expect(view.getByRole('heading', { level: 1, name: 'Board' })).toBeVisible()
})
