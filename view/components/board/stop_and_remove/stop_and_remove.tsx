import { useRef, useState } from 'react'
import { fillTemplate, sessions } from '../../helpers/strings'
import { InlineConfirm } from '../../patterns/inline_confirm/inline_confirm'
import { Button } from '../../primitives/button/button'
import type { Tone } from '../../types'
import styles from './stop_and_remove.module.css'

export interface StopAndRemoveProps {
  /** The worker holding the step. */
  workerName: string
  /** The task whose step the worker holds, such as "T-012". */
  taskDisplayId: string
  /** The removal is in flight. */
  busy?: boolean
  onConfirm: () => void
  tone?: Tone
}

/**
 * "Stop and Remove" on a card whose step a worker holds, behind a question,
 * since the step goes back to the queue and the worker leaves the board.
 */
export function StopAndRemove({
  workerName,
  taskDisplayId,
  busy = false,
  onConfirm,
  tone = 'light',
}: StopAndRemoveProps) {
  const [confirming, setConfirming] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  if (confirming) {
    return (
      <div data-raised className={styles.control}>
        <InlineConfirm
          question={fillTemplate(sessions.stopQuestion, { name: workerName, id: taskDisplayId })}
          confirmLabel={sessions.stopAndRemove}
          dismissLabel={sessions.keepWorker}
          layout="stack"
          busy={busy}
          onConfirm={onConfirm}
          onCancel={() => setConfirming(false)}
          returnFocusTo={button}
        />
      </div>
    )
  }
  return (
    <div className={styles.row}>
      {tone === 'inverse' ? (
        <Button
          ref={button}
          variant="inverse-outline"
          busy={busy}
          onPress={() => setConfirming(true)}
        >
          {sessions.stopAndRemove}
        </Button>
      ) : (
        <Button
          ref={button}
          variant="ghost"
          size="sm"
          busy={busy}
          onPress={() => setConfirming(true)}
        >
          {sessions.stopAndRemove}
        </Button>
      )}
    </div>
  )
}
