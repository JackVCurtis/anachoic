import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { closeDatabase, openDatabase } from '../../../store/database.js'
import { MIGRATIONS } from '../../../store/migrations.js'
import { loadTaskState } from '../../../store/rows.js'
import { answerQuestion, collectAnswer } from '../../../store/services.js'
import { at } from '../support/domain.js'

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'anachoic-forms-'))
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('The question forms migration', () => {
  test('turns an open question from before into a form of one text page that can be answered', () => {
    const file = join(directory, 'old.sqlite')
    const raw = new DatabaseSync(file)
    for (const migration of MIGRATIONS.slice(0, 8)) raw.exec(migration)
    raw.exec('PRAGMA user_version = 8')
    const question = `Which region? ${'x'.repeat(400)}`
    raw
      .prepare(
        `INSERT INTO sessions (id, kind, name, pid, first_seen_at, last_seen_at)
           VALUES ('session-a', 'worker', 'api-server', 1, :at, :at)`
      )
      .run({ at: at(0) })
    raw.exec(
      `INSERT INTO tasks (id, title, status, created_by, created_at) VALUES (1, 'Old', 'active', 'you', '${at(0)}');`
    )
    raw
      .prepare(
        `INSERT INTO steps (id, task_id, number, owner, title, status, origin, claimed_by, question,
           started_at, waiting_since)
         VALUES ('1.1', 1, 1, 'agent', 'Pick', 'waiting', 'chain', 'session-a', :question, :at, :at)`
      )
      .run({ question, at: at(0) })
    raw.close()

    const database = openDatabase(file)
    try {
      const state = loadTaskState(database.sqlite, 1)!
      expect(state.steps[0].form).toEqual({
        pages: [{ id: 'q', question, choose: 'text' }],
      })

      const answered = answerQuestion(database, 'you', at(60), 1, {
        responses: [{ page: 'q', text: 'eu-west-1' }],
      })
      expect(answered).toMatchObject({ value: { state: { steps: [{ status: 'running' }] } } })
      expect(collectAnswer(database, 1, 'session-a')).toMatchObject({
        value: { kind: 'answered', answer: `### ${question}\neu-west-1` },
      })
    } finally {
      closeDatabase(database)
    }
  })
})
