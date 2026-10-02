// Copied from anachoic inertia/components/board/agents_section/agents_section.tsx at fd99e0d
import { sessions as strings } from '../../helpers/strings'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import type { BoardSession } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import { SessionCard } from '../session_card/session_card'
import styles from './sessions_section.module.css'

export interface SessionsSectionProps {
  /** The live sessions and those that ended in the last 10 minutes, in the server's order. */
  sessions: readonly BoardSession[]
  onOpenTask: (taskId: string) => void
}

/**
 * Each live session in the server's order, counted in the header, then the
 * sessions that ended recently with what they released.
 */
export function SessionsSection({ sessions, onOpenTask }: SessionsSectionProps) {
  const live = sessions.filter((session) => session.live)
  const ended = sessions.filter((session) => !session.live)

  return (
    <BoardSection
      title={strings.title}
      count={live.length}
      empty={<EmptyState variant="dashed" message={strings.nothingLive} />}
      cards={live.map((session) => ({
        id: session.id,
        card: <SessionCard session={session} onOpenTask={onOpenTask} />,
      }))}
      footer={
        ended.length > 0 && (
          <ul className={styles.ended}>
            {ended.map((session) => (
              <li key={session.id}>
                <SessionCard session={session} onOpenTask={onOpenTask} />
              </li>
            ))}
          </ul>
        )
      }
    />
  )
}
