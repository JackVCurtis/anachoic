import type { Step } from './types.js'

/**
 * The index of the current step: the first step that is not done, else the
 * last. A chain always has at least one step.
 */
export function currentStepIndex(steps: readonly Step[]): number {
  const index = steps.findIndex((step) => step.status !== 'done')
  return index === -1 ? steps.length - 1 : index
}

export function currentStep(steps: readonly Step[]): Step {
  return steps[currentStepIndex(steps)]
}
