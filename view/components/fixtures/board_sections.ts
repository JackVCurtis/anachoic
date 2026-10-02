import {
  agentAsks,
  BUSY_BOARD,
  LONG_TEXT_BOARD,
  THIS_CHAT,
  yourStep,
  type YourTurnSample,
} from './board.js'
import { before } from './clock.js'
import { LONG_TEXT } from './long_text.js'

/*
 * The cards of one section at a time, for the section and card stories. Each
 * is built from the same builders as the named boards in board.ts.
 */

const [REVIEW_THE_PR, CHOOSE_THE_CACHE_KEY] = BUSY_BOARD.yourTurn

/**
 * Your turn: your own step, an agent's question, a question of 2,000
 * characters, a long title, and twenty cards.
 */
export const YOUR_TURN = {
  yourStep: REVIEW_THE_PR,
  question: CHOOSE_THE_CACHE_KEY,
  longQuestion: agentAsks(
    30,
    'Pick the retry policy for the billing webhooks',
    [
      ['agent', 'done', 'Read the webhook logs'],
      ['agent', 'waiting', 'Choose the retry policy', THIS_CHAT],
    ],
    LONG_TEXT.answer.slice(0, 2000),
    before({ minutes: 2 })
  ),
  longTitle: LONG_TEXT_BOARD.yourTurn[0],
  many: Array.from({ length: 20 }, (_, index): YourTurnSample => {
    const number = 40 + index
    return index % 2 === 0
      ? yourStep(
          number,
          `Review the change for task ${number}`,
          [
            ['agent', 'done', 'Make the change'],
            ['you', 'waiting', 'Review the change'],
          ],
          before({ minutes: 20 - index })
        )
      : agentAsks(
          number,
          `Choose the approach for task ${number}`,
          [['agent', 'waiting', 'Choose the approach', THIS_CHAT]],
          'Keep the current schema or add a column?',
          before({ minutes: 20 - index })
        )
  }),
} as const
