import type { BoardProps, YourTurnItem } from '../../shared/props'
import type { HostApp } from './connect'
import { getBoard } from './tools'

/** How often the board is polled while polls succeed. */
export const POLL_MS = 3_000

/** The waits after the first, second and third failed poll in a row. The last one repeats. */
export const BACKOFF_MS = [10_000, 30_000, 60_000] as const

export interface BoardSnapshot {
  /** The board drawn, the one with the highest revision seen. */
  board: BoardProps
  /** The instant a poll last brought a newer revision, or null before one has. */
  updatedAt: string | null
  /** From the first failed poll until one succeeds. */
  unreachable: boolean
  /** The Your turn items the latest poll to bring any brought, which were not there before. */
  arrived: readonly YourTurnItem[]
  /** Counts the polls that brought Your turn items, so the same items arriving again differ. */
  arrivals: number
}

/**
 * The board's props for the board entry. Its snapshot keeps its identity
 * until something drawn changes, so a poll that finds nothing new renders
 * nothing.
 */
export interface BoardSource {
  getSnapshot(): BoardSnapshot
  subscribe(listener: () => void): () => void
  /** Starts polling. Starting again while polling does nothing. */
  start(): void
  stop(): void
  /** Draws a write's result, unless a newer board is drawn, and polls again in POLL_MS. */
  replace(props: BoardProps): void
}

export interface BoardSourceOptions {
  /** The present moment as an ISO 8601 instant. */
  now?: () => string
}

function arrivedItems(before: BoardProps, after: BoardProps): YourTurnItem[] {
  const present = new Set(before.yourTurn.map((item) => item.task.id))
  return after.yourTurn.filter((item) => !present.has(item.task.id))
}

export function createBoardSource(
  app: Pick<HostApp, 'callServerTool'>,
  initial: BoardProps,
  { now = () => new Date().toISOString() }: BoardSourceOptions = {}
): BoardSource {
  let snapshot: BoardSnapshot = {
    board: initial,
    updatedAt: null,
    unreachable: false,
    arrived: [],
    arrivals: 0,
  }
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let failures = 0
  /*
   * Bumped by every replace and stop, so a poll that was in flight then
   * neither schedules the next poll nor changes the reachability shown.
   */
  let generation = 0

  function set(next: Partial<BoardSnapshot>) {
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) {
      listener()
    }
  }

  function schedule(delay: number) {
    if (timer !== null) {
      clearTimeout(timer)
    }
    timer = running ? setTimeout(poll, delay) : null
  }

  /** Takes props only when they are newer than the board drawn. */
  function take(props: BoardProps, fromPoll: boolean): Partial<BoardSnapshot> | null {
    if (props.revision <= snapshot.board.revision) {
      return null
    }
    if (!fromPoll) {
      return { board: props }
    }
    const arrived = arrivedItems(snapshot.board, props)
    return {
      board: props,
      updatedAt: now(),
      ...(arrived.length > 0 ? { arrived, arrivals: snapshot.arrivals + 1 } : {}),
    }
  }

  async function poll() {
    timer = null
    const pollGeneration = generation
    const outcome = await getBoard(app, snapshot.board.revision)
    const current = pollGeneration === generation

    if (!outcome.ok) {
      if (current) {
        failures += 1
        if (!snapshot.unreachable) {
          set({ unreachable: true })
        }
        schedule(BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1])
      }
      return
    }

    const change = 'changed' in outcome.props ? null : take(outcome.props, true)
    if (current) {
      failures = 0
      const reachable = snapshot.unreachable ? { unreachable: false } : null
      if (change || reachable) {
        set({ ...change, ...reachable })
      }
      schedule(POLL_MS)
    } else if (change) {
      set(change)
    }
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
      generation += 1
      schedule(POLL_MS)
    },
    stop() {
      running = false
      generation += 1
      schedule(0)
    },
    replace(props) {
      generation += 1
      failures = 0
      const change = take(props, false)
      const reachable = snapshot.unreachable ? { unreachable: false } : null
      if (change || reachable) {
        set({ ...change, ...reachable })
      }
      schedule(POLL_MS)
    },
  }
}

/**
 * Fetches the board, as a view does once it has connected, and keeps it in a
 * source that has not started polling. A fetch that does not return the board
 * is tried again after the same waits as a failed poll, until one does.
 */
export async function openBoardSource(
  app: Pick<HostApp, 'callServerTool'>,
  options: BoardSourceOptions = {}
): Promise<BoardSource> {
  for (let failures = 0; ; failures += 1) {
    if (failures > 0) {
      const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1]
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
    const outcome = await getBoard(app)
    if (outcome.ok && !('changed' in outcome.props)) {
      return createBoardSource(app, outcome.props, options)
    }
  }
}
