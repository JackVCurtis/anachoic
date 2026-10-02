import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardSource } from '../../bridge/board_source'
import type { ToolOutcome } from '../../bridge/tools'
import type { FlashMessageData } from '../../components/patterns/flash_message/flash_message'
import type { FlashKind } from '../../components/helpers/messages'
import { boardHeader } from '../../components/helpers/strings'

/** A write that did not go through: the server refused it, or could not be reached. */
export type FailedWrite = Extract<ToolOutcome<unknown>, { ok: false }>

export interface BoardMessages {
  messages: readonly FlashMessageData[]
  dismiss: (id: string) => void
  /** The one handler every failed write reports to. */
  reportFailure: (failure: FailedWrite) => void
}

/**
 * The messages the board shows in its message region: none, or one of each
 * kind, each with an id minted when it arrives. They live in the view only
 * and are lost when the host rebuilds it.
 *
 * A refused write shows its sentence as given, and one that never reached the
 * server shows "Can't reach the board". A refusal get_board gives while
 * polling is shown once for each new sentence.
 */
export function useBoardMessages(source: Pick<BoardSource, 'subscribe' | 'getSnapshot'>) {
  const [messages, setMessages] = useState<readonly FlashMessageData[]>([])
  const minted = useRef(0)

  /** A new message takes the place of the one of its kind, even with the same words. */
  const show = useCallback((kind: FlashKind, text: string) => {
    minted.current += 1
    const message = { id: `message-${minted.current}`, kind, text }
    setMessages((shown) => [...shown.filter((each) => each.kind !== kind), message])
  }, [])

  useEffect(() => {
    let seen = source.getSnapshot().refusal
    return source.subscribe(() => {
      const { refusal } = source.getSnapshot()
      if (refusal !== seen) {
        seen = refusal
        if (refusal !== null) {
          show('error', refusal)
        }
      }
    })
  }, [source, show])

  return {
    messages,
    dismiss: (id) => setMessages((shown) => shown.filter((each) => each.id !== id)),
    reportFailure: (failure) =>
      show('error', 'refusal' in failure ? failure.refusal : boardHeader.cantReach),
  } satisfies BoardMessages
}
