import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { isRefusal } from '../../../domain/refusal.js'
import type { Owner } from '../../../domain/types.js'
import { INSTRUCTIONS, TOOL_DESCRIPTIONS } from '../../../server/instructions.js'
import { readBoardProps } from '../../../server/props/board.js'
import {
  boardSummary,
  estimateTokens,
  SUMMARY_TOKEN_BUDGET,
} from '../../../server/text/board_summary.js'
import { addTaskText, claimStepText } from '../../../server/text/model_tools.js'
import { resolveWorker } from '../../../server/tools/workers.js'
import { boardPropsSchema } from '../../../shared/props.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import {
  addTask,
  askYou,
  claimStep,
  completeStep,
  type ServiceResult,
} from '../../../store/services.js'
import { registerLiveness, touchSession } from '../../../store/sessions.js'
import { at, textForm } from '../support/domain.js'

const A = 'session-a'
const B = 'session-b'

let directory: string
let database: Database
let clock: number
const now = () => at(clock)

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-assigned-props-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now })
  touch('dedicated', null, 'dedicated')
  touch(A, '/w/api-server')
  touch(B, '/w/web-client')
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function done<T>(result: ServiceResult<T>): T {
  if (isRefusal(result)) throw new Error(result.sentence)
  return result.value
}

function touch(id: string, project: string | null, kind: 'worker' | 'dedicated' = 'worker') {
  done(touchSession(database, { id, kind, projectDir: project }, now(), 1))
}

function add(title: string, owners: Owner[], assignTo?: string, queue = true) {
  const steps = owners.map((owner, index) => ({ title: `${title} ${index + 1}`, owner }))
  return done(addTask(database, 'you', now(), { title, steps, queue, assignTo })).state.task.id
}

const API_SERVER = { id: A, name: 'api-server' }

describe('Board props with assignment', () => {
  test('every task reference carries assignedTo, and the props list the live workers', () => {
    const queued = add('Queued', ['agent'], A)
    const backlog = add('Backlog', ['agent'], A, false)
    const working = add('Working', ['agent', 'agent'], A)
    const asking = add('Asking', ['agent'], A)
    const plain = add('Plain', ['agent'])
    done(claimStep(database, A, now(), working))
    done(claimStep(database, A, now(), asking))
    done(askYou(database, A, now(), asking, textForm('Which?')))
    const signOff = add('Sign off', ['agent'], B)
    done(claimStep(database, B, now(), signOff))
    done(completeStep(database, B, now(), signOff, { summary: 'Did it' }))

    const props = boardPropsSchema.parse(readBoardProps(database, now()))
    const assigned = (id: number) =>
      [...props.yourTurn, ...props.working, ...props.queue, ...props.backlog, ...props.toSignOff]
        .map((item) => item.task)
        .find((task) => task.id === String(id))?.assignedTo

    expect(assigned(queued)).toEqual(API_SERVER)
    expect(assigned(backlog)).toEqual(API_SERVER)
    expect(assigned(working)).toEqual(API_SERVER)
    expect(assigned(asking)).toEqual(API_SERVER)
    expect(assigned(signOff)).toEqual({ id: B, name: 'web-client' })
    expect(assigned(plain)).toBeNull()
    const holding = props.sessions.find((session) => session.id === A)?.holding
    expect(holding?.task.assignedTo).toEqual(API_SERVER)
    expect(props.workers).toEqual([API_SERVER, { id: B, name: 'web-client' }])
  })

  test('workers lists only live workers, and an ended worker’s tasks are unassigned', () => {
    const id = add('Queued', ['agent'], A)
    clock = 100
    touch(B, '/w/web-client')
    clock = 200
    touch(B, '/w/web-client')
    const props = readBoardProps(database, now())
    expect(props.workers).toEqual([{ id: B, name: 'web-client' }])
    expect(props.queue.find((item) => item.task.id === String(id))?.task.assignedTo).toBeNull()
  })

  test('the summary shows the arrow after an assigned task in each list', () => {
    add('Queued', ['agent'], A)
    add('Backlog', ['agent'], A, false)
    const working = add('Working', ['agent'], B)
    done(claimStep(database, B, now(), working))
    add('Plain', ['agent'])

    const lines = boardSummary(readBoardProps(database, now())).split('\n')
    expect(lines[2]).toContain(`T-003 → web-client step 1 "Working 1"`)
    expect(lines[3]).toBe(
      'Queue (2): 1. T-001 "Queued" → api-server next: agent · 2. T-004 "Plain" next: agent'
    )
    expect(lines[4]).toBe('Backlog (1): T-002 → api-server')
  })

  test('the summary stays within its budget with 100 assigned tasks and long names', () => {
    const name = 'n'.repeat(40)
    for (let index = 0; index < 10; index++) {
      touch(`w-${index}`, `/w/${name}${index}`)
    }
    for (let index = 0; index < 100; index++) {
      add('x'.repeat(198), ['agent', 'you'], `w-${index % 10}`, index % 2 === 0)
    }
    const summary = boardSummary(readBoardProps(database, now()))
    expect(estimateTokens(summary)).toBeLessThan(SUMMARY_TOKEN_BUDGET)
    expect(summary).toContain('→ n')
  })
})

describe('Texts with assignment', () => {
  test('add_task names the worker, and claim_step says when the task is assigned to the caller', () => {
    const id = add('Queued', ['agent'], A)
    const claimed = done(claimStep(database, A, now(), id)).state
    expect(claimStepText(claimed, A)).toContain('T-001 is assigned to you')
    expect(claimStepText(claimed, B)).not.toContain('assigned to you')
    const backlog = done(
      addTask(database, 'you', now(), {
        title: 'Later',
        steps: [{ title: 'Do', owner: 'agent' }],
        queue: false,
        assignTo: A,
      })
    ).state
    expect(addTaskText(backlog, 'api-server')).toBe(
      'Added T-002 to the backlog. It is assigned to api-server'
    )
    const queued = done(
      addTask(database, 'you', now(), {
        title: 'Next',
        steps: [{ title: 'Do', owner: 'agent' }],
        assignTo: A,
      })
    ).state
    expect(addTaskText(queued, 'api-server')).toBe(
      'Added T-003 to the queue at position 1. It is assigned to api-server'
    )
  })

  test('resolveWorker matches a live worker by id or by name in any case', () => {
    expect(resolveWorker(database, now(), A)).toEqual(API_SERVER)
    expect(resolveWorker(database, now(), 'API-Server')).toEqual(API_SERVER)
    expect(resolveWorker(database, now(), 'dedicated')).toEqual({
      code: 'invalid',
      sentence:
        '“dedicated” is not a live worker. Live workers: api-server (session-a), web-client (session-b)',
    })
    touch('session-c', '/w/api-server')
    expect(resolveWorker(database, now(), 'api-server')).toEqual({
      code: 'invalid',
      sentence:
        '“api-server” names 2 live workers. Pass one of their ids as assign_to: api-server (session-a), api-server (session-c)',
    })
  })

  test('the instructions and descriptions teach waiting for work and assigning', () => {
    expect(INSTRUCTIONS.worker).toContain(
      'call wait_for_work, and keep calling it until it returns work'
    )
    expect(INSTRUCTIONS.dedicated).toContain(
      'add_task can assign the task to one live worker by name'
    )
    expect(INSTRUCTIONS.dedicated).not.toContain('wait_for_work')
    expect(TOOL_DESCRIPTIONS.worker.wait_for_work).toContain('Returns')
    expect(TOOL_DESCRIPTIONS.worker.add_task).toContain('assign_to')
    expect(TOOL_DESCRIPTIONS.dedicated.wait_for_work).toContain('This chat does not wait')
  })
})
