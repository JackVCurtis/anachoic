import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { before, FIXED_NOW } from '../../fixtures/clock'
import { boardHeader } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { BoardHeader } from './board_header'

const COUNTS = { yourTurn: 1, working: 3, queue: 0, toSignOff: 2 }

describe('BoardHeader', () => {
  test('shows each count with its label and says it with a plural that agrees', () => {
    renderComponent(<BoardHeader counts={COUNTS} updatedAt={null} unreachable={false} />)

    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('[aria-hidden]')?.textContent)).toEqual([
      'Waiting on user 1',
      'Working 3',
      'Queue 0',
      'To sign off 2',
    ])
    expect(screen.getByText('Waiting on user: 1 task')).toBeTruthy()
    expect(screen.getByText('Queue: 0 tasks')).toBeTruthy()
    expect(screen.queryByText(/^Updated/)).toBeNull()
    expect(screen.queryByText(boardHeader.cantReach)).toBeNull()
  })

  test('shows the cue and the line only when told to, without moving focus', () => {
    const { rerender } = renderComponent(
      <BoardHeader counts={COUNTS} updatedAt={null} unreachable={false} />
    )
    const focused = document.activeElement

    rerender(<BoardHeader counts={COUNTS} updatedAt={FIXED_NOW} unreachable />)

    expect(screen.getByText('Updated just now')).toBeTruthy()
    expect(screen.getByText(boardHeader.cantReach)).toBeTruthy()
    expect(document.activeElement).toBe(focused)
    expect(document.querySelector('[aria-live]')).toBeNull()
  })

  test('says how long ago the board was updated', () => {
    renderComponent(
      <BoardHeader counts={COUNTS} updatedAt={before({ minutes: 3 })} unreachable={false} />
    )

    expect(screen.getByText('Updated 3m ago')).toBeTruthy()
  })
})
