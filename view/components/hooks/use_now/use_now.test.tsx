// Copied from anachoic inertia/components/hooks/use_now/use_now.test.tsx at fd99e0d
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  LABEL_TICK,
  NowProvider,
  TICK_MS,
  TimeZoneProvider,
  useNow,
  useTimeZone,
  type TickRate,
} from './use_now'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const START = new Date('2026-03-14T09:26:00.000Z')

const renders: Record<string, number> = {}
const seen: Record<string, string> = {}

function record(id: string, now: string) {
  renders[id] = (renders[id] ?? 0) + 1
  seen[id] = now
}

function Probe({ id, rate }: { id: string; rate: TickRate }) {
  const now = useNow(rate)
  record(id, now)
  return <span>{now}</span>
}

let root: Root
let container: HTMLElement

function render(node: React.ReactNode) {
  act(() => root.render(node))
}

/**
 * One act per second, so React renders after every tick rather than batching
 * them into one render.
 */
function advance(ms: number) {
  for (let step = 0; step < ms; step += 1000) {
    act(() => {
      vi.advanceTimersByTime(Math.min(1000, ms - step))
    })
  }
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers({ now: START, toFake: ['setInterval', 'clearInterval', 'Date'] })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  for (const key of Object.keys(renders)) delete renders[key]
  for (const key of Object.keys(seen)) delete seen[key]
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('useNow', () => {
  test('returns the present moment as an ISO instant and renews it at the rate', () => {
    render(<Probe id="a" rate="second" />)
    expect(seen.a).toBe(START.toISOString())

    advance(1000)
    expect(seen.a).toBe('2026-03-14T09:26:01.000Z')
    expect(container.textContent).toBe('2026-03-14T09:26:01.000Z')
  })

  test('two components at one second share one interval, and unmounting both clears it', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    render(
      <>
        <Probe id="a" rate="second" />
        <Probe id="b" rate="second" />
      </>
    )
    expect(vi.getTimerCount()).toBe(1)
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000)

    advance(3000)
    expect(seen.a).toBe('2026-03-14T09:26:03.000Z')
    expect(seen.b).toBe(seen.a)

    render(<Probe id="b" rate="second" />)
    expect(vi.getTimerCount()).toBe(1)
    expect(clearIntervalSpy).not.toHaveBeenCalled()

    render(null)
    expect(vi.getTimerCount()).toBe(0)
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
  })

  test('a component that mounts after the timer stopped starts it again', () => {
    render(<Probe id="a" rate="second" />)
    render(null)
    expect(vi.getTimerCount()).toBe(0)

    advance(5000)
    vi.setSystemTime(new Date('2026-03-14T09:30:00.000Z'))
    render(<Probe id="b" rate="second" />)
    expect(seen.b).toBe('2026-03-14T09:30:00.000Z')
    expect(vi.getTimerCount()).toBe(1)
  })

  test('components at one second and one minute create two timers', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    render(
      <>
        <Probe id="fast" rate="second" />
        <Probe id="slow" rate="minute" />
      </>
    )
    expect(vi.getTimerCount()).toBe(2)
    expect(setIntervalSpy.mock.calls.map(([, ms]) => ms).sort()).toEqual([1000, 60_000])

    const fastBefore = renders.fast
    const slowBefore = renders.slow
    advance(59_000)
    expect(renders.fast - fastBefore).toBe(59)
    expect(renders.slow).toBe(slowBefore)
    expect(seen.slow).toBe(START.toISOString())

    advance(1000)
    expect(renders.slow).toBe(slowBefore + 1)
    expect(seen.slow).toBe('2026-03-14T09:27:00.000Z')

    render(<Probe id="slow" rate="minute" />)
    expect(vi.getTimerCount()).toBe(1)
    render(null)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('under a NowProvider the output is the fixed instant, stable across renders, with no timer', () => {
    const fixed = '2026-01-01T00:00:30.000Z'
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    render(
      <NowProvider now={fixed}>
        <Probe id="a" rate="second" />
        <Probe id="b" rate="thirtySeconds" />
        <Probe id="c" rate="minute" />
      </NowProvider>
    )
    expect(vi.getTimerCount()).toBe(0)
    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect([seen.a, seen.b, seen.c]).toEqual([fixed, fixed, fixed])

    advance(120_000)
    render(
      <NowProvider now={fixed}>
        <Probe id="a" rate="second" />
        <Probe id="b" rate="thirtySeconds" />
        <Probe id="c" rate="minute" />
      </NowProvider>
    )
    expect(renders.a).toBe(2)
    expect([seen.a, seen.b, seen.c]).toEqual([fixed, fixed, fixed])
    expect(vi.getTimerCount()).toBe(0)
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })

  test('each label asks for its documented tick', () => {
    expect(TICK_MS[LABEL_TICK.elapsed]).toBe(1000)
    expect(TICK_MS[LABEL_TICK.waited]).toBe(30_000)
    expect(TICK_MS[LABEL_TICK.finished]).toBe(60_000)
    expect(TICK_MS[LABEL_TICK.eventTime]).toBe(60_000)
  })
})

function ZoneProbe() {
  return <span>{useTimeZone() ?? 'browser'}</span>
}

describe('useTimeZone', () => {
  test('reads the zone of the nearest TimeZoneProvider', () => {
    render(
      <TimeZoneProvider timeZone="Asia/Kolkata">
        <ZoneProbe />
      </TimeZoneProvider>
    )
    expect(container.textContent).toBe('Asia/Kolkata')
  })

  test('reads undefined without a provider, meaning the browser’s zone', () => {
    render(<ZoneProbe />)
    expect(container.textContent).toBe('browser')
  })
})
