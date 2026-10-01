// Copied from anachoic inertia/components/fixtures/long_text.ts at fd99e0d
const ANSWER_SENTENCE =
  'Keep the retries as they are, move the consumers one queue at a time, and stop if the error rate rises. '

/**
 * An answer built from one sentence and cut at 4,000 characters.
 */
const ANSWER = ANSWER_SENTENCE.repeat(Math.ceil(4000 / ANSWER_SENTENCE.length)).slice(0, 4000)

/**
 * The longest text each field is shown with in a story.
 */
export const LONG_TEXT = {
  /** 120 characters. */
  title:
    'Move the billing webhook consumers off the legacy Redis streams and onto the shared event bus, keeping each retry intact',
  /** 40 characters, such as a session name. */
  name: 'Retry and backoff for billing webhooks 2',
  /** 200 characters. */
  message:
    'That step has already been handled by another session. The board now shows where the task stands, ' +
    'so check its chain and the session that holds it before you answer again or add a follow-up task here.',
  /** 4,000 characters, the longest answer to an agent's question. */
  answer: ANSWER,
} as const
