// Copied from anachoic inertia/components/fixtures/long_text.ts at fd99e0d
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
} as const
