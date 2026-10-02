import { DEAD_WINDOW_MS } from '../domain/derived.js'
import { HEARTBEAT_INTERVAL_MS } from '../store/heartbeat.js'

/**
 * How often this process marks its sessions as seen, and how long a session
 * may go unseen before a write ends it as dead.
 */
export interface LivenessTimings {
  heartbeatMs: number
  deadWindowMs: number
}

export const LIVENESS_TIMINGS: LivenessTimings = {
  heartbeatMs: HEARTBEAT_INTERVAL_MS,
  deadWindowMs: DEAD_WINDOW_MS,
}

const VARIABLES = {
  heartbeatMs: 'ANACHOIC_HEARTBEAT_MS',
  deadWindowMs: 'ANACHOIC_DEAD_WINDOW_MS',
} as const

/**
 * The timings, each shortened by its environment variable when that holds a
 * whole number of milliseconds below the default. Tests set them, together,
 * so that a beat still comes well inside the window; the extension's
 * manifest and the worker plugin never do.
 */
export function livenessTimings(env: Record<string, string | undefined>): LivenessTimings {
  const timings = { ...LIVENESS_TIMINGS }
  for (const key of Object.keys(VARIABLES) as Array<keyof LivenessTimings>) {
    const value = Number(env[VARIABLES[key]])
    if (Number.isSafeInteger(value) && value > 0 && value < timings[key]) timings[key] = value
  }
  return timings
}
