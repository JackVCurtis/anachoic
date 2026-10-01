// Copied from anachoic inertia/components/helpers/constants.test.ts at fd99e0d
import { expect, test } from 'vitest'
import { COPIED_MS, DRAG_START_PX, FLASH_MS, FOLD_AFTER } from './constants'

test.each([
  { name: 'COPIED_MS', value: COPIED_MS, expected: 1400 },
  { name: 'FLASH_MS', value: FLASH_MS, expected: 6000 },
  { name: 'DRAG_START_PX', value: DRAG_START_PX, expected: 4 },
  { name: 'FOLD_AFTER', value: FOLD_AFTER, expected: 8 },
])('$name is $expected', ({ value, expected }) => {
  expect(value).toBe(expected)
})
