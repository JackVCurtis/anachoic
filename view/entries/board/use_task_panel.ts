import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { BoardProps, TaskRef } from '../../../shared/props'
import type { BoardSource } from '../../bridge/board_source'
import type { HostApp } from '../../bridge/connect'
import { createTaskSource, type TaskSource } from '../../bridge/task_source'
import { getBoard } from '../../bridge/tools'
import { backlog, done } from '../../components/helpers/strings'
import type { TaskSummary } from '../../components/task/task_data'
import { toTaskSummary } from './to_task_data'

/** The task the board's panel shows, and where focus goes back to. */
export interface OpenTaskPanel {
  summary: TaskSummary
  source: TaskSource
  /** The control that opened the panel, such as a card's title. */
  opener: HTMLElement | null
  /** The heading of the section the opener was in. */
  sectionHeading: HTMLElement | null
}

/**
 * Every task the board names, so a card's title can open its task with what
 * the card knew.
 */
function taskRefs(board: BoardProps): TaskRef[] {
  return [
    ...board.yourTurn.map((item) => item.task),
    ...board.working.map((item) => item.task),
    ...board.queue.map((item) => item.task),
    ...board.backlog.map((item) => item.task),
    ...board.toSignOff.map((item) => item.task),
    ...board.signedOff.map((item) => item.task),
    ...board.sessions.flatMap((session) => (session.holding ? [session.holding.task] : [])),
  ]
}

/** The board section a task returned to the board for, by its heading's title. */
export type ReturnSection = 'backlog' | 'done'

const SECTION_TITLES: Record<ReturnSection, string> = { backlog: backlog.title, done: done.title }

function focusable(element: HTMLElement | null | undefined): element is HTMLElement {
  return element !== null && element !== undefined && element.isConnected
}

/**
 * The board's task panel: pressing a card's title swaps the board for the
 * task, fetched with get_task and kept live by polling it. Back to board
 * swaps back, fetches the board, and returns focus to the card that opened
 * the task, else its section's heading, else the board's heading.
 */
export function useTaskPanel(
  app: Pick<HostApp, 'callServerTool'>,
  board: BoardProps,
  boardSource: Pick<BoardSource, 'replace'>,
  boardRoot: RefObject<HTMLElement | null>
) {
  const [panel, setPanel] = useState<OpenTaskPanel | null>(null)
  const returning = useRef<{ panel: OpenTaskPanel; section: ReturnSection | null } | null>(null)

  const source = panel?.source
  useEffect(() => {
    if (!source) {
      return
    }
    void source.refresh()
    source.start()
    return () => source.stop()
  }, [source])

  /* Runs once the board is shown again, since a hidden element cannot take focus. */
  useLayoutEffect(() => {
    const closed = returning.current
    if (panel !== null || closed === null) {
      return
    }
    returning.current = null
    const root = boardRoot.current
    const sectionHeading = closed.section
      ? [...(root?.querySelectorAll<HTMLElement>('h2') ?? [])].find(
          (heading) => heading.textContent === SECTION_TITLES[closed.section!]
        )
      : undefined
    const boardHeading = root?.querySelector<HTMLElement>('h1')
    const target = closed.section
      ? [sectionHeading, boardHeading].find(focusable)
      : [closed.panel.opener, closed.panel.sectionHeading, boardHeading].find(focusable)
    target?.focus()
  }, [panel, boardRoot])

  function openTask(taskId: string) {
    const ref = taskRefs(board).find((task) => task.id === taskId)
    if (!ref) {
      return
    }
    const active = document.activeElement
    const opener = active instanceof HTMLElement && active !== document.body ? active : null
    setPanel({
      summary: toTaskSummary(ref),
      source: createTaskSource(app, taskId),
      opener,
      sectionHeading: opener?.closest('section')?.querySelector<HTMLElement>('h2') ?? null,
    })
  }

  /**
   * Swaps back to the board. With a section, focus goes to that section's
   * heading, as after the task was archived and its card is gone.
   */
  async function backToBoard(section: ReturnSection | null = null) {
    if (panel === null) {
      return
    }
    returning.current = { panel, section }
    setPanel(null)
    const outcome = await getBoard(app)
    if (outcome.ok && !('changed' in outcome.props)) {
      boardSource.replace(outcome.props)
    }
  }

  return {
    panel,
    openTask,
    backToBoard: (section: ReturnSection | null = null) => void backToBoard(section),
  }
}
