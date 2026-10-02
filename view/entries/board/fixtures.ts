import type { BoardProps } from '../../../shared/props.js'
import {
  BUSY_BOARD,
  EMPTY_BOARD,
  LONG_TEXT_BOARD,
  MANY_BOARD,
  workersOf,
  type BoardSample,
} from '../../components/fixtures/board.js'
import { FIXED_NOW } from '../../components/fixtures/clock.js'

/**
 * A board sample as the server sends it: each session that asks or runs a
 * step is named by id and name rather than by name alone, and the live
 * workers are listed.
 */
function toBoardProps(board: BoardSample, revision: number): BoardProps {
  const sessionNamed = (name: string) => {
    const session = board.sessions.find((candidate) => candidate.name === name)
    if (!session) {
      throw new Error(`No session is named “${name}”`)
    }
    return { id: session.id, name: session.name }
  }

  return {
    revision,
    now: FIXED_NOW,
    yourTurn: board.yourTurn.map(({ sessionName, ...item }) => ({
      ...item,
      steps: [...item.steps],
      ...(sessionName === undefined ? {} : { session: sessionNamed(sessionName) }),
    })),
    working: board.working.map(({ sessionName, ...item }) => ({
      ...item,
      steps: [...item.steps],
      session: sessionNamed(sessionName),
    })),
    queue: board.queue.map((item) => ({ ...item, steps: [...item.steps] })),
    backlog: board.backlog.map((item) => ({ ...item, steps: [...item.steps] })),
    toSignOff: board.toSignOff.map((item) => ({ ...item, steps: [...item.steps] })),
    signedOff: [...board.signedOff],
    sessions: board.sessions.map(({ released, ...session }) => ({
      ...session,
      ...(released === undefined ? {} : { released: [...released] }),
    })),
    workers: workersOf(board),
    counts: board.counts,
  }
}

export const EMPTY_BOARD_PROPS: BoardProps = toBoardProps(EMPTY_BOARD, 0)

export const BUSY_BOARD_PROPS: BoardProps = toBoardProps(BUSY_BOARD, 214)

export const MANY_BOARD_PROPS: BoardProps = toBoardProps(MANY_BOARD, 512)

export const LONG_TEXT_BOARD_PROPS: BoardProps = toBoardProps(LONG_TEXT_BOARD, 37)

/**
 * Every named board as props, for tests that check them all.
 */
export const NAMED_BOARD_PROPS = {
  EMPTY_BOARD: EMPTY_BOARD_PROPS,
  BUSY_BOARD: BUSY_BOARD_PROPS,
  MANY_BOARD: MANY_BOARD_PROPS,
  LONG_TEXT_BOARD: LONG_TEXT_BOARD_PROPS,
} as const
