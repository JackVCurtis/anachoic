import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkBoard, taskViolations } from '../../../domain/invariants.js'
import { isRefusal } from '../../../domain/refusal.js'
import type { StepInput } from '../../../domain/types.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { readBoard, readTask } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import {
  addFollowUp,
  addTask,
  claimStep,
  completeMyStep,
  completeStep,
  type Acted,
  type ServiceResult,
} from '../../../store/services.js'
import { registerLiveness, touchSession } from '../../../store/sessions.js'
import { isWebAddress } from '../../../shared/output_format.js'
import { at } from '../support/domain.js'
import { allTaskStates } from '../support/store.js'

const A = 'session-a'

let directory: string
let database: Database
let clock: number
const now = () => at(clock)

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-formats-'))
  database = openDatabase(join(directory, 'board.sqlite'))
  clock = 0
  registerLiveness(database, { now })
  touchSession(database, { id: A, kind: 'worker', projectDir: '/w/api-server' }, now(), 1)
})

afterEach(() => {
  closeDatabase(database)
  rmSync(directory, { recursive: true, force: true })
})

function ok(result: ServiceResult): Acted {
  if (isRefusal(result)) expect.fail(`Refused with ${result.code}: ${result.sentence}`)
  read(database, (sqlite) => checkBoard(allTaskStates(sqlite)))
  return result.value
}

function storedStep(taskId: number, number: number) {
  return readTask(database, taskId)!.state.steps[number - 1]
}

/**
 * T-1: an agent step, then your step with a pull request format, then an
 * agent step. Your step is waiting on you when this returns.
 */
function reviewTask(): number {
  const added = ok(
    addTask(database, 'you', now(), {
      title: 'Ship the fix',
      steps: [
        { title: 'Open the PR', owner: 'agent' },
        { title: 'Review the PR', owner: 'you', outputFormat: 'pull_request' },
        { title: 'Merge', owner: 'agent' },
      ],
    })
  )
  ok(claimStep(database, A, now()))
  ok(completeStep(database, A, now(), added.state.task.id, { summary: 'Opened' }))
  expect(storedStep(added.state.task.id, 2).status).toBe('waiting')
  return added.state.task.id
}

describe('Declaring an output format', () => {
  test('your steps may declare one, and every read returns it with an empty artifact', () => {
    const id = reviewTask()
    expect(storedStep(id, 1)).toMatchObject({ outputFormat: null, artifactUrl: null })
    expect(storedStep(id, 2)).toMatchObject({ outputFormat: 'pull_request', artifactUrl: null })
    const board = readBoard(database, now())
    expect(board.tasks[0].steps.map((step) => step.outputFormat)).toEqual([
      null,
      'pull_request',
      null,
    ])
  })

  test.each<[string, (steps: StepInput[]) => ServiceResult]>([
    ['Add', (steps) => addTask(database, 'you', now(), { title: 'T', steps, queue: false })],
    ['Add to queue', (steps) => addTask(database, 'you', now(), { title: 'T', steps })],
  ])('%s refuses a format on an agent step', (_name, run) => {
    expect(run([{ title: 'Write', owner: 'agent', outputFormat: 'document' }])).toEqual({
      code: 'invalid',
      sentence: 'Only your steps can declare an output format',
    })
    expect(readBoard(database, now()).tasks).toEqual([])
  })

  test('Follow-up accepts a format on your step and refuses one on an agent step', () => {
    const added = ok(
      addTask(database, 'you', now(), { title: 'T', steps: [{ title: 'Do', owner: 'agent' }] })
    )
    const id = added.state.task.id
    ok(claimStep(database, A, now()))
    ok(completeStep(database, A, now(), id, { summary: 'Done' }))

    expect(
      addFollowUp(database, 'you', now(), id, {
        placement: 'last',
        steps: [{ title: 'More', owner: 'agent', outputFormat: 'ticket' }],
      })
    ).toEqual({ code: 'invalid', sentence: 'Only your steps can declare an output format' })

    ok(
      addFollowUp(database, 'you', now(), id, {
        placement: 'last',
        steps: [{ title: 'File it', owner: 'you', outputFormat: 'ticket' }],
      })
    )
    expect(storedStep(id, 2)).toMatchObject({ outputFormat: 'ticket', status: 'waiting' })
  })

  test('an unknown format is refused', () => {
    const result = addTask(database, 'you', now(), {
      title: 'T',
      steps: [{ title: 'Do', owner: 'you', outputFormat: 'slides' as never }],
    })
    expect(result).toMatchObject({ code: 'invalid' })
  })
})

describe('Marking a formatted step done', () => {
  test('without a URL it is refused with the format it needs', () => {
    const id = reviewTask()
    for (const artifactUrl of [undefined, null, '', '   ']) {
      expect(completeMyStep(database, 'you', now(), id, { artifactUrl })).toEqual({
        code: 'invalid',
        sentence: 'Step 2 of T-001 needs a pull request link',
      })
    }
    expect(storedStep(id, 2)).toMatchObject({ status: 'waiting', artifactUrl: null })
  })

  test('each format names the link it needs', () => {
    const needs: Array<[StepInput['outputFormat'], string]> = [
      ['ticket', 'a ticket link'],
      ['document', 'a document link'],
      ['link', 'a link'],
    ]
    for (const [outputFormat, needed] of needs) {
      const { state } = ok(
        addTask(database, 'you', now(), {
          title: 'T',
          steps: [{ title: 'Write', owner: 'you', outputFormat }],
        })
      )
      expect(completeMyStep(database, 'you', now(), state.task.id, {})).toEqual({
        code: 'invalid',
        sentence: `Step 1 of T-00${state.task.id} needs ${needed}`,
      })
    }
  })

  test('with an invalid URL it is refused and nothing changes', () => {
    const id = reviewTask()
    for (const artifactUrl of [
      'ftp://example.com/pr/1',
      '/pulls/12',
      'javascript:alert(1)',
      `https://example.com/${'a'.repeat(2001 - 'https://example.com/'.length)}`,
      'not a url',
    ]) {
      expect(completeMyStep(database, 'you', now(), id, { artifactUrl })).toEqual({
        code: 'invalid',
        sentence: 'That is not a web address',
      })
    }
    expect(storedStep(id, 2)).toMatchObject({ status: 'waiting', artifactUrl: null })
  })

  test('with a valid URL the step is done and the URL stored with it', () => {
    const id = reviewTask()
    const url = 'https://github.com/acme/api/pull/12'
    const { state } = ok(
      completeMyStep(database, 'you', now(), id, { artifactUrl: url, note: 'Two nits' })
    )
    expect(state.steps[1]).toMatchObject({ status: 'done', artifactUrl: url, note: 'Two nits' })
    expect(storedStep(id, 2)).toMatchObject({ status: 'done', artifactUrl: url })
    expect(readTask(database, id)!.state.task.status).toBe('queue')
  })

  test('an http URL is accepted too', () => {
    const id = reviewTask()
    ok(completeMyStep(database, 'you', now(), id, { artifactUrl: 'http://tickets.local/T-9' }))
    expect(storedStep(id, 2).artifactUrl).toBe('http://tickets.local/T-9')
  })
})

describe('Marking a step with no format done', () => {
  test('a URL given anyway is ignored, even an invalid one', () => {
    for (const artifactUrl of ['https://example.com/x', 'javascript:alert(1)']) {
      const { state } = ok(
        addTask(database, 'you', now(), { title: 'T', steps: [{ title: 'Check', owner: 'you' }] })
      )
      ok(completeMyStep(database, 'you', now(), state.task.id, { artifactUrl }))
      expect(storedStep(state.task.id, 1)).toMatchObject({ status: 'done', artifactUrl: null })
    }
  })
})

describe('isWebAddress', () => {
  test.each([
    ['https://example.com', true],
    ['http://example.com/a?b=c#d', true],
    [`https://e.com/${'a'.repeat(2000 - 'https://e.com/'.length)}`, true],
    [`https://e.com/${'a'.repeat(2001 - 'https://e.com/'.length)}`, false],
    ['ftp://example.com', false],
    ['/relative/path', false],
    ['javascript:alert(1)', false],
    ['mailto:a@b.c', false],
    ['', false],
  ])('%s → %s', (url, expected) => {
    expect(isWebAddress(url)).toBe(expected)
  })
})

describe('The artifact invariant', () => {
  test('an artifact on a step that is not done, or has no format, is a violation', () => {
    const id = reviewTask()
    const state = readTask(database, id)!.state
    const waiting = structuredClone(state)
    waiting.steps[1].artifactUrl = 'https://example.com'
    expect(taskViolations(waiting)).toEqual([
      'T-001: artifact: step 2 has an artifact while waiting',
    ])
    const plain = structuredClone(state)
    plain.steps[0].artifactUrl = 'https://example.com'
    expect(taskViolations(plain)).toEqual([
      'T-001: artifact: step 1 has an artifact while done with no output format',
    ])
  })
})
