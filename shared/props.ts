import { z } from 'zod'
import { OUTPUT_FORMATS } from './output_format.js'

/**
 * The props the server sends the views, as zod schemas the server checks its
 * results against. The view imports only the types, so zod stays out of it.
 */

const instant = z.string().describe('An ISO 8601 instant')

export const ownerSchema = z.enum(['agent', 'you'])

export const stepStatusSchema = z.enum(['pending', 'running', 'waiting', 'done'])

export const outputFormatSchema = z.enum(OUTPUT_FORMATS)

/**
 * A link to the artifact a done step with an output format produced.
 */
export const artifactSchema = z.object({
  stepNumber: z.number().int().positive(),
  format: outputFormatSchema,
  url: z.string(),
})

/**
 * A task's artifacts, by step number. Absent when it has none.
 */
const artifacts = z.array(artifactSchema).optional()

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
  /** Present only on steps that declare an output format. */
  outputFormat: outputFormatSchema.optional(),
  /** Present only once such a step is done. */
  artifactUrl: z.string().optional(),
})

const pips = z.array(pipSchema)

export const yourTurnItemSchema = z.object({
  task: taskRefSchema,
  step: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    owner: ownerSchema,
    question: z.string().optional(),
    outputFormat: outputFormatSchema.optional(),
    waitingSince: instant,
  }),
  session: z.object({ id: z.string(), name: z.string() }).optional(),
  /**
   * Set when the worker in `session` blocked its step: why, and since when.
   * It is unblocked in that worker's session, never on the board. The server
   * always sends it.
   */
  blocked: z.object({ reason: z.string(), since: instant }).nullable().optional(),
  /**
   * On a user step's item: the previous step's artifact, which this step
   * takes as its input, or null when it produced none. Absent on an agent
   * step's item.
   */
  input: artifactSchema.nullable().optional(),
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
    /** What the running step must produce, when it declares an output format. */
    outputFormat: outputFormatSchema.optional(),
    runningSince: instant,
  }),
  session: z.object({ id: z.string(), name: z.string() }),
  steps: pips,
  artifacts,
})

export const queueItemSchema = z.object({
  task: taskRefSchema,
  position: z.number().int().positive(),
  nextOwner: ownerSchema,
  steps: pips,
  artifacts,
  canAct: z.object({ reorder: z.boolean(), backlog: z.boolean() }),
})

export const backlogItemSchema = z.object({
  task: taskRefSchema,
  steps: pips,
  artifacts,
  canAct: z.object({ queue: z.boolean(), archive: z.boolean() }),
})

export const toSignOffItemSchema = z.object({
  task: taskRefSchema,
  finishedAt: instant,
  agentSeconds: z.number().int().nonnegative(),
  yourSeconds: z.number().int().nonnegative(),
  linkCount: z.number().int().nonnegative(),
  steps: pips,
  artifacts,
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
      /** waiting: on your answer; blocked: until you act with the session. */
      status: z.enum(['running', 'waiting', 'blocked']),
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

/**
 * A session the task view names, with whether it is live now. A session that
 * was removed keeps its name here.
 */
export const taskSessionSchema = z.object({ id: z.string(), name: z.string(), live: z.boolean() })

/**
 * One step of the task in full. `session` is the session holding the step
 * while it runs or waits, and for a done agent step the session that
 * completed it; null otherwise and on user steps.
 */
export const taskStepSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  owner: ownerSchema,
  title: z.string(),
  detail: z.string().nullable(),
  status: stepStatusSchema,
  origin: z.enum(['chain', 'follow_up']),
  /** The task's current step: the first not done, else the last. */
  current: z.boolean(),
  session: taskSessionSchema.nullable(),
  /** An agent's question, while the step waits on it. */
  question: z.string().nullable(),
  /** The user's answer to the latest question, until the agent collects it. */
  answer: z.string().nullable(),
  note: z.string().nullable(),
  summary: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  outputFormat: outputFormatSchema.nullable(),
  artifactUrl: z.string().nullable(),
  /** The previous step's artifact, which this step takes as its input, or null. */
  input: artifactSchema.nullable(),
  /** Set while the step's worker has blocked it: why, and since when. */
  blocked: z.object({ reason: z.string(), since: instant }).nullable(),
  startedAt: instant.nullable(),
  /** The start of the open running interval, while the step runs. */
  runningSince: instant.nullable(),
  /** The start of the open waiting interval, while the step waits. */
  waitingSince: instant.nullable(),
  finishedAt: instant.nullable(),
  /** Closed intervals of work: running, for an agent step; waiting on the user, for a user step. */
  elapsedSeconds: z.number().int().nonnegative(),
  /** Agent steps: closed intervals spent waiting on the user. */
  waitedSeconds: z.number().int().nonnegative(),
})

/**
 * One entry of the task's event log. `by` is 'you' when the user acted, else
 * the session that did.
 */
export const taskEventSchema = z.object({
  id: z.number().int(),
  at: instant,
  kind: z.string(),
  /** The step the event names, by number, or null for the whole task. */
  stepNumber: z.number().int().positive().nullable(),
  by: z.union([z.literal('you'), taskSessionSchema]),
  detail: z.string(),
})

/**
 * One task in full, for the task view and the board's task panel.
 */
export const taskPropsSchema = z.object({
  revision: z.number().int().nonnegative(),
  now: instant,
  task: taskRefSchema.extend({
    status: z.enum(['backlog', 'queue', 'active', 'done']),
    /** The board list the task is in, or null once archived. */
    list: z.enum(['yourTurn', 'working', 'queue', 'backlog', 'toSignOff', 'signedOff']).nullable(),
    queuePosition: z.number().int().positive().nullable(),
    createdBy: z.union([z.literal('you'), taskSessionSchema]),
    createdAt: instant,
    finishedAt: instant.nullable(),
    signedOffAt: instant.nullable(),
    archivedAt: instant.nullable(),
    /** The worker that handed the task to the user and gets it back. */
    resumeWith: workerSchema.nullable(),
  }),
  steps: z.array(taskStepSchema),
  /** Closed intervals on the agent's steps, and the user's: as the board's toSignOff items. */
  agentSeconds: z.number().int().nonnegative(),
  yourSeconds: z.number().int().nonnegative(),
  artifacts: z.array(artifactSchema),
  /** Every event of the task, oldest first. */
  events: z.array(taskEventSchema),
  /** For each action the task view offers, whether the domain would accept it now. */
  canAct: z.object({ archive: z.boolean(), park: z.boolean() }),
})

export const getTaskResultSchema = z.union([unchangedSchema, taskPropsSchema])

export type OutputFormat = z.infer<typeof outputFormatSchema>
export type Artifact = z.infer<typeof artifactSchema>
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
export type TaskSession = z.infer<typeof taskSessionSchema>
export type TaskStep = z.infer<typeof taskStepSchema>
export type TaskEvent = z.infer<typeof taskEventSchema>
export type TaskProps = z.infer<typeof taskPropsSchema>
export type GetTaskResult = z.infer<typeof getTaskResultSchema>
