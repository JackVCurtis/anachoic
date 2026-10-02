import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkBoard, taskViolations } from '../../../domain/invariants.js'
import { inputOf } from '../../../domain/derived.js'
import { isRefusal } from '../../../domain/refusal.js'
import type { StepInput } from '../../../domain/types.js'
import { closeDatabase, openDatabase, type Database } from '../../../store/database.js'
import { readBoard, readTask } from '../../../store/queries.js'
import { read } from '../../../store/read.js'
import { write } from '../../../store/write.js'
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
 * T-1: an agent step with a pull request format, then your step, then an
 * agent step. A holds step 1, running, when this returns.
 */
function prTask(): number {
  const added = ok(
    addTask(database, 'you', now(), {
      title: 'Ship the fix',
      steps: [
        { title: 'Open the PR', owner: 'agent', outputFormat: 'pull_request' },
        { title: 'Review the PR', owner: 'you' },
        { title: 'Merge', owner: 'agent' },
      ],
    })
  )
  ok(claimStep(database, A, now()))
  expect(storedStep(added.state.task.id, 1).status).toBe('running')
  return added.state.task.id
}

function complete(id: number, artifactUrl?: string | null) {
  return completeStep(database, A, now(), id, { summary: 'Opened', artifactUrl })
}

describe('Declaring an output format', () => {
  test('agent steps may declare one, and every read returns it with an empty artifact', () => {
    const id = prTask()
    expect(storedStep(id, 1)).toMatchObject({ outputFormat: 'pull_request', artifactUrl: null })
    expect(storedStep(id, 2)).toMatchObject({ outputFormat: null, artifactUrl: null })
    const board = readBoard(database, now())
    expect(board.tasks[0].steps.map((step) => step.outputFormat)).toEqual([
      'pull_request',
      null,
      null,
    ])
  })

  test.each<[string, (steps: StepInput[]) => ServiceResult]>([
    ['Add', (steps) => addTask(database, 'you', now(), { title: 'T', steps, queue: false })],
    ['Add to queue', (steps) => addTask(database, 'you', now(), { title: 'T', steps })],
  ])('%s refuses a format on a user step', (_name, run) => {
    expect(run([{ title: 'Review', owner: 'you', outputFormat: 'document' }])).toEqual({
      code: 'invalid',
      sentence: 'Only agent steps can declare an output format',
    })
    expect(readBoard(database, now()).tasks).toEqual([])
  })

  test('Follow-up accepts a format on an agent step and refuses one on a user step', () => {
    const added = ok(
      addTask(database, 'you', now(), { title: 'T', steps: [{ title: 'Do', owner: 'agent' }] })
    )
    const id = added.state.task.id
    ok(claimStep(database, A, now()))
    ok(completeStep(database, A, now(), id, { summary: 'Done' }))

    expect(
      addFollowUp(database, 'you', now(), id, {
        placement: 'last',
        steps: [{ title: 'Check it', owner: 'you', outputFormat: 'ticket' }],
      })
    ).toEqual({ code: 'invalid', sentence: 'Only agent steps can declare an output format' })

    ok(
      addFollowUp(database, 'you', now(), id, {
        placement: 'last',
        steps: [{ title: 'File it', owner: 'agent', outputFormat: 'ticket' }],
      })
    )
    expect(storedStep(id, 2)).toMatchObject({ outputFormat: 'ticket', status: 'pending' })
  })

  test('an unknown format is refused', () => {
    const result = addTask(database, 'you', now(), {
      title: 'T',
      steps: [{ title: 'Do', owner: 'agent', outputFormat: 'slides' as never }],
    })
    expect(result).toMatchObject({ code: 'invalid' })
  })
})

describe('Completing a formatted agent step', () => {
  test('without a URL it is refused with the format it needs', () => {
    const id = prTask()
    for (const artifactUrl of [undefined, null, '', '   ']) {
      expect(complete(id, artifactUrl)).toEqual({
        code: 'invalid',
        sentence: 'Step 1 of T-001 needs a pull request link (artifact_url)',
      })
    }
    expect(storedStep(id, 1)).toMatchObject({ status: 'running', artifactUrl: null })
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
          steps: [{ title: 'Write', owner: 'agent', outputFormat }],
        })
      )
      ok(claimStep(database, A, now(), state.task.id))
      expect(completeStep(database, A, now(), state.task.id, { summary: 'Done' })).toEqual({
        code: 'invalid',
        sentence: `Step 1 of T-00${state.task.id} needs ${needed} (artifact_url)`,
      })
    }
  })

  test('with an invalid URL it is refused and nothing changes', () => {
    const id = prTask()
    for (const artifactUrl of [
      'ftp://example.com/pr/1',
      '/pulls/12',
      'javascript:alert(1)',
      `https://example.com/${'a'.repeat(2001 - 'https://example.com/'.length)}`,
      'not a url',
    ]) {
      expect(complete(id, artifactUrl)).toEqual({
        code: 'invalid',
        sentence: 'That is not a web address',
      })
    }
    expect(storedStep(id, 1)).toMatchObject({ status: 'running', artifactUrl: null })
  })

  test('with a valid URL the step is done and the URL stored with it', () => {
    const id = prTask()
    const url = 'https://github.com/acme/api/pull/12'
    const { state } = ok(complete(id, url))
    expect(state.steps[0]).toMatchObject({ status: 'done', artifactUrl: url, summary: 'Opened' })
    expect(storedStep(id, 1)).toMatchObject({ status: 'done', artifactUrl: url })
    expect(storedStep(id, 2).status).toBe('waiting')
  })

  test('an http URL is accepted too', () => {
    const id = prTask()
    ok(complete(id, 'http://tickets.local/T-9'))
    expect(storedStep(id, 1).artifactUrl).toBe('http://tickets.local/T-9')
  })
})

describe('Completing a step with no format', () => {
  test('a URL given anyway to an agent step is ignored, even an invalid one', () => {
    for (const artifactUrl of ['https://example.com/x', 'javascript:alert(1)']) {
      const { state } = ok(
        addTask(database, 'you', now(), { title: 'T', steps: [{ title: 'Do', owner: 'agent' }] })
      )
      ok(claimStep(database, A, now(), state.task.id))
      ok(completeStep(database, A, now(), state.task.id, { summary: 'Done', artifactUrl }))
      expect(storedStep(state.task.id, 1)).toMatchObject({ status: 'done', artifactUrl: null })
    }
  })

  test('marking a user step done takes no URL', () => {
    const id = prTask()
    ok(complete(id, 'https://github.com/acme/api/pull/12'))
    const { state } = ok(completeMyStep(database, 'you', now(), id, { note: 'Two nits' }))
    expect(state.steps[1]).toMatchObject({ status: 'done', artifactUrl: null, note: 'Two nits' })
  })

  test('a user step that carries a format from before is never required to have a URL', () => {
    const { state } = ok(
      addTask(database, 'you', now(), { title: 'T', steps: [{ title: 'Review', owner: 'you' }] })
    )
    write(database, (sqlite) =>
      sqlite
        .prepare("UPDATE steps SET output_format = 'pull_request' WHERE task_id = ?")
        .run(state.task.id)
    )
    expect(storedStep(state.task.id, 1).outputFormat).toBe('pull_request')
    ok(completeMyStep(database, 'you', now(), state.task.id))
    expect(storedStep(state.task.id, 1)).toMatchObject({
      status: 'done',
      outputFormat: 'pull_request',
      artifactUrl: null,
    })
  })
})

describe('inputOf', () => {
  test("is the previous step's artifact once it is done", () => {
    const id = prTask()
    const url = 'https://github.com/acme/api/pull/12'
    const before = readTask(database, id)!.state.steps
    expect(inputOf(before, before[1])).toBeNull()
    ok(complete(id, url))
    const steps = readTask(database, id)!.state.steps
    expect(inputOf(steps, steps[1])).toEqual({ stepNumber: 1, format: 'pull_request', url })
  })

  test('is null for the first step, after a step with no format, and two steps on', () => {
    const id = prTask()
    ok(complete(id, 'https://github.com/acme/api/pull/12'))
    ok(completeMyStep(database, 'you', now(), id))
    const steps = readTask(database, id)!.state.steps
    expect(inputOf(steps, steps[0])).toBeNull()
    expect(inputOf(steps, steps[2])).toBeNull()
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
    const id = prTask()
    const running = structuredClone(readTask(database, id)!.state)
    running.steps[0].artifactUrl = 'https://example.com'
    expect(taskViolations(running)).toEqual([
      'T-001: artifact: step 1 has an artifact while running',
    ])
    ok(complete(id, 'https://example.com/pr/1'))
    const plain = structuredClone(readTask(database, id)!.state)
    plain.steps[1].artifactUrl = 'https://example.com'
    expect(taskViolations(plain)).toEqual([
      'T-001: artifact: step 2 has an artifact while waiting with no output format',
    ])
  })
})
