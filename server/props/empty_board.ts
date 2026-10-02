import type { BoardProps } from '../../shared/props.js'

/**
 * The board before anything has been added: revision 0, every list empty and
 * every count 0.
 */
export function emptyBoard(now: Date = new Date()): BoardProps {
  return {
    revision: 0,
    now: now.toISOString(),
    yourTurn: [],
    working: [],
    queue: [],
    backlog: [],
    toSignOff: [],
    signedOff: [],
    sessions: [],
    workers: [],
    signedOffTotal: 0,
    counts: { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 },
  }
}
