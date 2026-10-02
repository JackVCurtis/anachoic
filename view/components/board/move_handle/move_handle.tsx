// Copied from anachoic inertia/components/board/move_handle/move_handle.tsx at fd99e0d
import { queue } from '../../helpers/strings'
import { joinClasses } from '../../helpers/join_classes'
import { Button } from '../../primitives/button/button'
import styles from './move_handle.module.css'

export interface MoveHandleProps {
  /** Its card is being moved. */
  lifted: boolean
  /** A change of order is in flight. */
  disabled?: boolean
  /** The ids of the card's title and of the section's instructions. */
  describedBy: string
  onLift: () => void
  onDrop: () => void
  /** Placement only. */
  className?: string
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
  className,
}: MoveHandleProps) {
  return (
    <Button
      variant="utility"
      size="sm"
      disabled={disabled}
      aria-describedby={describedBy}
      onPress={lifted ? onDrop : onLift}
      className={joinClasses(styles.handle, lifted && styles.lifted, className)}
    >
      {lifted ? queue.drop : queue.move}
    </Button>
  )
}
