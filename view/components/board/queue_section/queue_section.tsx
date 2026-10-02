// Copied from anachoic inertia/components/board/queue_section/queue_section.tsx at fd99e0d
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { DRAG_START_PX } from '../../helpers/constants'
import { moveAnnouncement, movedOrder, type MoveMoment, type QueueMove } from '../../helpers/queue'
import { assistive, queue } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import type { QueueTask } from '../board_data'
import { BoardSection } from '../board_section/board_section'
import { QueueCard } from '../queue_card/queue_card'
import styles from './queue_section.module.css'

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
 * The card being moved: its task and title, the order the moves have made,
 * and whether a pointer is dragging it.
 */
interface Lift {
  taskId: string
  title: string
  order: readonly string[]
  byPointer: boolean
}

/**
 * The order made by a drop, shown until the tasks given change or the busy
 * flag has been true and is false again.
 */
interface Held {
  order: readonly string[]
  tasks: readonly QueueTask[]
  sawBusy: boolean
}

/** A press on a card that may become a drag. */
interface Press {
  taskId: string
  pointerId: number
  x: number
  y: number
  list: HTMLElement
  dragging: boolean
  /** The drag was cancelled before its release. */
  ended: boolean
}

/** What the live region says. A new key says the text again, even when it is unchanged. */
interface Said {
  key: number
  text: string
}

/**
 * The order of the tasks given, with the lifted task kept where it was among
 * the tasks that remain: just after the last of those that stood before it.
 * Tasks that arrived take the places the server gave them.
 */
function keepLiftedPlace(made: readonly string[], liftedId: string, given: readonly string[]) {
  const present = new Set(given)
  const before = made.slice(0, made.indexOf(liftedId)).filter((id) => present.has(id))
  const rest = given.filter((id) => id !== liftedId)
  const anchor = before.length === 0 ? -1 : rest.indexOf(before[before.length - 1])
  return [...rest.slice(0, anchor + 1), liftedId, ...rest.slice(anchor + 1)]
}

/**
 * The place, from 0, that a dragged card takes for the pointer at `y`: one
 * place up for each card above whose middle the pointer has passed, one down
 * for each card below. The cards are measured where they are drawn now.
 */
function placeForPointer(items: readonly Element[], from: number, y: number) {
  const middle = (index: number) => {
    const box = items[index].getBoundingClientRect()
    return box.top + box.height / 2
  }
  let to = from
  while (to > 0 && y < middle(to - 1)) {
    to -= 1
  }
  if (to === from) {
    while (to < items.length - 1 && y > middle(to + 1)) {
      to += 1
    }
  }
  return to
}

/**
 * The Queue in order, front first. It never folds, because its cards are
 * moved within it. A Queue of one has nothing to reorder, so its card has no
 * Move handle.
 *
 * One card at a time can be lifted, by its Move handle or by dragging it
 * with a pointer. While it is lifted the section shows the order the moves
 * make; a drop in a new place raises onReorder once, and the order made is
 * held until the tasks given change or the request ends.
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
  const [held, setHeld] = useState<Held | null>(null)
  const [said, setSaid] = useState<Said | null>(null)
  /*
   * True from a move until the list has been redrawn. Moving the focused
   * handle's node in the list can blur it, and that blur is not a cancel.
   */
  const moving = useRef(false)
  const press = useRef<Press | null>(null)

  const reorderable = onReorder !== undefined && tasks.length > 1
  const anyMovable = reorderable && tasks.some((task) => task.canAct.reorder)
  const byId = new Map(tasks.map((task) => [task.task.id, task]))
  const givenIds = tasks.map((task) => task.task.id)

  function say(text: string) {
    setSaid((last) => ({ key: (last?.key ?? 0) + 1, text }))
  }

  function announce(moment: MoveMoment, title: string, position: number) {
    say(moveAnnouncement(moment, title, position, tasks.length))
  }

  /* Adjusting state while rendering, as React suggests for state that follows props. */
  if (lift && !byId.has(lift.taskId)) {
    setLift(null)
    announce('left', lift.title, 0)
  }
  if (held && held.tasks !== tasks) {
    setHeld(null)
  } else if (held && busy && !held.sawBusy) {
    setHeld({ ...held, sawBusy: true })
  } else if (held && !busy && held.sawBusy) {
    setHeld(null)
  }

  const liftOrder =
    lift && byId.has(lift.taskId) ? keepLiftedPlace(lift.order, lift.taskId, givenIds) : null
  const heldOrder = held && held.tasks === tasks ? held.order : null
  const shownOrder = liftOrder ?? heldOrder
  const shown = shownOrder
    ? shownOrder.flatMap((id) => {
        const task = byId.get(id)
        return task ? [task] : []
      })
    : tasks

  useLayoutEffect(() => {
    moving.current = false
  })

  function startLift(taskId: string, byPointer: boolean) {
    const task = byId.get(taskId)
    if (busy || lift || !reorderable || !task?.canAct.reorder) {
      return false
    }
    const order = shown.map((item) => item.task.id)
    setLift({ taskId, title: task.task.title, order, byPointer })
    if (!byPointer) {
      announce('lifted', task.task.title, order.indexOf(taskId) + 1)
    }
    return true
  }

  function moveLifted(move: QueueMove) {
    if (!lift || !liftOrder) {
      return
    }
    const order = movedOrder(liftOrder, lift.taskId, move)
    const to = order.indexOf(lift.taskId)
    if (to === liftOrder.indexOf(lift.taskId)) {
      return
    }
    moving.current = true
    setLift({ ...lift, order })
    if (!lift.byPointer) {
      announce('moved', lift.title, to + 1)
    }
  }

  function drop() {
    if (!lift || !liftOrder) {
      return
    }
    const to = liftOrder.indexOf(lift.taskId)
    setLift(null)
    announce('dropped', lift.title, to + 1)
    if (to !== givenIds.indexOf(lift.taskId)) {
      setHeld({ order: liftOrder, tasks, sawBusy: busy })
      onReorder?.(lift.taskId, to + 1)
    }
  }

  function cancel() {
    if (!lift || moving.current) {
      return
    }
    setLift(null)
    announce('cancelled', lift.title, givenIds.indexOf(lift.taskId) + 1)
  }

  function handleMove(taskId: string, move: QueueMove) {
    if (lift?.taskId === taskId) {
      moveLifted(move)
    }
  }

  function handleDrop(taskId: string) {
    if (lift?.taskId === taskId) {
      drop()
    }
  }

  function handleCancel(taskId: string) {
    if (lift?.taskId === taskId) {
      cancel()
    }
  }

  const cancelLift = useEffectEvent(cancel)

  /* A change of order that starts elsewhere disables every handle, so a lifted card is put back. */
  useEffect(() => {
    if (busy) {
      cancelLift()
    }
  }, [busy])

  function endPress() {
    press.current = null
    window.getSelection()?.removeAllRanges()
  }

  const pointer = {
    move(event: PointerEvent) {
      const current = press.current
      if (!current || current.ended || event.pointerId !== current.pointerId) {
        return
      }
      if (!current.dragging) {
        if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_START_PX) {
          return
        }
        if (!startLift(current.taskId, true)) {
          press.current = null
          return
        }
        current.dragging = true
        return
      }
      if (lift?.taskId !== current.taskId || !liftOrder) {
        return
      }
      const from = liftOrder.indexOf(lift.taskId)
      const to = placeForPointer(Array.from(current.list.children), from, event.clientY)
      if (to !== from) {
        moveLifted(to + 1)
      }
    },
    up(event: PointerEvent) {
      const current = press.current
      if (!current || event.pointerId !== current.pointerId) {
        return
      }
      endPress()
      if (current.dragging) {
        swallowNextClick()
        if (!current.ended && lift?.taskId === current.taskId) {
          drop()
        }
      }
    },
    /*
     * The press is kept until its release, so the click that follows a
     * cancelled drag is swallowed too.
     */
    cancel() {
      const current = press.current
      if (!current || current.ended) {
        return
      }
      if (!current.dragging) {
        press.current = null
        return
      }
      current.ended = true
      if (lift?.taskId === current.taskId) {
        cancel()
      }
    },
    key(event: KeyboardEvent) {
      if (event.key === 'Escape' && press.current?.dragging && !press.current.ended) {
        event.preventDefault()
        event.stopPropagation()
        pointer.cancel()
      }
    },
  }

  /* The document's listeners call the latest of these, which see the latest state. */
  const latest = useRef(pointer)
  useLayoutEffect(() => {
    latest.current = pointer
  })

  useEffect(() => {
    const root = document.documentElement
    const move = (event: PointerEvent) => latest.current.move(event)
    const up = (event: PointerEvent) => latest.current.up(event)
    const leave = () => latest.current.cancel()
    const key = (event: KeyboardEvent) => latest.current.key(event)
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', leave)
    root.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', leave)
      root.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
      document.removeEventListener('keydown', key, true)
    }
  }, [])

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || !event.isPrimary || busy || lift || !reorderable) {
      return
    }
    const item = (event.target as Element).closest('li')
    const list = item?.parentElement
    if (!item || !list || list.tagName !== 'OL') {
      return
    }
    const task = shown[Array.from(list.children).indexOf(item)]
    if (!task?.canAct.reorder) {
      return
    }
    press.current = {
      taskId: task.task.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      list,
      dragging: false,
      ended: false,
    }
  }

  return (
    <BoardSection
      title={queue.title}
      count={tasks.length}
      folds={false}
      listElement="ol"
      cardGap="loose"
      className={lift?.byPointer ? styles.dragging : undefined}
      onPointerDown={handlePointerDown}
      cards={shown.map((task, index) => ({
        id: task.task.id,
        card: (
          <QueueCard
            task={shownOrder ? { ...task, position: index + 1 } : task}
            selected={task.task.id === selectedTaskId}
            lifted={task.task.id === lift?.taskId}
            movable={reorderable && task.canAct.reorder}
            busy={busy}
            instructionsId={instructionsId}
            onOpenTask={onOpenTask}
            onLift={(taskId) => startLift(taskId, false)}
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

/**
 * The release that ends a drag is followed by a click on whatever is under
 * the pointer, which must not open a task. The click comes in the same task
 * as the release, so the guard is gone by the next one.
 */
function swallowNextClick() {
  function swallow(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
}
