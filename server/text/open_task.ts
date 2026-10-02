import { OUTPUT_FORMAT_WORDS } from '../../shared/output_format.js'
import type { TaskEvent, TaskProps, TaskSession, TaskStep } from '../../shared/props.js'
import { CHARS_PER_TOKEN, estimateTokens, since } from './board_summary.js'
import { ownerWord } from './model_tools.js'

/**
 * open_task's text must stay under this many tokens. It is the one text that
 * can be long; the oldest events go first, and every step stays.
 */
export const TASK_TEXT_TOKEN_BUDGET = 8000

/**
 * The text shows at most this many of the latest events.
 */
export const TASK_TEXT_EVENTS = 10

/**
 * When the steps alone exceed the budget, each step's long fields are cut to
 * this many characters, then halved until the text fits, down to the floor.
 */
const FIRST_FIELD_CAP = 1000
const FIELD_FLOOR = 40

const EPOCH = new Date(0).toISOString()

function duration(seconds: number) {
  return since(EPOCH, new Date(seconds * 1000).toISOString())
}

function cut(text: string, length: number) {
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`
}

function who(by: 'you' | TaskSession) {
  return by === 'you' ? 'user' : by.name
}

function where(task: TaskProps['task']): string {
  if (task.archivedAt !== null) return 'archived'
  switch (task.list) {
    case 'yourTurn':
      return 'waiting on the user'
    case 'working':
      return 'working'
    case 'queue':
      return `in the queue at position ${task.queuePosition}`
    case 'backlog':
      return 'in the backlog'
    case 'toSignOff':
      return 'done, to sign off'
    case 'signedOff':
      return 'signed off'
    default:
      return task.status
  }
}

function stepStatus(step: TaskStep, now: string): string {
  switch (step.status) {
    case 'pending':
      return 'not started'
    case 'running': {
      const open = step.runningSince ? Date.parse(now) - Date.parse(step.runningSince) : 0
      return `running ${duration(step.elapsedSeconds + Math.max(0, Math.floor(open / 1000)))}`
    }
    case 'waiting': {
      const waited = step.waitingSince ? ` ${since(step.waitingSince, now)}` : ''
      if (step.blocked) return `blocked${waited}`
      return step.owner === 'agent'
        ? `waiting on the user's answer${waited}`
        : `waiting on the user${waited}`
    }
    case 'done':
      return step.elapsedSeconds > 0 ? `done in ${duration(step.elapsedSeconds)}` : 'done'
  }
}

function stepLines(
  step: TaskStep,
  now: string,
  pastBlocks: readonly string[],
  cap: number
): string[] {
  const field = (text: string) => cut(text, cap)
  const session = step.session ? `, ${step.session.name}` : ''
  const lines = [
    `${step.number}. "${step.title}" (${ownerWord(step.owner)}, ${stepStatus(step, now)}${session})${step.origin === 'follow_up' ? ' [follow-up]' : ''}`,
  ]
  const add = (label: string, text: string | null) => {
    if (text) lines.push(`   ${label}: ${field(text)}`)
  }
  if (step.input) {
    lines.push(
      `   Input from step ${step.input.stepNumber}: ${OUTPUT_FORMAT_WORDS[step.input.format].shown} ${step.input.url}`
    )
  }
  add('Detail', step.detail)
  if (step.outputFormat) {
    lines.push(
      step.artifactUrl
        ? `   Artifact: ${OUTPUT_FORMAT_WORDS[step.outputFormat].shown} ${step.artifactUrl}`
        : `   Produces: ${OUTPUT_FORMAT_WORDS[step.outputFormat].produced}`
    )
  }
  if (step.blocked) lines.push(`   Blocked: ${field(step.blocked.reason)}`)
  if (pastBlocks.length > 0) lines.push(`   History: ${pastBlocks.map(field).join('; ')}`)
  add('Question', step.question)
  add('Answer', step.answer)
  add('Note', step.note)
  add('Summary', step.summary)
  if (step.links.length > 0) {
    lines.push(`   Links: ${step.links.map(({ label, url }) => `${label} ${url}`).join('; ')}`)
  }
  return lines
}

function eventLine(event: TaskEvent, cap: number) {
  const at = `${event.at.slice(0, 16).replace('T', ' ')}Z`
  const step = event.stepNumber === null ? '' : ` step ${event.stepNumber}`
  return `${at} ${event.kind}${step} (${who(event.by)}): ${cut(event.detail, cap)}`
}

/**
 * open_task's text: the task in full, with every step's status, session,
 * input, detail, artifact, block, question, answer, note, summary and links,
 * and the last 10 events. `blocks` holds each step's past blocks by step id,
 * as blockHistory gives them. The text stays under TASK_TEXT_TOKEN_BUDGET by
 * dropping the oldest events first, then by cutting each step's long fields.
 */
export function openTaskText(
  props: TaskProps,
  blocks: ReadonlyMap<string, readonly string[]> = new Map()
): string {
  const { task, steps, now } = props
  const current = steps.find((step) => step.current)
  const head = [
    `${task.displayId} "${task.title}", ${where(task)}${current && task.status !== 'done' ? `, step ${current.number} of ${steps.length}` : ''}, revision ${props.revision}`,
    [
      `Created by ${who(task.createdBy)}`,
      ...(task.assignedTo ? [`assigned to ${task.assignedTo.name}`] : []),
      ...(task.resumeWith ? [`hands back to ${task.resumeWith.name}`] : []),
      `agent time ${duration(props.agentSeconds)}`,
      `user time ${duration(props.yourSeconds)}`,
    ].join(' · '),
  ]
  const latest = props.events.slice(-TASK_TEXT_EVENTS)

  const render = (cap: number, events: readonly TaskEvent[]) => {
    const pastBlocks = (step: TaskStep) => {
      const past = blocks.get(step.id) ?? []
      // The open block, if any, is shown as "Blocked" rather than as history.
      return step.blocked ? past.slice(0, -1) : past
    }
    const eventsHead =
      events.length === props.events.length
        ? `Events (${events.length}):`
        : `Events (latest ${events.length} of ${props.events.length}):`
    return [
      ...head,
      `Steps (${steps.length}):`,
      ...steps.flatMap((step) => stepLines(step, now, pastBlocks(step), cap)),
      ...(props.events.length === 0
        ? ['Events: none']
        : [eventsHead, ...events.map((event) => eventLine(event, cap))]),
    ].join('\n')
  }

  const fits = (text: string) => estimateTokens(text) < TASK_TEXT_TOKEN_BUDGET
  let events = latest
  let text = render(Infinity, events)
  while (!fits(text) && events.length > 0) {
    events = events.slice(1)
    text = render(Infinity, events)
  }
  for (let cap = FIRST_FIELD_CAP; !fits(text) && cap >= FIELD_FLOOR; cap = Math.floor(cap / 2)) {
    text = render(cap, events)
  }
  return fits(text) ? text : cut(text, TASK_TEXT_TOKEN_BUDGET * CHARS_PER_TOKEN - 4)
}
