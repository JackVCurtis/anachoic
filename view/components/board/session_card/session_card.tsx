// Copied from anachoic inertia/components/board/agent_slot_card/agent_slot_card.tsx at fd99e0d
import { useRef, useState, type ReactNode } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { fillTemplate, sessions, times } from '../../helpers/strings'
import { formatWaited } from '../../helpers/time'
import { LABEL_TICK, useNow } from '../../hooks/use_now/use_now'
import { InlineConfirm } from '../../patterns/inline_confirm/inline_confirm'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Button } from '../../primitives/button/button'
import { Frame } from '../../primitives/frame/frame'
import { StatusSquare, type StatusSquareState } from '../../primitives/status_square/status_square'
import { Tag } from '../../primitives/tag/tag'
import type { BoardSession } from '../board_data'
import styles from './session_card.module.css'
import { SymbolText } from '../../primitives/symbol_text/symbol_text'

export interface SessionCardProps {
  session: BoardSession
  /** Raised by the main action of a card that holds a step. */
  onOpenTask: (taskId: string) => void
  /** Removes the worker from the board. Without it no card offers "Remove". */
  onRemove?: (sessionId: string) => void
  /** The removal of this session is in flight. */
  removing?: boolean
}

/**
 * One session: the step it holds, running, waiting on you or blocked, or nothing.
 * A session that has ended shows what it released. A worker's card, live or
 * ended, offers "Remove", which asks first while the worker holds a step.
 */
export function SessionCard({ session, onOpenTask, onRemove, removing = false }: SessionCardProps) {
  const remove =
    session.kind === 'worker' && onRemove ? (
      <RemoveControl session={session} removing={removing} onRemove={onRemove} />
    ) : null

  if (!session.live) {
    return <EndedCard session={session} remove={remove} />
  }
  if (!session.holding) {
    return (
      <Frame className={styles.card}>
        <Header state="idle" session={session} label={sessions.idle} />
        {remove}
      </Frame>
    )
  }
  return (
    <HoldingCard
      session={session}
      holding={session.holding}
      onOpenTask={onOpenTask}
      remove={remove}
    />
  )
}

interface RemoveControlProps {
  session: BoardSession
  removing: boolean
  onRemove: (sessionId: string) => void
}

/**
 * "Remove", or in its place the question it asks when the worker holds a
 * step, since that step goes back to the queue.
 */
function RemoveControl({ session, removing, onRemove }: RemoveControlProps) {
  const [confirming, setConfirming] = useState(false)
  const removeButton = useRef<HTMLButtonElement>(null)
  const holding = session.live ? session.holding : null

  if (confirming && holding) {
    return (
      <div data-raised className={styles.remove}>
        <InlineConfirm
          question={fillTemplate(sessions.removeQuestion, {
            name: session.name,
            id: holding.task.displayId,
          })}
          confirmLabel={sessions.remove}
          dismissLabel={sessions.keepWorker}
          layout="stack"
          busy={removing}
          onConfirm={() => onRemove(session.id)}
          onCancel={() => setConfirming(false)}
          returnFocusTo={removeButton}
        />
      </div>
    )
  }
  return (
    <div className={joinClasses(styles.remove, styles.removeRow)}>
      <Button
        ref={removeButton}
        variant="ghost"
        size="sm"
        busy={removing}
        onPress={() => (holding ? setConfirming(true) : onRemove(session.id))}
      >
        {sessions.remove}
      </Button>
    </div>
  )
}

type Holding = NonNullable<BoardSession['holding']>

interface HoldingCardProps {
  session: BoardSession
  holding: Holding
  onOpenTask: (taskId: string) => void
  remove: ReactNode
}

/**
 * The square and the words for the state of the step a session holds.
 */
function holdingState(holding: Holding): { state: StatusSquareState; label: string } {
  switch (holding.status) {
    case 'running':
      return { state: 'running', label: sessions.running }
    case 'waiting':
      return { state: 'waiting', label: sessions.waitingOnYou }
    case 'blocked':
      return {
        state: 'attention',
        label: fillTemplate(sessions.blockedOn, {
          id: holding.task.displayId,
          n: holding.step.number,
        }),
      }
  }
}

function HoldingCard({ session, holding, onOpenTask, remove }: HoldingCardProps) {
  const { state, label } = holdingState(holding)

  return (
    <ActionCard
      title={holding.task.title}
      onAction={() => onOpenTask(holding.task.id)}
      leading={<Header state={state} session={session} label={label} />}
      className={styles.card}
      titleClassName={joinClasses('text-title-3', styles.title)}
    >
      <p className={styles.stepLine}>
        <SymbolText>
          {fillTemplate(sessions.holdingStep, {
            'n': holding.step.number,
            'step title': holding.step.title,
          })}
        </SymbolText>
      </p>
      {remove}
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

function EndedCard({ session, remove }: { session: BoardSession; remove: ReactNode }) {
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
      {remove}
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
