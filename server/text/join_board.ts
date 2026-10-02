import type { Caller } from '../callers.js'

/**
 * join_board's result: who the caller is on the board and, for an id the
 * server minted, that the model must pass it back.
 */
export function joinBoardText(caller: Caller): string {
  const kind = caller.kind === 'dedicated' ? 'the dedicated session' : 'a worker session'
  const joined = `Joined the board as "${caller.name}", ${kind}, with session id ${caller.id}.`
  return caller.minted
    ? `${joined} Pass session "${caller.id}" on every later call to this server's tools.`
    : joined
}
