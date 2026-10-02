// Copied from anachoic inertia/components/sign_off/sign_off_view/sign_off_view.tsx at fd99e0d
import { useState } from 'react'
import {
  emptyFollowUpDraft,
  submittedFollowUp,
  type FollowUpDraft,
  type FollowUpInput,
} from '../../helpers/follow_up'
import { joinClasses } from '../../helpers/join_classes'
import { done, fillTemplate } from '../../helpers/strings'
import { formatFinished } from '../../helpers/time'
import { plural } from '../../helpers/words'
import { LABEL_TICK, useNow, useTimeZone } from '../../hooks/use_now/use_now'
import { Disclosure } from '../../patterns/disclosure/disclosure'
import { EmptyState } from '../../patterns/empty_state/empty_state'
import { Button } from '../../primitives/button/button'
import type { PendingCardAction, SignedOffTask, SignOffTask } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import { FollowUpComposer } from '../follow_up_composer/follow_up_composer'
import { SignOffCard } from '../sign_off_card/sign_off_card'
import styles from './done_section.module.css'

/**
 * The most signed-off tasks the board lists.
 */
const SIGNED_OFF_SHOWN = 10

export interface DoneSectionProps {
  /** The finished tasks that wait for your sign-off, in the server's order. */
  toSignOff: readonly SignOffTask[]
  /** The most recently signed off first. */
  signedOff: readonly SignedOffTask[]
  onOpenTask: (taskId: string) => void
  /** Without it no card offers "Sign off". */
  onSignOff?: (taskId: string) => void
  /** Appends the follow-up written on a card. Without it no card offers "Follow up". */
  onFollowUp?: (taskId: string, followUp: FollowUpInput) => void
  /** Archives a task once confirmed. Without it no card offers "Archive". */
  onArchive?: (taskId: string) => void
  /** The card action in flight, if any. */
  pending?: PendingCardAction | null
  /** Asks the host to open an artifact link. Without it no card draws its links. */
  onOpenLink?: (url: string) => void
  /** "Show all completed tasks" was pressed. Without it the section offers no link to the history. */
  onShowHistory?: () => void
}

/** The one follow-up being written, and the card it is written on. */
interface Composing {
  taskId: string
  draft: FollowUpDraft
}

/**
 * The tasks to sign off, counted in the header, then the most recently
 * signed-off tasks folded under a Disclosure that starts closed.
 *
 * At most one follow-up composer is open in the section, which holds its
 * draft. Opening one on another card closes the first, and the draft goes
 * when its task leaves the section or is signed off.
 */
export function DoneSection({
  toSignOff,
  signedOff,
  onOpenTask,
  onSignOff,
  onFollowUp,
  onArchive,
  pending = null,
  onOpenLink,
  onShowHistory,
}: DoneSectionProps) {
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState<Composing | null>(null)
  const recent = signedOff.slice(0, SIGNED_OFF_SHOWN)

  /* Adjusting state while rendering, as React suggests for state that follows props. */
  if (composing && !toSignOff.some((task) => task.task.id === composing.taskId)) {
    setComposing(null)
  }

  function signOff(taskId: string) {
    if (composing?.taskId === taskId) {
      setComposing(null)
    }
    onSignOff?.(taskId)
  }

  function composerFor(task: SignOffTask) {
    if (composing?.taskId !== task.task.id) {
      return null
    }
    const { draft } = composing
    return (
      <FollowUpComposer
        draft={draft}
        chainLength={task.steps.length}
        busy={pending?.taskId === task.task.id && pending.action === 'followUp'}
        onDraftChange={(next) => setComposing({ taskId: task.task.id, draft: next })}
        onAppend={() => onFollowUp?.(task.task.id, submittedFollowUp(draft))}
        onCancel={() => setComposing(null)}
      />
    )
  }

  return (
    <BoardSection
      title={done.title}
      count={toSignOff.length}
      empty={<EmptyState variant="framed" message={done.nothingToSignOff} />}
      cards={toSignOff.map((task) => ({
        id: task.task.id,
        card: (
          <SignOffCard
            task={task}
            onOpenTask={onOpenTask}
            onSignOff={onSignOff && signOff}
            onStartFollowUp={
              onFollowUp && ((taskId) => setComposing({ taskId, draft: emptyFollowUpDraft() }))
            }
            onArchive={onArchive}
            composer={composerFor(task)}
            pending={pending?.taskId === task.task.id ? pending.action : null}
            onOpenLink={onOpenLink}
          />
        ),
      }))}
      footer={
        recent.length > 0 && (
          <>
            <Disclosure
              open={open}
              onToggle={() => setOpen(!open)}
              toggle={fillTemplate(done.signedOffCount, {
                'n tasks': plural(recent.length, 'task'),
              })}
              toggleVariant="utility"
              toggleSize="sm"
              toggleClassName={styles.toggle}
            >
              <ul className={styles.signedOff}>
                {recent.map((task) => (
                  <li key={task.task.id}>
                    <SignedOffRow task={task} onOpenTask={onOpenTask} />
                  </li>
                ))}
              </ul>
            </Disclosure>
            {onShowHistory && (
              <Button variant="utility" size="sm" onPress={onShowHistory} className={styles.toggle}>
                {done.showHistory}
              </Button>
            )}
          </>
        )
      }
    />
  )
}

function SignedOffRow({
  task,
  onOpenTask,
}: {
  task: SignedOffTask
  onOpenTask: (taskId: string) => void
}) {
  const now = useNow(LABEL_TICK.finished)
  const timeZone = useTimeZone()

  return (
    <div className={styles.row}>
      <span className={joinClasses('text-mono-xs', styles.id)}>{task.task.displayId}</span>
      <button
        type="button"
        onClick={() => onOpenTask(task.task.id)}
        className={joinClasses('text-body-sm', styles.title)}
      >
        {task.task.title}
      </button>
      <span className={joinClasses('text-status', styles.when)}>
        {formatFinished(task.signedOffAt, now, timeZone)}
      </span>
    </div>
  )
}
