import { describe, expect, test } from 'vitest'
import { estimateTokens } from '../../../server/text/board_summary.js'
import {
  openTaskText,
  TASK_TEXT_EVENTS,
  TASK_TEXT_TOKEN_BUDGET,
} from '../../../server/text/open_task.js'
import type { TaskEvent, TaskProps, TaskStep } from '../../../shared/props.js'

const AT = '2026-10-01T12:00:00.000Z'
const WORKER = { id: 'session-a', name: 'api-server', live: true }

function step(number: number, fields: Partial<TaskStep> = {}): TaskStep {
  return {
    id: `s${number}`,
    number,
    owner: 'agent',
    title: `Step ${number}`,
    detail: null,
    status: 'done',
    origin: 'chain',
    current: false,
    session: WORKER,
    question: null,
    answer: null,
    note: null,
    summary: `Summary ${number}`,
    links: [],
    outputFormat: null,
    artifactUrl: null,
    input: null,
    blocked: null,
    startedAt: AT,
    runningSince: null,
    waitingSince: null,
    finishedAt: AT,
    elapsedSeconds: 60,
    waitedSeconds: 0,
    ...fields,
  }
}

function event(id: number): TaskEvent {
  return {
    id,
    at: AT,
    kind: 'noted',
    stepNumber: 1,
    by: WORKER,
    detail: `Event ${id} ${'x'.repeat(480)}`,
  }
}

function task(steps: TaskStep[], events: TaskEvent[]): TaskProps {
  return {
    revision: 9,
    now: AT,
    task: {
      id: '12',
      displayId: 'T-012',
      title: 'Add caching',
      assignedTo: null,
      status: 'done',
      list: 'toSignOff',
      queuePosition: null,
      createdBy: 'you',
      createdAt: AT,
      finishedAt: AT,
      signedOffAt: null,
      archivedAt: null,
      resumeWith: null,
    },
    steps,
    agentSeconds: 60 * steps.length,
    yourSeconds: 0,
    artifacts: [],
    events,
    canAct: { archive: true, park: false },
  }
}

describe('openTaskText', () => {
  test('shows the last 10 events', () => {
    const text = openTaskText(
      task(
        [step(1)],
        Array.from({ length: 30 }, (_, index) => ({
          ...event(index + 1),
          detail: `Event ${index + 1}`,
        }))
      )
    )
    expect(text).toContain(`Events (latest ${TASK_TEXT_EVENTS} of 30):`)
    expect(text).toContain('Event 21')
    expect(text).not.toContain('Event 20\n')
    expect(text.endsWith('Event 30')).toBe(true)
  })

  test('with many events and long steps, stays under 8,000 tokens by dropping the oldest events first, keeping every step', () => {
    const steps = Array.from({ length: 20 }, (_, index) =>
      step(index + 1, { summary: `Summary ${index + 1} ${'y'.repeat(1400)}` })
    )
    const events = Array.from({ length: 500 }, (_, index) => event(index + 1))
    const text = openTaskText(task(steps, events))

    expect(estimateTokens(text)).toBeLessThan(TASK_TEXT_TOKEN_BUDGET)
    for (let number = 1; number <= 20; number += 1) {
      expect(text).toContain(`${number}. "Step ${number}"`)
      expect(text).toContain(`Summary ${number} y`)
    }
    const shown = [...text.matchAll(/Event (\d+) /g)].map((match) => Number(match[1]))
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(TASK_TEXT_EVENTS)
    expect(shown.at(-1)).toBe(500)
    expect(shown).toEqual(shown.map((_, index) => 500 - shown.length + 1 + index))
  })

  test('when the steps alone exceed the budget, cuts their long fields and keeps every step', () => {
    const steps = Array.from({ length: 40 }, (_, index) =>
      step(index + 1, { detail: 'd'.repeat(4000), summary: 's'.repeat(2000) })
    )
    const text = openTaskText(task(steps, [event(1)]))
    expect(estimateTokens(text)).toBeLessThan(TASK_TEXT_TOKEN_BUDGET)
    for (let number = 1; number <= 40; number += 1) {
      expect(text).toContain(`${number}. "Step ${number}"`)
    }
  })
})
