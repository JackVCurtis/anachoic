/**
 * The limits on every input a tool or the view accepts, in characters for
 * text and in items for lists. Both bounds are inclusive.
 */
export const LIMITS = {
  title: { min: 1, max: 200 },
  detail: { min: 0, max: 4000 },
  links: { min: 0, max: 10 },
  steps: { min: 1, max: 20 },
  note: { min: 1, max: 500 },
  question: { min: 1, max: 2000 },
  reason: { min: 1, max: 2000 },
  rejection: { min: 1, max: 2000 },
  summary: { min: 1, max: 2000 },
  answer: { min: 1, max: 4000 },
  sessionName: { min: 1, max: 40 },
} as const

export type LimitedField = keyof typeof LIMITS
