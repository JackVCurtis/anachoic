import { describe, expect, test } from 'vitest'
import {
  PLACEMENT_OPTIONS,
  canAppendFollowUp,
  emptyFollowUpDraft,
  followUpNote,
  submittedFollowUp,
  type FollowUpDraft,
} from './follow_up'

function draft(titles: string[], placement: FollowUpDraft['placement'] = 'last'): FollowUpDraft {
  return {
    steps: titles.map((title, index) => ({ id: `s${index}`, title, owner: 'agent', detail: '' })),
    placement,
  }
}

describe('the follow-up draft', () => {
  test('opens with one empty agent step, placed at the back', () => {
    const empty = emptyFollowUpDraft()

    expect(empty.placement).toBe('last')
    expect(empty.steps).toHaveLength(1)
    expect(empty.steps[0]).toMatchObject({ title: '', owner: 'agent', detail: '' })
  })

  test('the placement options are Back, then Front', () => {
    expect(PLACEMENT_OPTIONS).toEqual([
      { placement: 'last', label: 'Back' },
      { placement: 'first', label: 'Front' },
    ])
  })

  test.each([
    { titles: [''], ready: false },
    { titles: ['  '], ready: false },
    { titles: ['Fix it', ''], ready: false },
    { titles: [], ready: false },
    { titles: ['Fix it', 'Check it'], ready: true },
  ])('$titles can be appended: $ready', ({ titles, ready }) => {
    expect(canAppendFollowUp(draft(titles))).toBe(ready)
    expect(followUpNote(draft(titles))).toBe(
      ready ? 'Extends the chain · re-enters the queue' : 'A step needs a title'
    )
  })

  test('is submitted trimmed, without empty details, with its placement', () => {
    const typed: FollowUpDraft = {
      steps: [
        { id: 'a', title: ' Fix it ', owner: 'agent', detail: '  ' },
        { id: 'b', title: 'Check it', owner: 'you', detail: ' Look at the logs ' },
      ],
      placement: 'first',
    }

    expect(submittedFollowUp(typed)).toEqual({
      steps: [
        { title: 'Fix it', owner: 'agent' },
        { title: 'Check it', owner: 'you', detail: 'Look at the logs' },
      ],
      placement: 'first',
    })
  })
})
