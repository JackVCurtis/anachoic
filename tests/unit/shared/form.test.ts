import { describe, expect, test } from 'vitest'
import {
  checkResponses,
  firstQuestion,
  formShapeProblem,
  renderAnswer,
  renderDirectAnswer,
  validateForm,
  type Form,
  type FormPage,
  type FormResponse,
} from '../../../shared/form.js'

/**
 * Redis leads to a text page, in-process to a "many" page, and both end on
 * the TTL.
 */
const BRANCHING: Form = {
  pages: [
    {
      id: 'cache',
      question: 'Which cache?',
      choose: 'one',
      options: [
        { label: 'Redis', next: 'prefix' },
        { label: 'In-process', next: 'scope' },
      ],
    },
    { id: 'prefix', question: 'Which key prefix?', choose: 'text', next: 'ttl' },
    {
      id: 'scope',
      question: 'What may it cache?',
      choose: 'many',
      options: [{ label: 'Results' }, { label: 'Facets' }, { label: 'Suggestions' }],
      next: 'ttl',
    },
    {
      id: 'ttl',
      question: 'How long?',
      choose: 'one',
      options: [{ label: '1 minute' }, { label: '1 hour' }],
    },
  ],
}

function withPage(index: number, change: Partial<FormPage>): Form {
  return {
    pages: BRANCHING.pages.map((page, at) => (at === index ? { ...page, ...change } : page)),
  }
}

const options = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ label: `Option ${index + 1}` }))

describe('validateForm', () => {
  test('accepts a form that branches and rejoins', () => {
    expect(validateForm(BRANCHING)).toBeNull()
  })

  test('accepts a question of 250 characters and labels of 150', () => {
    const form: Form = {
      pages: [
        {
          id: 'q',
          question: 'x'.repeat(250),
          choose: 'one',
          options: [{ label: 'a'.repeat(150) }, { label: 'b'.repeat(150) }],
        },
      ],
    }
    expect(validateForm(form)).toBeNull()
  })

  test.each<[string, unknown, string]>([
    ['no pages', { pages: [] }, 'form.pages must be 1 to 10 pages'],
    ['not a form', 'Which cache?', 'form.pages must be a list of pages'],
    [
      'eleven pages',
      {
        pages: Array.from({ length: 11 }, (_, index) => ({
          id: `p${index}`,
          question: 'Q?',
          choose: 'text',
          ...(index < 10 ? { next: `p${index + 1}` } : {}),
        })),
      },
      'form.pages must be 1 to 10 pages',
    ],
    [
      'a question of 251 characters',
      withPage(1, { question: 'x'.repeat(251) }),
      'form.pages[1].question must be 1 to 250 characters',
    ],
    [
      'an empty question',
      withPage(1, { question: '  ' }),
      'form.pages[1].question must be 1 to 250 characters',
    ],
    [
      'a label of 151 characters',
      withPage(3, { options: [{ label: 'x'.repeat(151) }, { label: 'y' }] }),
      'form.pages[3].options[0].label must be 1 to 150 characters',
    ],
    [
      'one option',
      withPage(3, { options: options(1) }),
      'form.pages[3].options must be 2 to 6 options',
    ],
    [
      'seven options',
      withPage(3, { options: options(7) }),
      'form.pages[3].options must be 2 to 6 options',
    ],
    [
      'a repeated label',
      withPage(3, { options: [{ label: 'Same' }, { label: ' same ' }] }),
      "form.pages[3].options[1].label repeats another option's label",
    ],
    [
      'a repeated id',
      withPage(3, { id: 'scope' }),
      'form.pages[3].id "scope" is used by another page',
    ],
    [
      'an id with spaces',
      withPage(3, { id: 'the ttl' }),
      'form.pages[3].id must be 1 to 32 characters of a-z, 0-9, _ and -',
    ],
    [
      'a choice page without options',
      withPage(3, { options: undefined }),
      'form.pages[3].options must be a list of options',
    ],
    [
      'a text page with options',
      withPage(1, { options: options(2) }),
      'form.pages[1] is a text page and takes no options',
    ],
    [
      'an unknown choose',
      withPage(1, { choose: 'some' as FormPage['choose'] }),
      'form.pages[1].choose must be one, many or text',
    ],
    [
      'a next that names no page',
      withPage(1, { next: 'nowhere' }),
      'form.pages[1].next names no page of the form',
    ],
    [
      'a next that points back',
      withPage(3, { next: 'cache' }),
      'form.pages[3].next must name a later page',
    ],
    [
      'a next to itself',
      withPage(1, { next: 'prefix' }),
      'form.pages[1].next must name a later page',
    ],
    [
      'an option next on a "many" page',
      withPage(2, { options: [{ label: 'Results', next: 'ttl' }, { label: 'Facets' }] }),
      'form.pages[2].options[0].next is allowed only on a "one" page; use the page\'s next',
    ],
    [
      'a page no answer reaches',
      withPage(0, {
        options: [
          { label: 'Redis', next: 'prefix' },
          { label: 'In-process', next: 'prefix' },
        ],
      }),
      'form.pages[2] cannot be reached from the first page',
    ],
  ])('refuses %s', (_, form, message) => {
    expect(validateForm(form)).toBe(message)
  })

  test('a page next that no option falls through to does not make its target reachable', () => {
    const form = withPage(0, { next: 'scope' })
    const unreached = withPage(0, {
      options: [
        { label: 'Redis', next: 'prefix' },
        { label: 'In-process', next: 'ttl' },
      ],
      next: 'scope',
    })
    expect(validateForm(form)).toBeNull()
    expect(validateForm(unreached)).toBe('form.pages[2] cannot be reached from the first page')
  })

  test('the shape check ignores the limits, so a stored form from before them still walks', () => {
    expect(
      formShapeProblem({ pages: [{ id: 'q', question: 'x'.repeat(2000), choose: 'text' }] })
    ).toBeNull()
  })
})

describe('checkResponses', () => {
  const redis: FormResponse[] = [
    { page: 'cache', picked: [0] },
    { page: 'prefix', text: 'search:' },
    { page: 'ttl', picked: [1] },
  ]

  test('accepts answers that walk a branch to the end', () => {
    expect(checkResponses(BRANCHING, redis)).toBeNull()
    expect(
      checkResponses(BRANCHING, [
        { page: 'cache', picked: [1] },
        { page: 'scope', picked: [0, 2] },
        { page: 'ttl', picked: [0] },
      ])
    ).toBeNull()
  })

  test.each<[string, FormResponse[], string]>([
    ['no answers', [], 'The answers stop before the form ends: "cache" is not answered'],
    [
      'stopping early',
      redis.slice(0, 2),
      'The answers stop before the form ends: "ttl" is not answered',
    ],
    [
      'a page off the branch',
      [{ page: 'cache', picked: [0] }, { page: 'scope', picked: [0] }, redis[2]],
      'The answers skip "prefix": the answer after the last must be to "prefix", not "scope"',
    ],
    [
      'an answer past the end',
      [...redis, { page: 'ttl', picked: [0] }],
      'The answers go past the end of the form at "ttl"',
    ],
    [
      'two picks on a "one" page',
      [{ page: 'cache', picked: [0, 1] }],
      'The answer to "cache" must pick exactly one option',
    ],
    [
      'no pick on a "many" page',
      [
        { page: 'cache', picked: [1] },
        { page: 'scope', picked: [] },
      ],
      'The answer to "scope" must pick at least one option',
    ],
    [
      'a pick out of range',
      [{ page: 'cache', picked: [2] }],
      'The answer to "cache" picks an option the page does not have',
    ],
    [
      'a repeated pick',
      [
        { page: 'cache', picked: [1] },
        { page: 'scope', picked: [0, 0] },
      ],
      'The answer to "scope" picks an option the page does not have',
    ],
    [
      'text on a choice page',
      [{ page: 'cache', text: 'Redis' }],
      'The answer to "cache" must be picks, not text',
    ],
    [
      'empty text',
      [
        { page: 'cache', picked: [0] },
        { page: 'prefix', text: '  ' },
      ],
      'The answer to "prefix" must be 1 to 500 characters',
    ],
    [
      'text of 501 characters',
      [
        { page: 'cache', picked: [0] },
        { page: 'prefix', text: 'x'.repeat(501) },
      ],
      'The answer to "prefix" must be 1 to 500 characters',
    ],
  ])('refuses %s', (_, responses, message) => {
    expect(checkResponses(BRANCHING, responses)).toBe(message)
  })
})

describe('the answers as markdown', () => {
  test('each page shown is a heading, with the picks as a list or the text as a paragraph', () => {
    expect(
      renderAnswer(BRANCHING, [
        { page: 'cache', picked: [1] },
        { page: 'scope', picked: [0, 2] },
        { page: 'ttl', picked: [1] },
      ])
    ).toBe(
      [
        '### Which cache?',
        '- In-process',
        '',
        '### What may it cache?',
        '- Results',
        '- Suggestions',
        '',
        '### How long?',
        '- 1 hour',
      ].join('\n')
    )
    expect(
      renderAnswer(BRANCHING, [
        { page: 'cache', picked: [0] },
        { page: 'prefix', text: '  search:\nv2  ' },
        { page: 'ttl', picked: [0] },
      ])
    ).toBe(
      [
        '### Which cache?',
        '- Redis',
        '',
        '### Which key prefix?',
        'search:\nv2',
        '',
        '### How long?',
        '- 1 minute',
      ].join('\n')
    )
  })

  test('a direct answer says the form was skipped', () => {
    expect(renderDirectAnswer('  Neither: drop the cache  ')).toBe(
      '### Answered directly\nThe user skipped the form and answered in their own words:\n\nNeither: drop the cache'
    )
  })

  test('firstQuestion names the first question and how many more pages may follow', () => {
    expect(firstQuestion(BRANCHING)).toBe('Which cache? (+2 more)')
    expect(firstQuestion({ pages: [BRANCHING.pages[3]] })).toBe('How long?')
  })
})
