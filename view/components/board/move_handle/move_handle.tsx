// Copied from anachoic inertia/components/board/move_handle/move_handle.tsx at fd99e0d
import type { KeyboardEvent, Ref } from 'react'
import { queue } from '../../helpers/strings'
import { joinClasses } from '../../helpers/join_classes'
import { Button } from '../../primitives/button/button'
import styles from './move_handle.module.css'

/** A step of a lifted card: one place toward the front or back, or to either end. */
export type HandleMove = 'up' | 'down' | 'first' | 'last'

const MOVE_KEYS: Readonly<Record<string, HandleMove>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'first',
  End: 'last',
}

export interface MoveHandleProps {
  /** Its card is being moved. */
  lifted: boolean
  /** A change of order is in flight. */
  disabled?: boolean
  /** The ids of the card's title and of the section's instructions. */
  describedBy: string
  onLift: () => void
  onDrop: () => void
  /** An arrow, Home or End while its card is lifted. */
  onMove?: (move: HandleMove) => void
  /** Escape, or focus leaving the handle, while its card is lifted. */
  onCancel?: () => void
  /** Placement only. */
  className?: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * The keyboard's way to move a Queue card, and the sign that it can be moved.
 * Its label says what a press does, so it carries no pressed state.
 */
export function MoveHandle({
  lifted,
  disabled = false,
  describedBy,
  onLift,
  onDrop,
  onMove,
  onCancel,
  className,
  ref,
}: MoveHandleProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!lifted) {
      return
    }
    const move = MOVE_KEYS[event.key]
    if (move) {
      event.preventDefault()
      onMove?.(move)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel?.()
    }
  }

  return (
    <Button
      ref={ref}
      variant="utility"
      size="sm"
      disabled={disabled}
      aria-describedby={describedBy}
      onPress={lifted ? onDrop : onLift}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (lifted) {
          onCancel?.()
        }
      }}
      className={joinClasses(styles.handle, lifted && styles.lifted, className)}
    >
      {lifted ? queue.drop : queue.move}
    </Button>
  )
}
