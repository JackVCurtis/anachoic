import type { TaskProps } from '../../shared/props'
import { BACKOFF_MS, POLL_MS } from './board_source'
import type { HostApp } from './connect'
import { getTask, type TaskArg } from './tools'

export interface TaskSnapshot {
  /** The task drawn, the one with the highest revision seen, or null before one arrives. */
  task: TaskProps | null
  /**
   * The sentence of the last refusal get_task gave, such as "T-012 was
   * archived", shown in place of the chain. Null once a fetch succeeds.
   */
  refusal: string | null
  /** From the first fetch that got no answer until one does. */
  unreachable: boolean
}

/**
 * One task's props for the task view and the board's task panel, kept live
 * by polling get_task as the board source polls get_board. Its snapshot
 * keeps its identity until something drawn changes.
 */
export interface TaskSource {
  getSnapshot(): TaskSnapshot
  subscribe(listener: () => void): () => void
  /** Starts polling. Starting again while polling does nothing. */
  start(): void
  stop(): void
  /** Fetches now, as after a write, then polls again in POLL_MS. */
  refresh(): Promise<void>
}

export function createTaskSource(
  app: Pick<HostApp, 'callServerTool'>,
  task: TaskArg,
  initial: Partial<TaskSnapshot> = {}
): TaskSource {
  let snapshot: TaskSnapshot = { task: null, refusal: null, unreachable: false, ...initial }
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let failures = 0
  /*
   * Bumped by every refresh and stop, so a poll that was in flight then
   * neither schedules the next poll nor changes the reachability shown.
   * Starting does not bump it: a refresh already in flight still reports.
   */
  let generation = 0

  function set(next: Partial<TaskSnapshot>) {
    const changed = (Object.keys(next) as Array<keyof TaskSnapshot>).some(
      (key) => next[key] !== snapshot[key]
    )
    if (!changed) {
      return
    }
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) {
      listener()
    }
  }

  function schedule(delay: number) {
    if (timer !== null) {
      clearTimeout(timer)
    }
    timer = running ? setTimeout(() => void poll(), delay) : null
  }

  async function poll() {
    timer = null
    const pollGeneration = generation
    // After a refusal the task may have changed shape, so the next fetch asks for it in full.
    const since = snapshot.refusal === null ? snapshot.task?.revision : undefined
    const outcome = await getTask(app, task, since)
    const current = pollGeneration === generation

    if (!outcome.ok) {
      if (current) {
        set(
          'refusal' in outcome
            ? { refusal: outcome.refusal, unreachable: false }
            : { unreachable: true }
        )
        failures += 1
        schedule(BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1])
      }
      return
    }

    const props = outcome.props
    const fresh =
      'changed' in props || (snapshot.task !== null && props.revision <= snapshot.task.revision)
        ? null
        : props
    if (!current) {
      if (fresh) set({ task: fresh })
      return
    }
    set({ ...(fresh ? { task: fresh } : {}), refusal: null, unreachable: false })
    failures = 0
    schedule(POLL_MS)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start() {
      if (running) {
        return
      }
      running = true
      schedule(POLL_MS)
    },
    stop() {
      running = false
      generation += 1
      schedule(0)
    },
    async refresh() {
      generation += 1
      failures = 0
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      await poll()
    },
  }
}

/**
 * Fetches the task, as a view does once it has connected, and keeps it in a
 * source that has not started polling. A fetch that gets no answer is tried
 * again after the same waits as a failed poll; a refusal, such as a task
 * that does not exist, is kept in the snapshot at once.
 */
export async function openTaskSource(
  app: Pick<HostApp, 'callServerTool'>,
  task: TaskArg
): Promise<TaskSource> {
  for (let failures = 0; ; failures += 1) {
    if (failures > 0) {
      const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1]
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
    const outcome = await getTask(app, task)
    if (outcome.ok && !('changed' in outcome.props)) {
      return createTaskSource(app, task, { task: outcome.props })
    }
    if (!outcome.ok && 'refusal' in outcome) {
      return createTaskSource(app, task, { refusal: outcome.refusal })
    }
  }
}
