// Copied from anachoic inertia/components/helpers/announcement.test.ts at fd99e0d
import { expect, test } from 'vitest'
import { announcement, type AnnouncementFact } from './announcement'

const TITLE = 'Migrate billing webhooks'

test.each<{ fact: AnnouncementFact; expected: string }>([
  {
    fact: { kind: 'your-turn', title: TITLE },
    expected: '“Migrate billing webhooks” is waiting on you',
  },
  {
    fact: { kind: 'sign-off', title: TITLE },
    expected: '“Migrate billing webhooks” is finished and waiting for sign-off',
  },
])('$fact.kind gives "$expected"', ({ fact, expected }) => {
  expect(announcement(fact)).toBe(expected)
})

test('titles sit between curly quotes', () => {
  const sentence = announcement({ kind: 'sign-off', title: TITLE })
  expect(sentence?.startsWith(`“${TITLE}”`)).toBe(true)
  expect(sentence).not.toContain('"')
})

test('a title with braces is announced as written', () => {
  expect(announcement({ kind: 'your-turn', title: 'Fix {n} bugs' })).toBe(
    '“Fix {n} bugs” is waiting on you'
  )
})

test('a fact that is not on the list is not announced', () => {
  const unknown = { kind: 'arrived', title: TITLE } as unknown as AnnouncementFact
  expect(announcement(unknown)).toBeNull()
})
