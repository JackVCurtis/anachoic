import type { Page } from '@playwright/test'
import { callFromHost, callsTool, expect, ok, test, type Board } from './support/harness.js'

const PR = 'https://github.com/acme/api/pull/7'

/**
 * T-001, done and waiting for sign-off, whose first step opened a pull
 * request.
 */
async function doneTaskWithPullRequest(board: Board) {
  const chat = await board.chat()
  const api = await board.worker('worker-a', 'api-server')
  await ok(chat, 'add_task', {
    title: 'Add retries',
    steps: [
      { title: 'Open the PR', owner: 'agent', output_format: 'pull_request' },
      { title: 'Note it', owner: 'agent' },
    ],
  })
  await ok(api, 'claim_step')
  await ok(api, 'complete_step', { task: 'T-001', summary: 'Opened it', artifact_url: PR })
  await ok(api, 'claim_step', { task: 'T-001' })
  await ok(api, 'complete_step', { task: 'T-001', summary: 'Noted it' })
}

/**
 * Runs `click` on a link in the view and gives the address of the page the host
 * opened for it. The host opens links in a new page; the view cannot.
 */
async function opened(page: Page, click: () => Promise<void>) {
  await page.context().route(`${PR}**`, (route) => route.fulfill({ body: 'pull request' }))
  const [popup] = await Promise.all([page.context().waitForEvent('page'), click()])
  const url = popup.url()
  await popup.close()
  return url
}

test('a task opened from the board shows its chain, its link opens through the host, and Back returns to the same board', async ({
  page,
  board,
}) => {
  await doneTaskWithPullRequest(board)
  let fetchedTask = false
  page.on('request', (request) => {
    if (callsTool(request.postData(), 'get_task')) fetchedTask = true
  })
  const view = await callFromHost(page, 'show_board')
  const revision = board.revision()

  await view.getByRole('button', { name: 'Add retries' }).click()
  const back = view.getByRole('button', { name: 'Back to board' })
  await expect(back).toBeVisible()
  await expect(view.getByRole('button', { name: /Note it$/ })).toBeVisible()
  expect(fetchedTask).toBe(true)

  await view.getByRole('button', { name: /Open the PR$/ }).click()
  const link = view.getByRole('link', { name: /Pull request/ }).first()
  expect(await opened(page, () => link.click())).toBe(PR)
  await expect(back).toBeVisible()

  await back.click()
  await expect(view.getByRole('heading', { level: 1, name: 'Board' })).toBeVisible()
  await expect(view.getByRole('button', { name: 'Sign off' })).toBeVisible()
  expect(board.revision()).toBe(revision)
})

test('an artifact link on a board card opens through the host', async ({ page, board }) => {
  await doneTaskWithPullRequest(board)
  const view = await callFromHost(page, 'show_board')

  const link = view.getByRole('link', { name: /Pull request/ }).first()
  await expect(link).toBeVisible()
  expect(await opened(page, () => link.click())).toBe(PR)
})

test('open_task draws the task view, whose link opens through the host', async ({
  page,
  board,
}) => {
  await doneTaskWithPullRequest(board)
  const view = await callFromHost(page, 'open_task', { task: 'T-001' })

  await expect(view.getByRole('heading', { name: 'Add retries' })).toBeVisible()
  await view.getByRole('button', { name: /Open the PR$/ }).click()
  const link = view.getByRole('link', { name: /Pull request/ }).first()
  expect(await opened(page, () => link.click())).toBe(PR)
})
