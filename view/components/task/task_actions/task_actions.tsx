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
  /** "Clone task" was pressed. Without it there is no Clone task. */
  onClone?: () => void
  /** A confirmation is showing, or an action is in flight. */
  disabled: boolean
  /** Park or Archive was pressed. It opens its confirmation; nothing is done yet. */
  onRequest: (action: TaskAction) => void
  parkRef?: Ref<HTMLButtonElement>
  archiveRef?: Ref<HTMLButtonElement>
}

/**
 * Clone task, then Park and Archive, each drawn only where the server allows
 * it. Clone task acts at once; Park and Archive each open their confirmation.
 */
export function TaskActions({
  canPark,
  canArchive,
  onClone,
  disabled,
  onRequest,
  parkRef,
  archiveRef,
}: TaskActionsProps) {
  if (!canPark && !canArchive && !onClone) {
    return null
  }

  return (
    <div className={styles.actions}>
      {onClone && (
        <Button variant="ghost" size="sm" disabled={disabled} onPress={onClone}>
          {taskView.clone}
        </Button>
      )}
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
