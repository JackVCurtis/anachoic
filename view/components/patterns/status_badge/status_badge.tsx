// Copied from anachoic inertia/components/patterns/status_badge/status_badge.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import { badgeFor, type TaskList } from '../../helpers/task_view'
import { Tag } from '../../primitives/tag/tag'
import styles from './status_badge.module.css'

export interface StatusBadgeProps {
  /** The list the task belongs to. */
  list: TaskList
  /** Placement only. */
  className?: string
}

/**
 * States which list a task is in, in the task view's header. A task whose
 * agent step waits on you is in Your turn and reads "your turn".
 */
export function StatusBadge({ list, className }: StatusBadgeProps) {
  const { label, look } = badgeFor(list)
  return (
    <Tag variant={look} className={joinClasses(styles.badge, className)}>
      {label}
    </Tag>
  )
}
