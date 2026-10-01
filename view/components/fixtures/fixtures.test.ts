// Copied from anachoic inertia/components/fixtures/fixtures.test.ts at fd99e0d
import { describe, expect, test } from 'vitest'
import { LONG_TEXT } from './long_text'

describe('long text', () => {
  test('each field is at its longest', () => {
    expect(LONG_TEXT.title).toHaveLength(120)
    expect(LONG_TEXT.name).toHaveLength(40)
    expect(LONG_TEXT.message).toHaveLength(200)
  })
})
