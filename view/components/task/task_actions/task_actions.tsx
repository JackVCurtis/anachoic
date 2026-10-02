import type { Ref } from 'react'
import { taskView } from '../../helpers/strings'
import { Button } from '../../primitives/button/button'
import styles from './task_actions.module.css'

/** An action on the task as a whole. */
export type TaskAction = 'park' | 'archive'

export interface TaskActionsProps {
  /** Draws Park. */
  canPark: boolean
  /** Draws Archive. */
  canArchive: boolean
  /** A confirmation is showing, or an action is in flight. */
  disabled: boolean
  /** Park or Archive was pressed. It opens its confirmation; nothing is done yet. */
  onRequest: (action: TaskAction) => void
  parkRef?: Ref<HTMLButtonElement>
  archiveRef?: Ref<HTMLButtonElement>
}

/**
 * Park and Archive, each drawn only where the server allows it. Neither acts
 * at once: each opens its confirmation.
 */
export function TaskActions({
  canPark,
  canArchive,
  disabled,
  onRequest,
  parkRef,
  archiveRef,
}: TaskActionsProps) {
  if (!canPark && !canArchive) {
    return null
  }

  return (
    <div className={styles.actions}>
      {canPark && (
        <Button
          ref={parkRef}
          variant="ghost"
          size="sm"
          disabled={disabled}
          onPress={() => onRequest('park')}
        >
          {taskView.park}
        </Button>
      )}
      {canArchive && (
        <Button
          ref={archiveRef}
          variant="ghost"
          size="sm"
          disabled={disabled}
          onPress={() => onRequest('archive')}
        >
          {taskView.archive}
        </Button>
      )}
    </div>
  )
}
