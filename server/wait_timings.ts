/**
 * How wait_for_answer waits: how often it reads the board, how often it
 * sends progress, and how long before it returns with no answer. Progress
 * every minute keeps Claude Code's 30-minute idle limit from tripping.
 */
export interface WaitTimings {
  pollMs: number
  progressMs: number
  timeoutMs: number
}

export const WAIT_TIMINGS: WaitTimings = {
  pollMs: 2_000,
  progressMs: 60_000,
  timeoutMs: 20 * 60_000,
}

const VARIABLES = {
  pollMs: 'ANACHOIC_WAIT_POLL_MS',
  progressMs: 'ANACHOIC_WAIT_PROGRESS_MS',
  timeoutMs: 'ANACHOIC_WAIT_TIMEOUT_MS',
} as const

/**
 * The timings, each shortened by its environment variable when that holds a
 * whole number of milliseconds below the default. Tests set them; the
 * extension's manifest never does, and they can never lengthen a wait.
 */
export function waitTimings(env: Record<string, string | undefined>): WaitTimings {
  const timings = { ...WAIT_TIMINGS }
  for (const key of Object.keys(VARIABLES) as Array<keyof WaitTimings>) {
    const value = Number(env[VARIABLES[key]])
    if (Number.isSafeInteger(value) && value > 0 && value < timings[key]) timings[key] = value
  }
  return timings
}
