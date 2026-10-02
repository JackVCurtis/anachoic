// Copied from anachoic inertia/components/fixtures/messages.ts at fd99e0d
import { LONG_TEXT } from './long_text'

/**
 * Messages for the message region: an id, a kind and the text, as the board
 * entry shows a tool's refusal or a success.
 */
export const MESSAGES = {
  success: {
    id: 'message-1',
    kind: 'success',
    text: 'T-012 signed off.',
  },
  error: {
    id: 'message-2',
    kind: 'error',
    text: 'Step 2 of T-012 is claimed by api-server',
  },
  busy: {
    id: 'message-5',
    kind: 'error',
    text: 'The board is busy. Try again.',
  },
  /** 200 characters, the longest message a story shows. */
  long: {
    id: 'message-3',
    kind: 'error',
    text: LONG_TEXT.message,
  },
} as const
