// Copied from anachoic inertia/components/board/queue_section/queue_section.test.tsx at fd99e0d
import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { QUEUE } from '../../fixtures/board_sections'
import { assistive, queue } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import type { QueueTask } from '../board_data'
import { QueueSection, type QueueSectionProps } from './queue_section'

const [FIRST, SECOND] = QUEUE.busy

/**
 * A spacing token's length, as a computed style writes it.
 */
function space(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

function renderQueue(props: Partial<QueueSectionProps> = {}) {
  const onOpenTask = vi.fn()
  const result = renderComponent(
    <div style={{ width: 600 }}>
      <QueueSection tasks={QUEUE.busy} onOpenTask={onOpenTask} {...props} />
    </div>
  )
  const section = screen.getByRole('heading', { level: 2, name: queue.title }).closest('section')!
  return { ...result, onOpenTask, section }
}

function cardOf(task: QueueTask): HTMLElement {
  return screen.getByRole('button', { name: task.task.title }).closest('li')
    ?.firstElementChild as HTMLElement
}

describe('QueueSection', () => {
  test('an empty Queue shows the header with 0 and nothing else', () => {
    const { section } = renderQueue({ tasks: [] })

    expect(section.children).toHaveLength(1)
    expect(section).toHaveTextContent(`${queue.title}0`)
    expect(within(section).queryByRole('list')).toBeNull()
    expect(within(section).queryByText(/No Tasks|pickup/i)).toBeNull()
  })

  test('the cards are an ordered list, --space-4 apart, in queue order', () => {
    renderQueue()
    const list = screen.getByRole('list')
    const items = screen.getAllByRole('listitem')

    expect(list.tagName).toBe('OL')
    expect(
      items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().bottom
    ).toBeCloseTo(Number.parseFloat(space('--space-4')), 1)
    expect(items.map((item) => within(item).getByText(/in line$/).textContent)).toEqual(
      QUEUE.busy.map((task) => `#${task.position} in line`)
    )
  })

  test('each card reads where it starts or resumes, and with whom', () => {
    renderQueue()
    const items = screen.getAllByRole('listitem')

    expect(items[0]).toHaveTextContent('T-013 · resumes at step 2/3 · agent')
    expect(items[1]).toHaveTextContent('T-015 · starts at step 1/2 · agent')
    expect(items[2]).toHaveTextContent('T-019 · resumes at step 2/4 · agent')
  })

  test('without onReorder the Queue renders no Move handle', () => {
    renderQueue()

    expect(screen.queryByRole('button', { name: queue.move })).toBeNull()
    expect(screen.queryByText(assistive.moveDescription)).toBeNull()
  })

  test('with one task the Queue renders no Move handle', () => {
    renderQueue({ tasks: QUEUE.one, onReorder: vi.fn() })

    expect(screen.queryByRole('button', { name: queue.move })).toBeNull()
  })

  test('a card the server will not let move has no handle', () => {
    const [first, ...rest] = QUEUE.busy
    renderQueue({
      tasks: [{ ...first, canAct: { ...first.canAct, reorder: false } }, ...rest],
      onReorder: vi.fn(),
    })

    expect(within(cardOf(first)).queryByRole('button', { name: queue.move })).toBeNull()
    expect(screen.getAllByRole('button', { name: queue.move })).toHaveLength(rest.length)
  })

  test('each handle is described by its card title and the instructions, written once', () => {
    renderQueue({ tasks: [FIRST, SECOND], onReorder: vi.fn() })
    const handles = screen.getAllByRole('button', { name: queue.move })

    expect(handles[0]).toHaveAccessibleDescription(
      `${FIRST.task.title} ${assistive.moveDescription}`
    )
    expect(handles[1]).toHaveAccessibleDescription(
      `${SECOND.task.title} ${assistive.moveDescription}`
    )
    expect(screen.getAllByText(assistive.moveDescription)).toHaveLength(1)
  })

  test('the handle does not open the task; the title does', async () => {
    const { user, onOpenTask } = renderQueue({ tasks: [FIRST, SECOND], onReorder: vi.fn() })

    await user.click(within(cardOf(FIRST)).getByRole('button', { name: queue.move }))
    expect(onOpenTask).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: FIRST.task.title }))
    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(FIRST.task.id)
  })

  test('the handles are disabled while a change of order is in flight', () => {
    renderQueue({ busy: true, onReorder: vi.fn() })

    for (const handle of screen.getAllByRole('button', { name: queue.move })) {
      expect(handle).toBeDisabled()
    }
  })

  test('a Queue of 20 is not folded', () => {
    renderQueue({ tasks: QUEUE.twenty })

    expect(screen.getAllByRole('listitem')).toHaveLength(20)
    expect(screen.queryByRole('button', { name: /^Show all/ })).toBeNull()
  })

  test('the card of the open task is filled; a hovered card is filled too', async () => {
    renderQueue({ selectedTaskId: SECOND.task.id })
    const accent = resolvedColor('--color-accent-100')

    expect(getComputedStyle(cardOf(SECOND)).backgroundColor).toBe(accent)
    expect(getComputedStyle(cardOf(FIRST)).backgroundColor).not.toBe(accent)
    await userEvent.hover(screen.getByRole('button', { name: FIRST.task.title }))
    expect(getComputedStyle(cardOf(FIRST)).backgroundColor).toBe(accent)
  })

  test('the card: padding --space-3, gap --space-2, and the position in the accent text', () => {
    renderQueue()
    const card = cardOf(FIRST)
    const position = within(card).getByText('#1 in line')
    const style = getComputedStyle(position)

    expect(getComputedStyle(card).paddingTop).toBe(space('--space-3'))
    expect(getComputedStyle(card).rowGap).toBe(space('--space-2'))
    expect(style.fontSize).toBe('12px')
    expect(style.fontWeight).toBe('400')
    expect(style.textTransform).toBe('none')
    expect(style.color).toBe(resolvedColor('--color-text-accent'))
  })
})
