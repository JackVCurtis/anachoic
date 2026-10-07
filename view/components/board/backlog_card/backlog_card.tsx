// Copied from anachoic inertia/components/board/backlog_card/backlog_card.tsx at fd99e0d
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { joinClasses } from '../../helpers/join_classes'
import { chainNote } from '../../helpers/steps'
import { backlog, done, fillTemplate, taskEntry } from '../../helpers/strings'
import type { TaskEntryWorker } from '../../helpers/task_entry'
import { splitFacts } from '../../helpers/words'
import { InlineConfirm } from '../../patterns/inline_confirm/inline_confirm'
import { MetaLine } from '../../patterns/meta_line/meta_line'
import { SectionHeader } from '../../patterns/section_header/section_header'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Button } from '../../primitives/button/button'
import { Frame } from '../../primitives/frame/frame'
import { Select } from '../../primitives/select/select'
import { ArtifactLinks } from '../artifact_links/artifact_links'
import { assignmentFact } from '../assignment'
import type { BacklogTask, CardAction } from '../board_data'
import styles from './backlog_card.module.css'

const QUEUE_ARROW = '→'

export interface BacklogCardProps {
  task: BacklogTask
  /** Its task is open in the task panel. */
  selected?: boolean
  onOpenTask: (taskId: string) => void
  /**
   * Sends the task to the Queue, assigned to the worker chosen, or to any
   * worker for null. Without it the card offers no "Queue →".
   */
  onQueueTask?: (taskId: string, assignTo: string | null) => void
  /**
   * The live workers. With any, "Queue →" first asks which one the task goes
   * to; with none, it queues the task for any worker at once.
   */
  workers?: readonly TaskEntryWorker[]
  /** Archives the task once confirmed. Without it the card offers no "Archive". */
  onArchive?: (taskId: string) => void
  /** The action in flight on this card, whose button is busy while the others are disabled. */
  pending?: CardAction | null
  /** Asks the host to open an artifact link. Without it the card draws no links. */
  onOpenLink?: (url: string) => void
}

const NO_WORKERS: readonly TaskEntryWorker[] = []

/**
 * One task not yet lined up, with the button that sends it to the Queue when
 * the server says it can go, which first asks for the worker while any is
 * live, and "Archive", which asks first. It has no pips and no Move handle:
 * the Backlog is not reordered.
 */
export function BacklogCard({
  task,
  selected = false,
  onOpenTask,
  onQueueTask,
  onArchive,
  workers = NO_WORKERS,
  pending = null,
  onOpenLink,
}: BacklogCardProps) {
  const titleId = useId()
  const archiveButton = useRef<HTMLButtonElement>(null)
  const queueButton = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const archivable = task.canAct.archive && onArchive !== undefined
  const queueable = task.canAct.queue && onQueueTask !== undefined
  const picking = choosing && queueable && workers.length > 0
  /** Set when the worker choice is cancelled, so focus goes back to "Queue →" once it shows again. */
  const refocusQueue = useRef(false)

  useLayoutEffect(() => {
    if (!choosing && refocusQueue.current) {
      refocusQueue.current = false
      queueButton.current?.focus()
    }
  }, [choosing])
  const yourSteps = task.steps.filter((step) => step.owner === 'you').length
  const facts = [
    task.task.displayId,
    ...splitFacts(chainNote(task.steps.length, yourSteps)),
    assignmentFact(task.task),
  ]

  return (
    <ActionCard
      element="div"
      title={task.task.title}
      titleId={titleId}
      selected={selected}
      onAction={() => onOpenTask(task.task.id)}
      className={styles.card}
      titleClassName={joinClasses('text-title-1', styles.title)}
    >
      <div className={styles.row}>
        <MetaLine tone="meta" facts={facts} className={styles.meta} />
        {!(confirming && archivable) && !picking && (
          <div className={styles.buttons}>
            {archivable && (
              <Button
                ref={archiveButton}
                variant="ghost"
                size="sm"
                aria-describedby={titleId}
                disabled={pending !== null}
                onPress={() => setConfirming(true)}
              >
                {done.archive}
              </Button>
            )}
            {queueable && (
              <Button
                ref={queueButton}
                variant="secondary"
                size="sm"
                aria-describedby={titleId}
                busy={pending === 'queue'}
                disabled={pending !== null && pending !== 'queue'}
                onPress={() =>
                  workers.length > 0 ? setChoosing(true) : onQueueTask(task.task.id, null)
                }
              >
                {backlog.toQueue.replace(QUEUE_ARROW, '').trim()}
                <span aria-hidden="true">{QUEUE_ARROW}</span>
              </Button>
            )}
          </div>
        )}
      </div>
      {task.artifacts && onOpenLink && (
        <ArtifactLinks artifacts={task.artifacts} onOpenLink={onOpenLink} />
      )}
      {picking && (
        <div data-raised>
          <WorkerPicker
            workers={workers}
            initial={task.task.assignedTo?.id ?? null}
            busy={pending === 'queue'}
            onQueue={(assignTo) => onQueueTask(task.task.id, assignTo)}
            onCancel={() => {
              refocusQueue.current = true
              setChoosing(false)
            }}
          />
        </div>
      )}
      {confirming && archivable && (
        <div data-raised>
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
        </div>
      )}
    </ActionCard>
  )
}

interface WorkerPickerProps {
  workers: readonly TaskEntryWorker[]
  /** The worker the task was assigned to, chosen at first when it is still live. */
  initial: string | null
  busy: boolean
  onQueue: (assignTo: string | null) => void
  /** "Cancel" or Escape. */
  onCancel: () => void
}

/** The value of "Any worker", which no session id can take. */
const ANY_WORKER = ''

/**
 * The worker a backlog task goes to the Queue for: "Any worker" first, then
 * each live worker by name. The select takes focus when it appears.
 */
function WorkerPicker({ workers, initial, busy, onQueue, onCancel }: WorkerPickerProps) {
  const labelId = useId()
  const select = useRef<HTMLSelectElement>(null)
  const [assignTo, setAssignTo] = useState(() =>
    workers.some((worker) => worker.id === initial) ? initial : null
  )
  const options = [
    { value: ANY_WORKER, label: taskEntry.anyWorker },
    ...workers.map((worker) => ({ value: worker.id, label: worker.name })),
  ]

  useEffect(() => {
    select.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy) {
      onQueue(assignTo)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <Frame fill="tint" emphasis="selected" className={styles.picker}>
      <form
        aria-labelledby={labelId}
        noValidate
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className={styles.pickerForm}
      >
        <SectionHeader level="label" accent titleId={labelId} title={taskEntry.workerLabel} />
        <Select
          ref={select}
          labelledBy={labelId}
          options={options}
          value={assignTo ?? ANY_WORKER}
          disabled={busy}
          onChange={(value) => setAssignTo(value === ANY_WORKER ? null : value)}
        />
        <div className={styles.pickerButtons}>
          <Button type="submit" variant="primary" size="sm" busy={busy}>
            {backlog.toQueue.replace(QUEUE_ARROW, '').trim()}
            <span aria-hidden="true">{QUEUE_ARROW}</span>
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onPress={onCancel}>
            {backlog.cancel}
          </Button>
        </div>
      </form>
    </Frame>
  )
}
