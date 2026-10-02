import { z } from 'zod'
import { LIMITS } from '../../shared/limits.js'

/**
 * The input fields the model tools share, with the limits of shared/limits.ts.
 */

function text(field: keyof typeof LIMITS) {
  return z.string().min(LIMITS[field].min).max(LIMITS[field].max)
}

export const taskInput = z
  .union([z.string().min(1), z.number().int().positive()])
  .describe('The task: its id, such as T-012, or its number, 12')

export const stepsInput = z
  .array(
    z.object({
      title: text('title'),
      owner: z.enum(['agent', 'you']),
      detail: text('detail').optional(),
    })
  )
  .min(LIMITS.steps.min)
  .max(LIMITS.steps.max)

export const linksInput = z
  .array(z.object({ label: z.string().min(1), url: z.string().min(1) }))
  .max(LIMITS.links.max)
  .optional()

export const titleInput = text('title')
export const noteInput = text('note')
export const questionInput = text('question')
export const summaryInput = text('summary')
