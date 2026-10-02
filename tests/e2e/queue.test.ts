import type { FrameLocator, Page } from '@playwright/test'
import { callFromHost, callsTool, expect, ok, test, type Board } from './support/harness.js'

const TITLES = ['First', 'Second', 'Third']

async function queueOfThree(page: Page, board: Board) {
  const chat = await board.chat()
  for (const title of TITLES) {
    await ok(chat, 'add_task', { title, steps: [{ title: 'Do it', owner: 'agent' }] })
  }
  const reorders: string[] = []
  page.on('request', (request) => {
    if (callsTool(request.postData(), 'reorder_queue')) reorders.push(request.postData()!)
  })
  const view = await callFromHost(page, 'show_board')
  await expect(cards(view)).toHaveCount(3)
  return { view, reorders }
}

function queueSection(view: FrameLocator) {
  return view.locator('section').filter({
    has: view.getByRole('heading', { level: 2, name: 'Queue' }),
  })
}

function cards(view: FrameLocator) {
  return queueSection(view).getByRole('listitem')
}

function storedOrder(board: Board) {
  return board
    .query<{ title: string }>(
      "SELECT title FROM tasks WHERE status = 'queue' ORDER BY queue_position"
    )
    .map(({ title }) => title)
}

/**
 * Waits for the view to poll the board once more, after it has drawn the
 * result of the reorder.
 */
async function nextPoll(page: Page) {
  await page.waitForRequest((request) => callsTool(request.postData(), 'get_board'), {
    timeout: 10_000,
  })
  await page.waitForResponse((response) => callsTool(response.request().postData(), 'get_board'))
}

const REORDERED = ['Third', 'First', 'Second']

test('the keyboard lifts the third card, moves it to the front and drops it, calling reorder_queue once', async ({
  page,
  board,
}) => {
  const { view, reorders } = await queueOfThree(page, board)

  const handle = cards(view).nth(2).getByRole('button', { name: 'Move', exact: true })
  await handle.focus()
  await page.keyboard.press('Enter')
  await expect(cards(view).nth(2).getByRole('button', { name: 'Drop' })).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')

  await expect(cards(view).getByRole('button', { name: /^(First|Second|Third)$/ })).toHaveText(
    REORDERED
  )
  await expect.poll(() => storedOrder(board)).toEqual(REORDERED)
  expect(reorders).toHaveLength(1)
  expect(JSON.parse(reorders[0]).params.arguments).toMatchObject({ position: 1 })

  await nextPoll(page)
  await expect(cards(view).getByRole('button', { name: /^(First|Second|Third)$/ })).toHaveText(
    REORDERED
  )
})

test('dragging the third card to the front with the pointer calls reorder_queue, and the board keeps the order after the next poll', async ({
  page,
  board,
}) => {
  const { view, reorders } = await queueOfThree(page, board)

  await queueSection(view).scrollIntoViewIfNeeded()
  const third = (await cards(view).nth(2).boundingBox())!
  const first = (await cards(view).nth(0).boundingBox())!
  const startX = third.x + third.width / 2
  const startY = third.y + third.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // A frame between moves, as a hand gives, so the lift is drawn before the card moves.
  for (let y = startY - 5; y > first.y + 4; y -= 5) {
    await page.mouse.move(startX, y)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()

  await expect.poll(() => storedOrder(board)).toEqual(REORDERED)
  expect(reorders).toHaveLength(1)
  await expect(view.getByRole('button', { name: 'Back to board' })).toHaveCount(0)

  await nextPoll(page)
  await expect(cards(view).getByRole('button', { name: /^(First|Second|Third)$/ })).toHaveText(
    REORDERED
  )
})
