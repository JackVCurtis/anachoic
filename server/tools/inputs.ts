import { z } from 'zod'
import type { StepInput } from '../../domain/types.js'
import { LIMITS } from '../../shared/limits.js'
import { OUTPUT_FORMATS } from '../../shared/output_format.js'

/**
 * The input fields the model tools share, with the limits of shared/limits.ts.
 */

function text(field: keyof typeof LIMITS) {
  return z.string().min(LIMITS[field].min).max(LIMITS[field].max)
}

export const taskInput = z
  .union([z.string().min(1), z.number().int().positive()])
  .describe('The task: its id, such as T-012, or its number, 12')

const outputFormat = z
  .enum(OUTPUT_FORMATS)
  .describe('Only on a step the person owns: the artifact marking it done requires')

const step = {
  title: text('title'),
  owner: z.enum(['agent', 'you']),
  detail: text('detail').optional(),
}

/**
 * Steps as the model tools take them, with output_format.
 */
export const stepsInput = z
  .array(z.object({ ...step, output_format: outputFormat.optional() }))
  .min(LIMITS.steps.min)
  .max(LIMITS.steps.max)

/**
 * Steps as the view's tools take them, with outputFormat.
 */
export const viewStepsInput = z
  .array(z.object({ ...step, outputFormat: outputFormat.nullable().optional() }))
  .min(LIMITS.steps.min)
  .max(LIMITS.steps.max)

/**
 * The model tools' steps as the services take them.
 */
export function fromModelSteps(steps: z.infer<typeof stepsInput>): StepInput[] {
  return steps.map(({ output_format: format, ...each }) =>
    format === undefined ? each : { ...each, outputFormat: format }
  )
}

export const linksInput = z
  .array(z.object({ label: z.string().min(1), url: z.string().min(1) }))
  .max(LIMITS.links.max)
  .optional()

export const assignToInput = z
  .string()
  .min(1)
  .max(100)
  .optional()
  .describe(
    'A live worker to assign the task to, which alone may then claim its agent steps: its session id, or its name as the board shows it'
  )

export const titleInput = text('title')
export const noteInput = text('note')
export const questionInput = text('question')
export const summaryInput = text('summary')
