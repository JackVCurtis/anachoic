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
  reason: { min: 1, max: 250 },
  formPages: { min: 1, max: 10 },
  formOptions: { min: 2, max: 6 },
  formQuestion: { min: 1, max: 250 },
  formOption: { min: 1, max: 150 },
  formText: { min: 1, max: 500 },
  rejection: { min: 1, max: 2000 },
  summary: { min: 1, max: 2000 },
  answer: { min: 1, max: 4000 },
  sessionName: { min: 1, max: 40 },
} as const

export type LimitedField = keyof typeof LIMITS
