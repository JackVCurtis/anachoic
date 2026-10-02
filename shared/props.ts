import { z } from 'zod'

/**
 * The props the server sends the views, as zod schemas the server checks its
 * results against. The view imports only the types, so zod stays out of it.
 */

const instant = z.string().describe('An ISO 8601 instant')

export const ownerSchema = z.enum(['agent', 'you'])

export const stepStatusSchema = z.enum(['pending', 'running', 'waiting', 'done'])

/**
 * A session the board names: a worker a task is assigned to, or one you can
 * assign to.
 */
export const workerSchema = z.object({ id: z.string(), name: z.string() })

export const taskRefSchema = z.object({
  id: z.string(),
  displayId: z.string(),
  title: z.string(),
  /** The worker that alone may claim the task's agent steps. The server always sends it. */
  assignedTo: workerSchema.nullable().optional(),
})

/**
 * One step of a chain as a row of pips draws it.
 */
export const pipSchema = z.object({
  id: z.string(),
  owner: ownerSchema,
  status: stepStatusSchema,
  title: z.string(),
  sessionName: z.string().nullable(),
})

const pips = z.array(pipSchema)

export const yourTurnItemSchema = z.object({
  task: taskRefSchema,
  step: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    owner: ownerSchema,
    question: z.string().optional(),
    waitingSince: instant,
  }),
  session: z.object({ id: z.string(), name: z.string() }).optional(),
  steps: pips,
  canAct: z.object({
    complete: z.boolean().optional(),
    answer: z.boolean().optional(),
    park: z.boolean(),
  }),
})

export const workingItemSchema = z.object({
  task: taskRefSchema,
  step: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    note: z.string().optional(),
    runningSince: instant,
  }),
  session: z.object({ id: z.string(), name: z.string() }),
  steps: pips,
})

export const queueItemSchema = z.object({
  task: taskRefSchema,
  position: z.number().int().positive(),
  nextOwner: ownerSchema,
  steps: pips,
  canAct: z.object({ reorder: z.boolean(), backlog: z.boolean() }),
})

export const backlogItemSchema = z.object({
  task: taskRefSchema,
  steps: pips,
  canAct: z.object({ queue: z.boolean(), archive: z.boolean() }),
})

export const toSignOffItemSchema = z.object({
  task: taskRefSchema,
  finishedAt: instant,
  agentSeconds: z.number().int().nonnegative(),
  yourSeconds: z.number().int().nonnegative(),
  linkCount: z.number().int().nonnegative(),
  steps: pips,
  canAct: z.object({ signOff: z.boolean(), followUp: z.boolean(), archive: z.boolean() }),
})

export const signedOffItemSchema = z.object({
  task: taskRefSchema,
  signedOffAt: instant,
})

export const sessionItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['dedicated', 'worker']),
  name: z.string(),
  live: z.boolean(),
  holding: z
    .object({
      task: taskRefSchema,
      step: z.object({ number: z.number().int().positive(), title: z.string() }),
      status: z.enum(['running', 'waiting']),
    })
    .optional(),
  endedAt: instant.optional(),
  released: z.array(taskRefSchema).optional(),
})

export const boardCountsSchema = z.object({
  yourTurn: z.number().int().nonnegative(),
  working: z.number().int().nonnegative(),
  queue: z.number().int().nonnegative(),
  toSignOff: z.number().int().nonnegative(),
})

export const boardPropsSchema = z.object({
  revision: z.number().int().nonnegative(),
  now: instant,
  yourTurn: z.array(yourTurnItemSchema),
  working: z.array(workingItemSchema),
  queue: z.array(queueItemSchema),
  backlog: z.array(backlogItemSchema),
  toSignOff: z.array(toSignOffItemSchema),
  signedOff: z.array(signedOffItemSchema).max(10),
  sessions: z.array(sessionItemSchema),
  /** The live workers a task can be assigned to. The server always sends it. */
  workers: z.array(workerSchema).optional(),
  counts: boardCountsSchema,
})

/**
 * The task an action of yours changed, as it now stands: what the view
 * cannot read from the board alone, such as a new task's id.
 */
export const actedSchema = z.object({
  task: taskRefSchema,
  status: z.enum(['backlog', 'queue', 'active', 'done']),
  position: z.number().int().positive().nullable(),
})

/**
 * What each of your actions returns: the fresh board, and the task acted on.
 */
export const actionResultSchema = boardPropsSchema.extend({ acted: actedSchema })

export const unchangedSchema = z.object({
  changed: z.literal(false),
  revision: z.number().int().nonnegative(),
})

export const getBoardResultSchema = z.union([unchangedSchema, boardPropsSchema])

export type Worker = z.infer<typeof workerSchema>
export type TaskRef = z.infer<typeof taskRefSchema>
export type Pip = z.infer<typeof pipSchema>
export type YourTurnItem = z.infer<typeof yourTurnItemSchema>
export type WorkingItem = z.infer<typeof workingItemSchema>
export type QueueItem = z.infer<typeof queueItemSchema>
export type BacklogItem = z.infer<typeof backlogItemSchema>
export type ToSignOffItem = z.infer<typeof toSignOffItemSchema>
export type SignedOffItem = z.infer<typeof signedOffItemSchema>
export type SessionItem = z.infer<typeof sessionItemSchema>
export type BoardCounts = z.infer<typeof boardCountsSchema>
export type BoardProps = z.infer<typeof boardPropsSchema>
export type Acted = z.infer<typeof actedSchema>
export type ActionResult = z.infer<typeof actionResultSchema>
export type Unchanged = z.infer<typeof unchangedSchema>
export type GetBoardResult = z.infer<typeof getBoardResultSchema>
