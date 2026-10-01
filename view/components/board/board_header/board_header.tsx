import { joinClasses } from '../../helpers/join_classes'
import { boardHeader, fillTemplate } from '../../helpers/strings'
import { plural } from '../../helpers/words'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { BoardCounts } from '../board_data'
import styles from './board_header.module.css'

export interface BoardHeaderProps {
  counts: BoardCounts
  /** Shows the quiet "Updated" cue. */
  updated: boolean
  /** Shows the "Can't reach the board" line. */
  unreachable: boolean
}

const COUNTS: ReadonlyArray<{ key: keyof BoardCounts; label: string }> = [
  { key: 'yourTurn', label: boardHeader.yourTurn },
  { key: 'working', label: boardHeader.working },
  { key: 'queue', label: boardHeader.queue },
  { key: 'toSignOff', label: boardHeader.toSignOff },
]

/**
 * The board's counts, with a quiet cue when the board has just changed and a
 * line when it cannot be reached. Neither takes focus or is announced.
 */
export function BoardHeader({ counts, updated, unreachable }: BoardHeaderProps) {
  return (
    <div className={styles.header}>
      <ul aria-label={boardHeader.counts} className={styles.counts}>
        {COUNTS.map(({ key, label }) => (
          <li key={key} className={styles.count}>
            <span aria-hidden="true">
              <span className="text-label">{label}</span>{' '}
              <span className="text-count">{counts[key]}</span>
            </span>
            <VisuallyHidden>
              {fillTemplate(boardHeader.countHeard, {
                'label': label,
                'n tasks': plural(counts[key], 'task'),
              })}
            </VisuallyHidden>
          </li>
        ))}
      </ul>
      {(updated || unreachable) && (
        <p className={styles.status}>
          {updated && (
            <span className={joinClasses('text-note', styles.updated)}>{boardHeader.updated}</span>
          )}
          {unreachable && (
            <span className={joinClasses('text-note', styles.unreachable)}>
              {boardHeader.cantReach}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
