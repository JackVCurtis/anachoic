// Copied from anachoic inertia/components/hooks/use_now/use_now.tsx at fd99e0d
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'

/**
 * How often a component wants the present moment renewed.
 */
export type TickRate = 'second' | 'thirtySeconds' | 'minute'

export const TICK_MS: Record<TickRate, number> = {
  second: 1000,
  thirtySeconds: 30_000,
  minute: 60_000,
}

/**
 * The tick each time label asks for.
 */
export const LABEL_TICK = {
  elapsed: 'second',
  waited: 'thirtySeconds',
  finished: 'minute',
  eventTime: 'minute',
} as const satisfies Record<string, TickRate>

/**
 * The present moment for every component that asks for one rate. The timer
 * runs only while at least one component is subscribed.
 */
class Clock {
  #listeners = new Set<() => void>()
  #timer: ReturnType<typeof setInterval> | null = null
  #now = new Date().toISOString()
  #readAt = Date.now()

  constructor(readonly intervalMs: number) {}

  /**
   * React compares consecutive snapshots, so the value must stay the same
   * until something changes it. While the timer runs, only a tick changes it.
   * While idle, it is read again once it is a second old, so a component that
   * mounts later does not start from a stale moment.
   */
  getSnapshot = (): string => {
    if (this.#timer === null && Math.abs(Date.now() - this.#readAt) >= 1000) {
      this.#read()
    }
    return this.#now
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    if (this.#timer === null) {
      this.#timer = setInterval(this.#tick, this.intervalMs)
    }
    return () => {
      this.#listeners.delete(listener)
      if (this.#listeners.size === 0 && this.#timer !== null) {
        clearInterval(this.#timer)
        this.#timer = null
      }
    }
  }

  #read() {
    this.#readAt = Date.now()
    this.#now = new Date(this.#readAt).toISOString()
  }

  #tick = () => {
    this.#read()
    for (const listener of this.#listeners) {
      listener()
    }
  }
}

const CLOCKS: Record<TickRate, Clock> = {
  second: new Clock(TICK_MS.second),
  thirtySeconds: new Clock(TICK_MS.thirtySeconds),
  minute: new Clock(TICK_MS.minute),
}

const FixedNowContext = createContext<string | null>(null)

function subscribeToNothing(): () => void {
  return () => {}
}

/**
 * Fixes the present moment for everything inside it, for stories and tests.
 * `now` is an ISO 8601 instant.
 */
export function NowProvider({ now, children }: { now: string; children: ReactNode }) {
  return <FixedNowContext.Provider value={now}>{children}</FixedNowContext.Provider>
}

/**
 * The present moment as an ISO 8601 instant, renewed at the given rate. Under
 * a NowProvider it is the provider's instant and no timer starts.
 */
export function useNow(rate: TickRate): string {
  const fixed = useContext(FixedNowContext)
  const clock = CLOCKS[rate]
  const getSnapshot = fixed === null ? clock.getSnapshot : () => fixed
  return useSyncExternalStore(
    fixed === null ? clock.subscribe : subscribeToNothing,
    getSnapshot,
    getSnapshot
  )
}

const TimeZoneContext = createContext<string | undefined>(undefined)

/**
 * Sets the IANA time zone time labels are shown in, such as the host's.
 * Without one they follow the browser's zone.
 */
export function TimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string | undefined
  children: ReactNode
}) {
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>
}

/**
 * The IANA time zone given by the nearest TimeZoneProvider, or undefined for
 * the browser's zone.
 */
export function useTimeZone(): string | undefined {
  return useContext(TimeZoneContext)
}
