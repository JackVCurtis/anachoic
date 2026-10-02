// Copied from anachoic inertia/components/board/agent_slot_card/agent_slot_card.tsx at fd99e0d
import { joinClasses } from '../../helpers/join_classes'
import { fillTemplate, sessions, times } from '../../helpers/strings'
import { formatWaited } from '../../helpers/time'
import { LABEL_TICK, useNow } from '../../hooks/use_now/use_now'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Frame } from '../../primitives/frame/frame'
import { StatusSquare, type StatusSquareState } from '../../primitives/status_square/status_square'
import { Tag } from '../../primitives/tag/tag'
import type { BoardSession } from '../board_data'
import styles from './session_card.module.css'

export interface SessionCardProps {
  session: BoardSession
  /** Raised by the main action of a card that holds a step. */
  onOpenTask: (taskId: string) => void
}

/**
 * One session: the step it holds, running or waiting on you, or nothing.
 * A session that has ended shows what it released.
 */
export function SessionCard({ session, onOpenTask }: SessionCardProps) {
  if (!session.live) {
    return <EndedCard session={session} />
  }
  if (!session.holding) {
    return (
      <Frame className={styles.card}>
        <Header state="idle" session={session} label={sessions.idle} />
      </Frame>
    )
  }
  return <HoldingCard session={session} holding={session.holding} onOpenTask={onOpenTask} />
}

type Holding = NonNullable<BoardSession['holding']>

interface HoldingCardProps {
  session: BoardSession
  holding: Holding
  onOpenTask: (taskId: string) => void
}

function HoldingCard({ session, holding, onOpenTask }: HoldingCardProps) {
  const running = holding.status === 'running'

  return (
    <ActionCard
      title={holding.task.title}
      onAction={() => onOpenTask(holding.task.id)}
      leading={
        <Header
          state={running ? 'running' : 'waiting'}
          session={session}
          label={running ? sessions.running : sessions.waitingOnYou}
        />
      }
      className={styles.card}
      titleClassName={joinClasses('text-title-3', styles.title)}
    >
      <p className={styles.stepLine}>
        {fillTemplate(sessions.holdingStep, {
          'n': holding.step.number,
          'step title': holding.step.title,
        })}
      </p>
    </ActionCard>
  )
}

/**
 * "Ended 4m ago", or "Ended just now" in its first minute.
 */
function endedLabel(endedAt: string, now: string): string {
  const waited = formatWaited(endedAt, now)
  return fillTemplate(sessions.ended, {
    when: waited === times.justNow ? waited : fillTemplate(times.ago, { time: waited }),
  })
}

function EndedCard({ session }: { session: BoardSession }) {
  const now = useNow(LABEL_TICK.waited)
  const released = session.released ?? []

  return (
    <Frame className={styles.card}>
      <Header
        state="idle"
        session={session}
        label={session.endedAt ? endedLabel(session.endedAt, now) : ''}
      />
      {released.length > 0 && (
        <div className={styles.released}>
          <span className={joinClasses('text-label', styles.releasedLabel)}>
            {sessions.released}
          </span>
          <ul className={styles.releasedList}>
            {released.map((task) => (
              <li key={task.id} className={styles.releasedTask}>
                <span className={joinClasses('text-mono-xs', styles.id)}>{task.displayId}</span>
                <span className="text-body-sm">{task.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Frame>
  )
}

interface HeaderProps {
  state: StatusSquareState
  session: BoardSession
  label: string
}

function Header({ state, session, label }: HeaderProps) {
  return (
    <div className={styles.header}>
      <StatusSquare state={state} />
      <span className={joinClasses('text-name', styles.name)}>{session.name}</span>
      {session.kind === 'worker' && <Tag variant="neutral">{sessions.kindWorker}</Tag>}
      {label !== '' && <span className={joinClasses('text-status', styles.state)}>{label}</span>}
    </div>
  )
}
