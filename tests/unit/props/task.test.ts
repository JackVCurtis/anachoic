import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { isRefusal } from '../../../domain/refusal.js'
import { YOU } from '../../../domain/types.js'
import { taskProps } from '../../../server/props/task.js'
import { blockHistory } from '../../../server/text/model_tools.js'
import { openTaskText } from '../../../server/text/open_task.js'
import { taskPropsSchema, type TaskProps } from '../../../shared/props.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { readTask } from '../../../store/queries.js'
import {
  addTask,
  answerQuestion,
  archiveTask,
  askYou,
  blockStep,
  claimStep,
  completeMyStep,
  completeStep,
  unblockStep,
  updateStep,
  type ServiceResult,
} from '../../../store/services.js'
import { registerLiveness, removeSession, touchSession } from '../../../store/sessions.js'
import { at, typed, textForm } from '../support/domain.js'

const A = 'session-a'
const MINUTE = 60

let directory: string
let database: Database
let clock: number
const now = () => at(clock)

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-task-props-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now })
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function done<T>(result: ServiceResult<T>): T {
  if (isRefusal(result)) throw new Error(result.sentence)
  return result.value
}

/**
 * Moves the clock on a minute at a time, with api-server's heartbeat keeping
 * it live.
 */
function tick(seconds: number) {
  for (let left = seconds; left > 0; left -= MINUTE) {
    clock += Math.min(left, MINUTE)
    done(touchSession(database, { id: A, kind: 'worker', projectDir: '/w/api-server' }, now(), 1))
  }
}

function props(id: number): TaskProps {
  return taskPropsSchema.parse(taskProps(readTask(database, id)!, now()))
}

function text(id: number): string {
  const snapshot = readTask(database, id)!
  return openTaskText(taskProps(snapshot, now()), blockHistory(snapshot.events, now()))
}

/**
 * T-001, assigned to api-server: a pull request step done, the user's review
 * done with a note, then an agent step blocked once and now asking.
 */
function reviewed(): number {
  done(touchSession(database, { id: A, kind: 'worker', projectDir: '/w/api-server' }, now(), 1))
  const id = done(
    addTask(database, YOU, now(), {
      title: 'Add caching',
      assignTo: A,
      steps: [
        {
          title: 'Open the PR',
          owner: 'agent',
          detail: 'Use Redis',
          outputFormat: 'pull_request',
        },
        { title: 'Review the PR', owner: 'you' },
        { title: 'Deploy', owner: 'agent' },
      ],
    })
  ).state.task.id
  done(claimStep(database, A, now(), id))
  tick(5 * MINUTE)
  done(updateStep(database, A, now(), id, { note: 'Halfway' }))
  done(
    completeStep(database, A, now(), id, {
      summary: 'Opened the PR',
      links: [{ label: 'PR 7', url: 'https://example.com/pr/7' }],
      artifactUrl: 'https://example.com/pr/7',
    })
  )
  tick(3 * MINUTE)
  done(completeMyStep(database, YOU, now(), id, { note: 'Looks good' }))
  done(claimStep(database, A, now(), id))
  done(blockStep(database, A, now(), id, 'needs AWS credentials'))
  tick(14 * MINUTE)
  done(unblockStep(database, A, now(), id))
  done(askYou(database, A, now(), id, textForm('Which region?')))
  tick(MINUTE)
  return id
}

describe('the task props', () => {
  test('carry every step in full, with sessions, artifacts, input and times', () => {
    const task = props(reviewed())

    expect(task.task).toMatchObject({
      displayId: 'T-001',
      title: 'Add caching',
      status: 'active',
      list: 'yourTurn',
      createdBy: 'you',
      assignedTo: { id: A, name: 'api-server' },
      resumeWith: null,
      archivedAt: null,
    })
    expect(task.steps.map(({ status, current }) => [status, current])).toEqual([
      ['done', false],
      ['done', false],
      ['waiting', true],
    ])
    expect(task.steps[0]).toMatchObject({
      owner: 'agent',
      detail: 'Use Redis',
      session: { id: A, name: 'api-server', live: true },
      note: 'Halfway',
      summary: 'Opened the PR',
      links: [{ label: 'PR 7', url: 'https://example.com/pr/7' }],
      outputFormat: 'pull_request',
      artifactUrl: 'https://example.com/pr/7',
      input: null,
      elapsedSeconds: 5 * MINUTE,
    })
    expect(task.steps[1]).toMatchObject({
      owner: 'you',
      session: null,
      note: 'Looks good',
      input: { stepNumber: 1, format: 'pull_request', url: 'https://example.com/pr/7' },
      elapsedSeconds: 3 * MINUTE,
    })
    expect(task.steps[2]).toMatchObject({
      form: textForm('Which region?'),
      blocked: null,
      session: { id: A, name: 'api-server' },
      waitingSince: at(22 * MINUTE),
    })
    expect(task.artifacts).toEqual([
      { stepNumber: 1, format: 'pull_request', url: 'https://example.com/pr/7' },
    ])
    expect(task.agentSeconds).toBe(5 * MINUTE)
    // The block waited on the user, so it counts as the user's time.
    expect(task.yourSeconds).toBe(3 * MINUTE + 14 * MINUTE)
    expect(task.canAct).toEqual({ archive: true, park: true })
  })

  test('carry the events in order, by the user or by a named session', () => {
    const task = props(reviewed())
    const kinds = task.events.map(({ kind }) => kind)
    expect(kinds.slice(0, 4)).toEqual(['added', 'assigned', 'queued', 'claimed'])
    expect(kinds).toContain('blocked')
    expect(kinds).toContain('unblocked')
    expect(task.events[0].by).toBe('you')
    expect(task.events.find(({ kind }) => kind === 'claimed')).toMatchObject({
      stepNumber: 1,
      by: { id: A, name: 'api-server', live: true },
      detail: 'Claimed by api-server',
    })
  })

  test('carry a blocked step’s reason and since, and resumeWith when the user has the task', () => {
    done(touchSession(database, { id: A, kind: 'worker', projectDir: '/w/api-server' }, now(), 1))
    const id = done(
      addTask(database, YOU, now(), {
        title: 'Ship',
        steps: [
          { title: 'Build', owner: 'agent' },
          { title: 'Check', owner: 'you' },
        ],
      })
    ).state.task.id
    done(claimStep(database, A, now(), id))
    tick(MINUTE)
    done(blockStep(database, A, now(), id, 'needs a token'))
    expect(props(id).steps[0].blocked).toEqual({ reason: 'needs a token', since: at(MINUTE) })
    expect(props(id).task.list).toBe('yourTurn')

    done(unblockStep(database, A, now(), id))
    done(completeStep(database, A, now(), id, { summary: 'Built' }))
    expect(props(id).task.resumeWith).toEqual({ id: A, name: 'api-server' })
  })

  test('keep the name of a session that was removed', () => {
    const id = reviewed()
    done(answerQuestion(database, YOU, now(), id, typed('eu-west-1')))
    done(removeSession(database, A, now()))
    const task = props(id)
    expect(task.steps[0].session).toEqual({ id: A, name: 'api-server', live: false })
    expect(task.task.assignedTo).toBeNull()
  })

  test('offer no action on an archived task', () => {
    const id = reviewed()
    done(archiveTask(database, YOU, now(), id))
    const task = props(id)
    expect(task.task.list).toBeNull()
    expect(task.canAct).toEqual({ archive: false, park: false })
  })
})

describe('open_task’s text', () => {
  test('gives every step with its history, artifacts and past blocks, and the last 10 events', () => {
    const lines = text(reviewed()).split('\n')
    expect(lines[0]).toBe(
      'T-001 "Add caching", waiting on the user, step 3 of 3, revision ' + props(1).revision
    )
    expect(lines[1]).toBe(
      'Created by user · assigned to api-server · agent time 5m · user time 17m'
    )
    expect(lines).toContain('Steps (3):')
    expect(lines).toContain('1. "Open the PR" (agent, done in 5m, api-server)')
    expect(lines).toContain('   Detail: Use Redis')
    expect(lines).toContain('   Artifact: Pull request https://example.com/pr/7')
    expect(lines).toContain('   Summary: Opened the PR')
    expect(lines).toContain('   Links: PR 7 https://example.com/pr/7')
    expect(lines).toContain('2. "Review the PR" (user, done in 3m)')
    expect(lines).toContain('   Input from step 1: Pull request https://example.com/pr/7')
    expect(lines).toContain('   Note: Looks good')
    expect(lines).toContain('3. "Deploy" (agent, waiting on the user\'s answer 1m, api-server)')
    expect(lines).toContain('   History: blocked 14m: needs AWS credentials')
    expect(lines).toContain('   Question: Which region?')
    const events = lines.slice(lines.findIndex((line) => line.startsWith('Events')))
    expect(events[0]).toMatch(/^Events \(latest 10 of \d+\):$/)
    expect(events).toHaveLength(11)
    expect(events.at(-1)).toMatch(/ asked step 3 \(api-server\): Which region\?$/)
  })

  test('shows a block still open as Blocked, not as history', () => {
    done(touchSession(database, { id: A, kind: 'worker', projectDir: '/w/api-server' }, now(), 1))
    const id = done(
      addTask(database, YOU, now(), { title: 'Ship', steps: [{ title: 'Build', owner: 'agent' }] })
    ).state.task.id
    done(claimStep(database, A, now(), id))
    done(blockStep(database, A, now(), id, 'needs a token'))
    tick(4 * MINUTE)
    const lines = text(id).split('\n')
    expect(lines).toContain('1. "Build" (agent, blocked 4m, api-server)')
    expect(lines).toContain('   Blocked: needs a token')
    expect(lines.some((line) => line.includes('History'))).toBe(false)
  })
})
