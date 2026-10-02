import type { StepPip } from '../patterns/step_pips/step_pips'
import type { BoardStep } from './board_data'

/**
 * A chain as the pips draw it. A step no session has claimed reads "agent".
 */
export function pipsOf(steps: readonly BoardStep[]): StepPip[] {
  return steps.map((step) => ({
    id: step.id,
    owner: step.owner,
    status: step.status,
    title: step.title,
    sessionName: step.sessionName ?? null,
  }))
}

/**
 * The number of steps in a chain, and never fewer than the step shown, so a
 * card given no pips still counts the step it names.
 */
export function stepCount(steps: readonly BoardStep[], stepNumber: number): number {
  return Math.max(steps.length, stepNumber)
}
