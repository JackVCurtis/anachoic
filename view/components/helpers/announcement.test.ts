// Copied from anachoic inertia/components/helpers/announcement.test.ts at fd99e0d
import { expect, test } from 'vitest'
import { announcement, type AnnouncementFact } from './announcement'

const TITLE = 'Migrate billing webhooks'

test.each<{ fact: AnnouncementFact; expected: string }>([
  {
    fact: { kind: 'your-step', title: TITLE },
    expected: '“Migrate billing webhooks” is waiting on the user',
  },
  {
    fact: { kind: 'question', title: TITLE, sessionName: 'Session 2' },
    expected: 'Session 2 asks about “Migrate billing webhooks”',
  },
  {
    fact: { kind: 'question', title: TITLE },
    expected: '“Migrate billing webhooks” has a question for the user',
  },
  {
    fact: { kind: 'sign-off', title: TITLE },
    expected: '“Migrate billing webhooks” is finished and waiting for sign-off',
  },
  {
    fact: { kind: 'blocked', displayId: 'T-012', sessionName: 'api-server' },
    expected: 'T-012 is blocked in api-server',
  },
  {
    fact: { kind: 'blocked', displayId: 'T-012' },
    expected: 'T-012 is blocked',
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
  expect(announcement({ kind: 'your-step', title: 'Fix {n} bugs' })).toBe(
    '“Fix {n} bugs” is waiting on the user'
  )
  expect(announcement({ kind: 'question', title: 'Fix {n} bugs', sessionName: '{title}' })).toBe(
    '{title} asks about “Fix {n} bugs”'
  )
})

test('a fact that is not on the list is not announced', () => {
  const unknown = { kind: 'arrived', title: TITLE } as unknown as AnnouncementFact
  expect(announcement(unknown)).toBeNull()
})
