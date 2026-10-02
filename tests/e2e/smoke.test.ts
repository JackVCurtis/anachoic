import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'

const BOARD = pathToFileURL(resolve(import.meta.dirname, '../../dist/views/board.html')).href
const TASK = pathToFileURL(resolve(import.meta.dirname, '../../dist/views/task.html')).href

test('the built board view loads without errors and draws nothing until a host answers', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(BOARD)
  await page.waitForTimeout(500)

  await expect(page.locator('#app')).toBeEmpty()
  expect(errors).toEqual([])
})

test('the built task view loads without errors and draws nothing until a host answers', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(TASK)
  await page.waitForTimeout(500)

  await expect(page.locator('#app')).toBeEmpty()
  expect(errors).toEqual([])
})
