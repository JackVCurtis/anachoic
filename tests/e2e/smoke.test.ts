import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'

const BOARD = pathToFileURL(resolve(import.meta.dirname, '../../dist/views/board.html')).href

test('the built board view draws its heading', async ({ page }) => {
  await page.goto(BOARD)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Anachoic board')
})
