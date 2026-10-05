import { z } from 'zod'
import type { Owner, StepInput } from '../../domain/types.js'
import { FORM_CHOICES, FORM_PAGE_ID } from '../../shared/form.js'
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
  .describe(
    'Only on an agent step: the artifact it produces, whose URL complete_step then requires as artifact_url'
  )

const step = {
  title: text('title'),
  owner: z
    .enum(['agent', 'user', 'you'])
    .describe('Who does the step: "agent", or "user" ("you" is accepted for "user")'),
  detail: text('detail').optional(),
}

/**
 * The domain's owner for a tool's: "user" and its alias "you" are both 'you'.
 */
function toOwner(owner: 'agent' | 'user' | 'you'): Owner {
  return owner === 'agent' ? 'agent' : 'you'
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
  return steps.map(({ output_format: format, owner, ...each }) =>
    format === undefined
      ? { ...each, owner: toOwner(owner) }
      : { ...each, owner: toOwner(owner), outputFormat: format }
  )
}

/**
 * The view's steps as the services take them.
 */
export function fromViewSteps(steps: z.infer<typeof viewStepsInput>): StepInput[] {
  return steps.map(({ owner, ...each }) => ({ ...each, owner: toOwner(owner) }))
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

const pageId = z
  .string()
  .regex(FORM_PAGE_ID)
  .describe('A page id: 1–32 characters of a-z, 0-9, _ and -, unique in the form')

/**
 * The form ask_you takes. zod checks each field; validateForm then checks
 * the form as a whole, such as that every next names a later page.
 */
export const formInput = z
  .object({
    pages: z
      .array(
        z.object({
          id: pageId,
          question: text('formQuestion').describe('One short question (1–250 characters)'),
          choose: z
            .enum(FORM_CHOICES)
            .describe(
              '"one": the user picks one option. "many": the user picks at least one. "text": the user types up to 500 characters, and the page takes no options'
            ),
          options: z
            .array(
              z.object({
                label: text('formOption').describe('What the user picks (1–150 characters)'),
                next: pageId
                  .optional()
                  .describe('On a "one" page only: the later page this option leads to'),
              })
            )
            .min(LIMITS.formOptions.min)
            .max(LIMITS.formOptions.max)
            .optional()
            .describe('2–6 options, on "one" and "many" pages'),
          next: pageId
            .optional()
            .describe(
              'The later page that follows when no option says otherwise. None ends the form.'
            ),
        })
      )
      .min(LIMITS.formPages.min)
      .max(LIMITS.formPages.max)
      .describe('1–10 pages. pages[0] comes first.'),
  })
  .describe(
    'The form to ask the user, page by page. Example: {"pages":[{"id":"db","question":"Which database should the cache use?","choose":"one","options":[{"label":"Postgres","next":"pg"},{"label":"Redis"}],"next":"prefix"},{"id":"pg","question":"Which Postgres features may it rely on?","choose":"many","options":[{"label":"LISTEN/NOTIFY"},{"label":"JSONB"}],"next":"prefix"},{"id":"prefix","question":"What key prefix should it use?","choose":"text"}]}'
  )

/**
 * The user's answers to a form, as the view sends them.
 */
export const formResponsesInput = z
  .array(
    z.object({
      page: z.string().min(1),
      picked: z.array(z.number().int().nonnegative()).max(LIMITS.formOptions.max).optional(),
      text: text('formText').optional(),
    })
  )
  .min(1)
  .max(LIMITS.formPages.max)

export const reasonInput = text('reason')
export const summaryInput = text('summary')

export const artifactUrlInput = z
  .string()
  .optional()
  .describe(
    'The http(s) URL of the artifact the step produced. Required when the step declares an output format, and ignored otherwise.'
  )
