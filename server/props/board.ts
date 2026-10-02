import { currentStep } from '../../domain/chain.js'
import {
  agentSeconds,
  canAct,
  claimedBy,
  counts,
  holdings,
  linkCount,
  listOf,
  yourSeconds,
} from '../../domain/derived.js'
import type { Instant, Step, Task, TaskState } from '../../domain/types.js'
import type {
  Artifact,
  BacklogItem,
  BoardProps,
  Pip,
  QueueItem,
  SessionItem,
  TaskRef,
  ToSignOffItem,
  WorkingItem,
  YourTurnItem,
} from '../../shared/props.js'
import { formatTaskId } from '../../shared/task_id.js'
import type { Database } from '../../store/database.js'
import { readBoard, type BoardSnapshot } from '../../store/queries.js'

/**
 * A task as the props name it, with the worker it is assigned to named by
 * `nameOf`.
 */
export function taskRef(
  task: Pick<Task, 'id' | 'title' | 'assignedTo'>,
  nameOf: (sessionId: string) => string
): TaskRef {
  return {
    id: String(task.id),
    displayId: formatTaskId(task.id),
    title: task.title,
    assignedTo:
      task.assignedTo === null ? null : { id: task.assignedTo, name: nameOf(task.assignedTo) },
  }
}

/**
 * Builds the board props from one snapshot. Which list a task is in, what
 * you can do with it and every time on it come from domain/, so the view
 * only formats what it is given.
 */
export function boardProps(snapshot: BoardSnapshot, now: Instant): BoardProps {
  const known = new Map(
    snapshot.sessions.map(({ session, live }) => [session.id, { name: session.name, live }])
  )
  const nameOf = (id: string | null) => (id === null ? null : (known.get(id)?.name ?? id))
  const ref = (task: Pick<Task, 'id' | 'title' | 'assignedTo'>) =>
    taskRef(task, (id) => known.get(id)?.name ?? id)

  const pips = (steps: readonly Step[]): Pip[] =>
    steps.map((step) => ({
      id: step.id,
      owner: step.owner,
      status: step.status,
      title: step.title,
      sessionName:
        step.status === 'running' || step.status === 'waiting' ? nameOf(step.claimedBy) : null,
      ...(step.outputFormat === null ? {} : { outputFormat: step.outputFormat }),
      ...(step.artifactUrl === null ? {} : { artifactUrl: step.artifactUrl }),
    }))

  const holder = (state: TaskState) => {
    const claim = claimedBy(state, (id) => known.get(id))
    return claim ? { id: claim.id, name: claim.name } : undefined
  }

  const yourTurn: YourTurnItem[] = []
  const working: WorkingItem[] = []
  const queue: QueueItem[] = []
  const backlog: BacklogItem[] = []
  const toSignOff: ToSignOffItem[] = []

  for (const state of snapshot.tasks) {
    const { task, steps } = state
    const step = currentStep(steps)
    const can = canAct(state)
    switch (listOf(state)) {
      case 'yourTurn': {
        const session = step.owner === 'agent' ? holder(state) : undefined
        yourTurn.push({
          task: ref(task),
          step: {
            number: step.number,
            title: step.title,
            owner: step.owner,
            ...(step.owner === 'agent' && step.question !== null
              ? { question: step.question }
              : {}),
            ...(step.outputFormat === null ? {} : { outputFormat: step.outputFormat }),
            waitingSince: step.waitingSince ?? step.startedAt ?? now,
          },
          ...(session ? { session } : {}),
          steps: pips(steps),
          canAct: { complete: can.complete, answer: can.answer, park: can.park },
        })
        break
      }
      case 'working':
        working.push({
          task: ref(task),
          step: {
            number: step.number,
            title: step.title,
            ...(step.note === null ? {} : { note: step.note }),
            runningSince: step.runningSince ?? step.startedAt ?? now,
          },
          session: holder(state) ?? {
            id: step.claimedBy ?? '',
            name: nameOf(step.claimedBy) ?? '',
          },
          steps: pips(steps),
          ...artifactsOf(steps),
        })
        break
      case 'queue':
        queue.push({
          task: ref(task),
          position: task.queuePosition ?? queue.length + 1,
          nextOwner: step.owner,
          steps: pips(steps),
          ...artifactsOf(steps),
          canAct: { reorder: can.reorder, backlog: can.backlog },
        })
        break
      case 'backlog':
        backlog.push({
          task: ref(task),
          steps: pips(steps),
          ...artifactsOf(steps),
          canAct: { queue: can.queue, archive: can.archive },
        })
        break
      case 'toSignOff':
        toSignOff.push({
          task: ref(task),
          finishedAt: task.finishedAt ?? now,
          agentSeconds: agentSeconds(steps),
          yourSeconds: yourSeconds(steps),
          linkCount: linkCount(steps),
          steps: pips(steps),
          ...artifactsOf(steps),
          canAct: { signOff: can.signOff, followUp: can.followUp, archive: can.archive },
        })
        break
      default:
        break
    }
  }

  queue.sort((a, b) => a.position - b.position)
  toSignOff.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))

  const sessions: SessionItem[] = snapshot.sessions
    .filter(({ session, live }) => live || session.endedAt !== null)
    .map(({ session, live, released }) => {
      const item: SessionItem = { id: session.id, kind: session.kind, name: session.name, live }
      if (live) {
        const [held] = holdings(session.id, snapshot.tasks)
        if (held) {
          item.holding = {
            task: ref(held.task),
            step: { number: held.step.number, title: held.step.title },
            status: held.status,
          }
        }
      } else {
        item.endedAt = session.endedAt!
        item.released = released.map(ref)
      }
      return item
    })
    .sort((a, b) => order(a) - order(b))

  return {
    revision: snapshot.revision,
    now,
    yourTurn,
    working,
    queue,
    backlog,
    toSignOff,
    signedOff: snapshot.signedOff.map(({ task }) => ({
      task: ref(task),
      signedOffAt: task.signedOffAt!,
    })),
    sessions,
    workers: snapshot.sessions
      .filter(({ session, live }) => live && session.kind === 'worker')
      .map(({ session }) => ({ id: session.id, name: session.name })),
    counts: counts(snapshot.tasks),
  }
}

/**
 * The links from a task's done steps that have an artifact, as an item's
 * `artifacts` field, or nothing when there are none.
 */
function artifactsOf(steps: readonly Step[]): { artifacts?: Artifact[] } {
  const artifacts = steps.flatMap((step): Artifact[] =>
    step.status === 'done' && step.outputFormat !== null && step.artifactUrl !== null
      ? [{ stepNumber: step.number, format: step.outputFormat, url: step.artifactUrl }]
      : []
  )
  return artifacts.length === 0 ? {} : { artifacts }
}

/**
 * The dedicated session first, then live sessions, then those that ended.
 */
function order(session: SessionItem) {
  if (session.kind === 'dedicated') return 0
  return session.live ? 1 : 2
}

/**
 * The board as it is now, read in one snapshot.
 */
export function readBoardProps(database: Database, now: Instant): BoardProps {
  return boardProps(readBoard(database, now), now)
}
