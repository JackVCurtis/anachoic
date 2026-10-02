import type { Route } from '@playwright/test'
import { callFromHost, callsTool, expect, ok, test } from './support/harness.js'

test('the board draws from get_board, not from the tool result the host replays', async ({
  page,
  board,
}) => {
  const chat = await board.chat()
  await ok(chat, 'add_task', { title: 'Real title', steps: [{ title: 'Do it', owner: 'agent' }] })

  let replayed = false
  await page.route('**/mcp', async (route) => {
    if (!callsTool(route.request().postData(), 'show_board')) {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const text = await response.text()
    const body = text.replaceAll('Real title', 'Replayed title')
    replayed = true
    await route.fulfill({ response, body })
  })

  const view = await callFromHost(page, 'show_board')
  await expect(view.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Tool Result')).toBeVisible()
  await expect.poll(() => replayed).toBe(true)
  // A moment for the replayed result to reach the view, which must ignore it.
  await page.waitForTimeout(500)

  await expect(view.getByRole('button', { name: 'Real title' })).toBeVisible()
  await expect(view.getByText('Replayed title')).toHaveCount(0)
})

test('a worker’s change made over stdio appears within 5 s', async ({ page, board }) => {
  const view = await callFromHost(page, 'show_board')
  await expect(view.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(view.getByText('Nothing is running')).toBeVisible()

  const api = await board.worker('worker-a', 'api-server')
  await ok(api, 'add_task', { title: 'From a worker', steps: [{ title: 'Do it', owner: 'agent' }] })
  await expect(view.getByRole('button', { name: 'From a worker' })).toBeVisible({ timeout: 5000 })

  await ok(api, 'claim_step')
  await expect(view.getByText('Nothing is running')).toHaveCount(0, { timeout: 5000 })
})

test('an action in the view updates the board from its own result, with no poll between', async ({
  page,
  board,
}) => {
  const chat = await board.chat()
  await ok(chat, 'add_task', { title: 'Check it', steps: [{ title: 'Look', owner: 'user' }] })
  await ok(chat, 'complete_my_step', { task: 'T-001' })

  const held: Route[] = []
  let holdPolls = false
  let signedOff = false
  await page.route('**/mcp', async (route) => {
    const data = route.request().postData()
    if (holdPolls && callsTool(data, 'get_board')) {
      held.push(route)
      return
    }
    if (callsTool(data, 'sign_off')) signedOff = true
    await route.continue()
  })

  const view = await callFromHost(page, 'show_board')
  const signOff = view.getByRole('button', { name: 'Sign off' })
  await expect(signOff).toBeVisible()

  holdPolls = true
  await signOff.click()
  await expect.poll(() => signedOff).toBe(true)
  await expect(view.getByText('Nothing waiting for sign-off')).toBeVisible()
  await expect(view.getByRole('button', { name: 'Sign off' })).toHaveCount(0)
  expect(board.query('SELECT signed_off_at IS NOT NULL AS signed FROM tasks')).toEqual([
    { signed: 1 },
  ])

  holdPolls = false
  await Promise.all(held.map((route) => route.continue().catch(() => {})))
})

test('a dimensions-only context change leaves the board’s height as it was', async ({
  page,
  board,
}) => {
  const chat = await board.chat()
  for (const title of ['First', 'Second', 'Third']) {
    await ok(chat, 'add_task', { title, steps: [{ title: 'Do it', owner: 'agent' }] })
  }
  const view = await callFromHost(page, 'show_board')
  await expect(view.getByRole('button', { name: 'Third' })).toBeVisible()
  const frame = page.locator('iframe').first()
  // The host animates each size change over 300 ms.
  await page.waitForTimeout(800)
  const before = (await frame.boundingBox())!

  const viewport = page.viewportSize()!
  await page.setViewportSize({ width: viewport.width - 8, height: viewport.height })
  await page.waitForTimeout(800)
  const after = (await frame.boundingBox())!

  expect(after.width).not.toBe(before.width)
  expect(after.height).toBe(before.height)
})
