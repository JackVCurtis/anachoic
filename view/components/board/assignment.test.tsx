import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { BACKLOG, QUEUE, WORKING } from '../fixtures/board_sections'
import { renderComponent } from '../testing/render'
import { assignmentFact } from './assignment'
import { BacklogCard } from './backlog_card/backlog_card'
import { QueueCard } from './queue_card/queue_card'
import { WorkingCard } from './working_card/working_card'

const API_SERVER = { id: 'worker-api-server', name: 'api-server' }

/** T-013, which no worker is assigned to. */
const UNASSIGNED_QUEUED = QUEUE.busy[0]
/** T-015, assigned to web-client. */
const ASSIGNED_QUEUED = QUEUE.busy[1]
/** T-003, which no worker is assigned to. */
const UNASSIGNED_BACKLOGGED = BACKLOG.busy[0]
/** T-010, assigned to web-client. */
const ASSIGNED_BACKLOGGED = BACKLOG.busy[4]

function card(): HTMLElement {
  return screen.getByRole('heading', { level: 3 }).parentElement as HTMLElement
}

describe('assignmentFact', () => {
  test('names the worker, and is empty for a task any worker may take', () => {
    expect(assignmentFact({ ...UNASSIGNED_QUEUED.task, assignedTo: API_SERVER })).toBe(
      'Assigned to api-server'
    )
    expect(assignmentFact({ ...UNASSIGNED_QUEUED.task, assignedTo: null })).toBe('')
    expect(assignmentFact(UNASSIGNED_QUEUED.task)).toBe('')
  })
})

describe('the assignment in the meta line', () => {
  test('QueueCard adds it after where the task picks up', () => {
    renderComponent(
      <QueueCard task={ASSIGNED_QUEUED} movable instructionsId="moves" onOpenTask={() => {}} />
    )
    expect(card()).toHaveTextContent('T-015 · starts at step 1/2 · agent · Assigned to web-client')
  })

  test('QueueCard shows nothing for an unassigned task', () => {
    renderComponent(
      <QueueCard task={UNASSIGNED_QUEUED} movable instructionsId="moves" onOpenTask={() => {}} />
    )
    expect(card()).not.toHaveTextContent('Assigned')
  })

  test('BacklogCard adds it after the chain note', () => {
    renderComponent(<BacklogCard task={ASSIGNED_BACKLOGGED} onOpenTask={() => {}} />)
    expect(card()).toHaveTextContent('T-010 · 3 steps · 1 for you · Assigned to web-client')
  })

  test('BacklogCard shows nothing for an unassigned task', () => {
    renderComponent(<BacklogCard task={UNASSIGNED_BACKLOGGED} onOpenTask={() => {}} />)
    expect(card()).not.toHaveTextContent('Assigned')
  })

  test('WorkingCard adds it after the task id, with the dot hidden from assistive technology', () => {
    renderComponent(<WorkingCard item={WORKING.one} onOpenTask={() => {}} />)
    const fact = screen.getByText('Assigned to api-server')

    expect(screen.getByRole('article')).toHaveTextContent('T-014 · Assigned to api-server')
    expect(fact.previousElementSibling).toHaveAttribute('aria-hidden', 'true')
    expect(fact).toBeVisible()
  })

  test('WorkingCard shows nothing for an unassigned task', () => {
    renderComponent(<WorkingCard item={WORKING.fourSteps} onOpenTask={() => {}} />)
    expect(screen.getByRole('article')).not.toHaveTextContent('Assigned')
    expect(screen.getByRole('article')).not.toHaveTextContent('·  ')
  })
})
