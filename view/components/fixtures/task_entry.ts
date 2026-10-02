import type { TaskEntryDraft, TaskEntryStep, TaskEntryWorker } from '../helpers/task_entry'
import { LONG_TEXT } from './long_text'

function step(index: number, title: string, owner: TaskEntryStep['owner'], detail = '') {
  return { id: `draft-step-${index}`, title, owner, detail }
}

/**
 * Drafts of a task in task entry, one per state its stories show.
 */
export const TASK_ENTRY_DRAFTS = {
  empty: { title: '', steps: [step(1, '', 'agent')] },
  typed: {
    title: 'Add retries to the billing webhook',
    steps: [step(1, 'Draft the retry policy', 'agent'), step(2, 'Implement the backoff', 'agent')],
  },
  oneYours: {
    title: 'Add retries to the billing webhook',
    steps: [step(1, 'Draft the retry policy', 'agent'), step(2, 'Review the PR', 'you')],
  },
  stepUntitled: {
    title: 'Add retries to the billing webhook',
    steps: [step(1, 'Draft the retry policy', 'agent'), step(2, '', 'agent')],
  },
  twenty: {
    title: 'Move every consumer to the event bus',
    steps: Array.from({ length: 20 }, (_, index) =>
      step(index + 1, `Move consumer ${index + 1}`, index % 5 === 4 ? 'you' : 'agent')
    ),
  },
  detail: {
    title: 'Add retries to the billing webhook',
    steps: [
      step(
        1,
        'Draft the retry policy',
        'agent',
        'Use the backoff the payments service uses: 1 s, 5 s, 30 s, then give up and alert.'
      ),
    ],
  },
  longTitle: {
    title: LONG_TEXT.title,
    steps: [step(1, LONG_TEXT.title, 'agent')],
  },
  assigned: {
    title: 'Add retries to the billing webhook',
    steps: [step(1, 'Draft the retry policy', 'agent'), step(2, 'Review the PR', 'you')],
    assignTo: 'worker-web-client',
  },
} as const satisfies Record<string, TaskEntryDraft>

/**
 * The live workers task entry can assign to: two, and one with a name of 40
 * characters.
 */
export const TASK_ENTRY_WORKERS = {
  two: [
    { id: 'worker-api-server', name: 'api-server' },
    { id: 'worker-web-client', name: 'web-client' },
  ],
  longName: [{ id: 'worker-long', name: LONG_TEXT.name }],
} as const satisfies Record<string, readonly TaskEntryWorker[]>

/**
 * What the server says about one field, as an invalid refusal names it.
 */
export const TASK_ENTRY_FIELD_ERRORS = {
  stepTitle: {
    field: { kind: 'step-title', index: 1 },
    text: 'steps[1].title must be 1 to 200 characters',
  },
  title: {
    field: { kind: 'title' },
    text: 'title must be 1 to 200 characters',
  },
} as const
