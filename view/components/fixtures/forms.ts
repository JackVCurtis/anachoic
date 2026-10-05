import type { QuestionFormData } from '../helpers/question_form.js'
import { LONG_TEXT } from './long_text.js'

/**
 * Forms an agent asks with, for the cards and the form's own stories.
 */

/** One page, one pick. */
export const PICK_THE_CACHE: QuestionFormData = {
  pages: [
    {
      id: 'cache',
      question: 'Redis or in-process?',
      choose: 'one',
      options: [{ label: 'Redis' }, { label: 'In-process' }],
    },
  ],
}

/**
 * Three pages that branch on the first: Redis asks for a key prefix, in-process
 * for what may be cached; both end on how long entries live.
 */
export const BRANCHING: QuestionFormData = {
  pages: [
    {
      id: 'cache',
      question: 'Which cache should the search endpoint use?',
      choose: 'one',
      options: [
        { label: 'Redis', next: 'prefix' },
        { label: 'In-process', next: 'scope' },
      ],
    },
    { id: 'prefix', question: 'What key prefix should it use?', choose: 'text', next: 'ttl' },
    {
      id: 'scope',
      question: 'Which responses may it cache?',
      choose: 'many',
      options: [{ label: 'Search results' }, { label: 'Facet counts' }, { label: 'Suggestions' }],
      next: 'ttl',
    },
    {
      id: 'ttl',
      question: 'How long should entries live?',
      choose: 'one',
      options: [{ label: '1 minute' }, { label: '10 minutes' }, { label: '1 hour' }],
    },
  ],
}

const QUESTION_MAX = 250
const LABEL_MAX = 150

/** Text cut to exactly `length` characters, ending on a full stop rather than a space. */
function fit(text: string, length: number) {
  return text
    .slice(0, length - 1)
    .trimEnd()
    .padEnd(length, '.')
}

/** A question of 250 characters and six options of 150, the longest a page takes. */
export const LONGEST_PAGE: QuestionFormData = {
  pages: [
    {
      id: 'policy',
      question: fit(LONG_TEXT.answer, QUESTION_MAX),
      choose: 'one',
      options: Array.from({ length: 6 }, (_, index) => ({
        label: fit(`${index + 1}. ${LONG_TEXT.answer.slice(index * 10)}`, LABEL_MAX),
      })),
    },
  ],
}
