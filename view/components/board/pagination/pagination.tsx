// Copied from anachoic inertia/components/completed/pagination/pagination.tsx at fd99e0d
import { useState } from 'react'
import { pageLabel } from '../../helpers/history'
import { assistive, history } from '../../helpers/strings'
import { joinClasses } from '../../helpers/join_classes'
import { Button } from '../../primitives/button/button'
import styles from './pagination.module.css'

type Direction = 'previous' | 'next'

const PREVIOUS_ARROW = '←'
const NEXT_ARROW = '→'

/**
 * A button label without its arrow and the space beside it.
 */
function withoutArrow(label: string, arrow: string): string {
  return label.replace(arrow, '').trim()
}

export interface PaginationProps {
  /** The page being shown. From 1. */
  page: number
  /** At least 1. */
  pageCount: number
  /** Another page is being fetched. */
  busy: boolean
  /** The page asked for: one less or one more than the page being shown. */
  onPageChange: (page: number) => void
  /** Placement only. */
  className?: string
}

/**
 * Moves between the pages of the History table, one page at a time. It is
 * not drawn when there is one page.
 */
export function Pagination({ page, pageCount, busy, onPageChange, className }: PaginationProps) {
  const [pressed, setPressed] = useState<Direction | null>(null)
  const [wasBusy, setWasBusy] = useState(busy)

  // The pressed button is remembered for one fetch. When busy ends, it is
  // forgotten, so the next fetch starts with no button pressed.
  if (busy !== wasBusy) {
    setWasBusy(busy)
    if (!busy) {
      setPressed(null)
    }
  }

  if (pageCount <= 1) {
    return null
  }

  const pending = busy ? pressed : null

  function press(direction: Direction) {
    setPressed(direction)
    onPageChange(direction === 'previous' ? page - 1 : page + 1)
  }

  return (
    <nav aria-label={assistive.landmarkPages} className={joinClasses(styles.row, className)}>
      <p role="status" className={joinClasses('text-status', styles.label)}>
        {pageLabel(page, pageCount)}
      </p>
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1 || (busy && pending !== 'previous')}
          busy={pending === 'previous'}
          onPress={() => press('previous')}
        >
          <span aria-hidden="true">{PREVIOUS_ARROW}</span>
          {withoutArrow(history.previous, PREVIOUS_ARROW)}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pageCount || (busy && pending !== 'next')}
          busy={pending === 'next'}
          onPress={() => press('next')}
        >
          {withoutArrow(history.next, NEXT_ARROW)}
          <span aria-hidden="true">{NEXT_ARROW}</span>
        </Button>
      </div>
    </nav>
  )
}
