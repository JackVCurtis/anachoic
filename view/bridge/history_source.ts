import type { HistoryProps } from '../../shared/props'
import { BACKOFF_MS, POLL_MS } from './board_source'
import type { HostApp } from './connect'
import { getHistory } from './tools'

export interface HistorySnapshot {
  /** The page drawn, or null before one arrives. */
  history: HistoryProps | null
  /** The sentence of the last refusal get_history gave. Null once a fetch succeeds. */
  refusal: string | null
  /** From the first fetch that got no answer until one does. */
  unreachable: boolean
}

/** Which page, of which filter, the source shows. */
export interface HistoryQuery {
  /** From 1. */
  page: number
  /** '' for none. */
  filter: string
}

/**
 * One page of the history for the History view, kept live by polling
 * get_history as the board source polls get_board. Its snapshot keeps its
 * identity until something drawn changes.
 */
export interface HistorySource {
  getSnapshot(): HistorySnapshot
  subscribe(listener: () => void): () => void
  /** Starts polling. Starting again while polling does nothing. */
  start(): void
  stop(): void
  /** Fetches now, then polls again in POLL_MS. */
  refresh(): Promise<void>
  /**
   * Fetches another page, or another filter's pages, in full at once, and
   * polls that from then on. A page past the end gives the last page.
   */
  show(query: Partial<HistoryQuery>): Promise<void>
}

function sameQuery(a: HistoryQuery, b: HistoryQuery) {
  return a.page === b.page && a.filter === b.filter
}

/**
 * A source that starts on `initial`, asking for the page it holds, or else
 * for `firstQuery`.
 */
export function createHistorySource(
  app: Pick<HostApp, 'callServerTool'>,
  initial: Partial<HistorySnapshot> = {},
  firstQuery: Partial<HistoryQuery> = {}
): HistorySource {
  let snapshot: HistorySnapshot = { history: null, refusal: null, unreachable: false, ...initial }
  let query: HistoryQuery = {
    page: snapshot.history?.page ?? firstQuery.page ?? 1,
    filter: snapshot.history?.filter ?? firstQuery.filter?.trim() ?? '',
  }
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let failures = 0
  /*
   * Bumped by every refresh, show and stop, so a poll that was in flight then
   * neither schedules the next poll nor changes the reachability shown.
   * Starting does not bump it: a refresh already in flight still reports.
   */
  let generation = 0

  function set(next: Partial<HistorySnapshot>) {
    const changed = (Object.keys(next) as Array<keyof HistorySnapshot>).some(
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

  /** Whether the page drawn is the one the query asks for, so only a newer revision replaces it. */
  function shows(asked: HistoryQuery) {
    const { history } = snapshot
    return history !== null && sameQuery(asked, { page: history.page, filter: history.filter })
  }

  async function poll() {
    timer = null
    const pollGeneration = generation
    const asked = query
    // After a refusal, or for another page, the page is fetched in full.
    const since = snapshot.refusal === null && shows(asked) ? snapshot.history?.revision : undefined
    const outcome = await getHistory(app, asked.page, asked.filter, since)
    const current = pollGeneration === generation
    // A page asked for before another page was shown is never drawn.
    if (!sameQuery(asked, query)) {
      return
    }

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
      'changed' in props ||
      (shows(asked) && snapshot.history !== null && props.revision <= snapshot.history.revision)
        ? null
        : props
    if (fresh) {
      // A page past the end came back as the last page, which later polls ask for.
      query = { page: fresh.page, filter: fresh.filter }
    }
    if (!current) {
      if (fresh) set({ history: fresh })
      return
    }
    set({ ...(fresh ? { history: fresh } : {}), refusal: null, unreachable: false })
    failures = 0
    schedule(POLL_MS)
  }

  async function fetchNow() {
    generation += 1
    failures = 0
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    await poll()
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
    refresh: fetchNow,
    show(next) {
      query = {
        page: next.page ?? query.page,
        filter: next.filter === undefined ? query.filter : next.filter.trim(),
      }
      return fetchNow()
    },
  }
}

/**
 * Fetches a page of the history, as a view does once it has connected, and
 * keeps it in a source that has not started polling. A fetch that gets no
 * answer is tried again after the same waits as a failed poll; a refusal is
 * kept in the snapshot at once.
 */
export async function openHistorySource(
  app: Pick<HostApp, 'callServerTool'>,
  { page = 1, filter = '' }: Partial<HistoryQuery> = {}
): Promise<HistorySource> {
  for (let failures = 0; ; failures += 1) {
    if (failures > 0) {
      const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1]
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
    const outcome = await getHistory(app, page, filter.trim())
    if (outcome.ok && !('changed' in outcome.props)) {
      return createHistorySource(app, { history: outcome.props })
    }
    if (!outcome.ok && 'refusal' in outcome) {
      return createHistorySource(app, { refusal: outcome.refusal }, { page, filter })
    }
  }
}
