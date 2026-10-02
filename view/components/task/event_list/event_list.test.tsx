import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { EVENTS } from '../../fixtures/task'
import { renderComponent } from '../../testing/render'
import { EventList } from './event_list'

describe('EventList', () => {
  test('lists the events oldest first, under the Events heading', () => {
    renderComponent(<EventList events={EVENTS} />)
    const list = screen.getByRole('list')

    expect(screen.getByRole('heading', { level: 3, name: 'Events' })).toBeVisible()
    expect(list.tagName).toBe('OL')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(EVENTS.length)
    expect(rows[0]).toHaveTextContent('Added · user')
    expect(rows.at(-1)).toHaveTextContent('Claimed step 3 · api-server')
  })

  test('a time from another day carries its day word, and one from today its seconds', () => {
    renderComponent(<EventList events={EVENTS} />)

    expect(screen.getByText('Yesterday 16:20')).toBeVisible()
    expect(screen.getByText('08:05:00')).toBeVisible()
  })

  test('a row shows the detail', () => {
    renderComponent(<EventList events={EVENTS} />)

    expect(screen.getByText('Merged, with one nit', { exact: false })).toBeVisible()
  })
})
