// Copied from anachoic inertia/components/board/queue_section/queue_section.tsx at fd99e0d
import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import { moveAnnouncement, movedOrder, type MoveMoment } from '../../helpers/queue'
import { assistive, queue } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { QueueTask } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import type { HandleMove } from '../move_handle/move_handle'
import { QueueCard } from '../queue_card/queue_card'

export interface QueueSectionProps {
  /** In queue order, front first. */
  tasks: readonly QueueTask[]
  /** A change of order is in flight. */
  busy?: boolean
  /** The task open in the task panel, so its card shows as selected. */
  selectedTaskId?: string | null
  onOpenTask: (taskId: string) => void
  /** Moves a task to a position counted from 1. Without it no card has a Move handle. */
  onReorder?: (taskId: string, position: number) => void
}

/**
 * The card being moved: its task, the place it was lifted from, counted from
 * 0, and the order shown while it is lifted.
 */
interface Lift {
  taskId: string
  from: number
  order: readonly string[]
}

/** What the live region says. A new key says the text again, even when it is unchanged. */
interface Said {
  key: number
  text: string
}

/**
 * The Queue in order, front first. It never folds, because its cards are
 * moved within it. A Queue of one has nothing to reorder, so its card has no
 * Move handle.
 *
 * One card at a time can be lifted by its Move handle. While it is lifted
 * the section shows the order the moves make; a drop in a new place raises
 * onReorder once, and every moment is said in an assertive live region.
 */
export function QueueSection({
  tasks,
  busy = false,
  selectedTaskId = null,
  onOpenTask,
  onReorder,
}: QueueSectionProps) {
  const instructionsId = useId()
  const [lift, setLift] = useState<Lift | null>(null)
  const [said, setSaid] = useState<Said | null>(null)
  /*
   * True from a move until the list has been redrawn. Moving the focused
   * handle's node in the list can blur it, and that blur is not a cancel.
   */
  const moving = useRef(false)

  const reorderable = onReorder !== undefined && tasks.length > 1
  const anyMovable = reorderable && tasks.some((task) => task.canAct.reorder)

  const byId = new Map(tasks.map((task) => [task.task.id, task]))
  const shown = lift
    ? lift.order.flatMap((id) => {
        const task = byId.get(id)
        return task ? [task] : []
      })
    : tasks

  useLayoutEffect(() => {
    moving.current = false
  })

  function announce(moment: MoveMoment, taskId: string, position: number) {
    const title = byId.get(taskId)?.task.title ?? ''
    setSaid((last) => ({
      key: (last?.key ?? 0) + 1,
      text: moveAnnouncement(moment, title, position, tasks.length),
    }))
  }

  function handleLift(taskId: string) {
    if (busy || lift || !reorderable) {
      return
    }
    const order = tasks.map((task) => task.task.id)
    const from = order.indexOf(taskId)
    setLift({ taskId, from, order })
    announce('lifted', taskId, from + 1)
  }

  function handleMove(taskId: string, move: HandleMove) {
    if (!lift || lift.taskId !== taskId) {
      return
    }
    const order = movedOrder(lift.order, taskId, move)
    const to = order.indexOf(taskId)
    if (to === lift.order.indexOf(taskId)) {
      return
    }
    moving.current = true
    setLift({ ...lift, order })
    announce('moved', taskId, to + 1)
  }

  function handleDrop(taskId: string) {
    if (!lift || lift.taskId !== taskId) {
      return
    }
    const to = lift.order.indexOf(taskId)
    setLift(null)
    announce('dropped', taskId, to + 1)
    if (to !== lift.from) {
      onReorder?.(taskId, to + 1)
    }
  }

  function handleCancel(taskId: string) {
    if (!lift || lift.taskId !== taskId || moving.current) {
      return
    }
    setLift(null)
    announce('cancelled', taskId, lift.from + 1)
  }

  const cancelLift = useEffectEvent(() => {
    if (lift) {
      handleCancel(lift.taskId)
    }
  })

  /* A change of order that starts elsewhere disables every handle, so a lifted card is put back. */
  useEffect(() => {
    if (busy) {
      cancelLift()
    }
  }, [busy])

  return (
    <BoardSection
      title={queue.title}
      count={tasks.length}
      folds={false}
      listElement="ol"
      cardGap="loose"
      cards={shown.map((task, index) => ({
        id: task.task.id,
        card: (
          <QueueCard
            task={lift ? { ...task, position: index + 1 } : task}
            selected={task.task.id === selectedTaskId}
            lifted={task.task.id === lift?.taskId}
            movable={reorderable && task.canAct.reorder}
            busy={busy}
            instructionsId={instructionsId}
            onOpenTask={onOpenTask}
            onLift={handleLift}
            onDrop={handleDrop}
            onMove={handleMove}
            onCancelMove={handleCancel}
          />
        ),
      }))}
      footer={
        onReorder !== undefined && (
          <>
            {anyMovable && (
              <VisuallyHidden id={instructionsId}>{assistive.moveDescription}</VisuallyHidden>
            )}
            <VisuallyHidden aria-live="assertive" aria-atomic="true">
              {said && <span key={said.key}>{said.text}</span>}
            </VisuallyHidden>
          </>
        )
      }
    />
  )
}
