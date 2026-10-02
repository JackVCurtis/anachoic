import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { done, fillTemplate } from '../../helpers/strings'
import { formatDuration, formatFinished } from '../../helpers/time'
import { plural } from '../../helpers/words'
import { LABEL_TICK, useNow, useTimeZone } from '../../hooks/use_now/use_now'
import { InlineConfirm } from '../../patterns/inline_confirm/inline_confirm'
import { MetaLine } from '../../patterns/meta_line/meta_line'
import { Button } from '../../primitives/button/button'
import { Frame } from '../../primitives/frame/frame'
import { ArtifactLinks } from '../artifact_links/artifact_links'
import type { CardAction, SignOffTask } from '../board_data'
import styles from './sign_off_card.module.css'

export interface SignOffCardProps {
  task: SignOffTask
  onOpenTask: (taskId: string) => void
  /** Without it the card offers no "Sign off". */
  onSignOff?: (taskId: string) => void
  /** Opens the follow-up composer on this card. Without it the card offers no "Follow up". */
  onStartFollowUp?: (taskId: string) => void
  /** Archives the task once confirmed. Without it the card offers no "Archive". */
  onArchive?: (taskId: string) => void
  /** The follow-up composer open on this card, drawn in place of the actions row. */
  composer?: ReactNode
  /** The action in flight on this card, whose button is busy while the others are disabled. */
  pending?: CardAction | null
  /** Asks the host to open an artifact link. Without it the card draws no links. */
  onOpenLink?: (url: string) => void
}

/**
 * The stats line: "agent 14m · you 6m · 2 links".
 */
function signOffStats({ agentSeconds, yourSeconds, linkCount }: SignOffTask): string[] {
  return [
    fillTemplate(done.agentTime, { time: formatDuration(agentSeconds) }),
    fillTemplate(done.yourTime, { time: formatDuration(yourSeconds) }),
    fillTemplate(done.links, { 'n links': plural(linkCount, 'link') }),
  ]
}

function hasFocus(element: Element | null): boolean {
  return element instanceof HTMLElement && element !== document.body
}

/**
 * One finished task that waits for your sign-off, with when it finished, the
 * time it took and the links its done steps produced, and its actions: "Sign
 * off", "Follow up", which the composer replaces while it is open, and
 * "Archive", which asks first. The card as a whole is not clickable; its
 * title is.
 */
export function SignOffCard({
  task,
  onOpenTask,
  onSignOff,
  onStartFollowUp,
  onArchive,
  composer,
  pending = null,
  onOpenLink,
}: SignOffCardProps) {
  const now = useNow(LABEL_TICK.finished)
  const timeZone = useTimeZone()
  const followUpButton = useRef<HTMLButtonElement>(null)
  const archiveButton = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const composing = composer !== undefined && composer !== null
  const wasComposing = useRef(composing)

  const canSignOff = task.canAct.signOff && onSignOff !== undefined
  const canFollowUp = task.canAct.followUp && onStartFollowUp !== undefined
  const canArchive = task.canAct.archive && onArchive !== undefined

  /*
   * A composer that closes while it held focus, by Cancel or Escape, leaves
   * focus nowhere, so it goes back to "Follow up". A composer closed by
   * opening another keeps focus where that put it.
   */
  useLayoutEffect(() => {
    if (wasComposing.current && !composing && !hasFocus(document.activeElement)) {
      followUpButton.current?.focus()
    }
    wasComposing.current = composing
  }, [composing])

  function actions() {
    if (composing) {
      return composer
    }
    if (confirming && canArchive) {
      return (
        <InlineConfirm
          question={fillTemplate(done.archiveQuestion, { title: task.task.title })}
          confirmLabel={done.archive}
          dismissLabel={done.keepTask}
          layout="stack"
          busy={pending === 'archive'}
          onConfirm={() => onArchive?.(task.task.id)}
          onCancel={() => setConfirming(false)}
          returnFocusTo={archiveButton}
        />
      )
    }
    if (!canSignOff && !canFollowUp && !canArchive) {
      return null
    }
    return (
      <div className={styles.actions}>
        {canSignOff && (
          <Button
            variant="primary"
            size="sm"
            busy={pending === 'signOff'}
            disabled={pending !== null && pending !== 'signOff'}
            onPress={() => onSignOff?.(task.task.id)}
          >
            {done.signOff}
          </Button>
        )}
        {canFollowUp && (
          <Button
            ref={followUpButton}
            variant="secondary"
            size="sm"
            disabled={pending !== null}
            onPress={() => onStartFollowUp?.(task.task.id)}
          >
            {done.followUp}
          </Button>
        )}
        {canArchive && (
          <Button
            ref={archiveButton}
            variant="ghost"
            size="sm"
            disabled={pending !== null}
            onPress={() => setConfirming(true)}
          >
            {done.archive}
          </Button>
        )}
      </div>
    )
  }

  return (
    <Frame element="article" className={styles.card}>
      <div className={styles.head}>
        <p className={styles.meta}>
          <span className={joinClasses('text-mono-xs', styles.id)}>{task.task.displayId}</span>
          <span className={joinClasses('text-status', styles.finished)}>
            {fillTemplate(done.finished, {
              when: formatFinished(task.finishedAt, now, timeZone),
            })}
          </span>
        </p>
        <h3 className={styles.heading}>
          <button
            type="button"
            onClick={() => onOpenTask(task.task.id)}
            className={joinClasses('text-title-5', styles.title)}
          >
            {task.task.title}
          </button>
        </h3>
        <MetaLine tone="detail" facts={signOffStats(task)} />
        {task.artifacts && onOpenLink && (
          <ArtifactLinks artifacts={task.artifacts} onOpenLink={onOpenLink} />
        )}
      </div>
      {actions()}
    </Frame>
  )
}
