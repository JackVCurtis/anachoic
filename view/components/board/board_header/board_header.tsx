import { joinClasses } from '../../helpers/join_classes'
import { boardHeader, fillTemplate, times } from '../../helpers/strings'
import { formatWaited } from '../../helpers/time'
import { plural } from '../../helpers/words'
import { useNow } from '../../hooks/use_now/use_now'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { BoardCounts } from '../board_data'
import styles from './board_header.module.css'

export interface BoardHeaderProps {
  counts: BoardCounts
  /** The instant a poll last brought a newer board, shown as the quiet "Updated" cue. */
  updatedAt: string | null
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
export function BoardHeader({ counts, updatedAt, unreachable }: BoardHeaderProps) {
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
      {(updatedAt !== null || unreachable) && (
        <p className={styles.status}>
          {updatedAt !== null && <UpdatedCue updatedAt={updatedAt} />}
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

/**
 * "Updated just now", then "Updated 3m ago", renewed each minute.
 */
function UpdatedCue({ updatedAt }: { updatedAt: string }) {
  const now = useNow('minute')
  const waited = formatWaited(updatedAt, now)
  const time = waited === times.justNow ? waited : fillTemplate(times.ago, { time: waited })
  return (
    <span className={joinClasses('text-note', styles.updated)}>
      {fillTemplate(boardHeader.updatedAt, { time })}
    </span>
  )
}
