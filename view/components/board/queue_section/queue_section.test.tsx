// Copied from anachoic inertia/components/board/queue_section/queue_section.test.tsx at fd99e0d
import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { QUEUE } from '../../fixtures/board_sections'
import { assistive, queue } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import type { QueueTask } from '../board_data'
import { act } from 'react'
import { QueueSection, type QueueSectionProps } from './queue_section'

const [FIRST, SECOND, THIRD, FOURTH] = QUEUE.busy
const COUNT = QUEUE.busy.length

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

function titles(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((item) => within(item).getByRole('heading').textContent ?? '')
}

function positions(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((item) => within(item).getByText(/in line$/).textContent ?? '')
}

function handleOf(task: QueueTask): HTMLElement {
  return within(cardOf(task)).getByRole('button', { name: /^(Move|Drop)$/ })
}

function moveRegion(): HTMLElement {
  return document.querySelector('[aria-live="assertive"]') as HTMLElement
}

function renderMovable(props: Partial<QueueSectionProps> = {}) {
  const onReorder = vi.fn()
  const result = renderQueue({ onReorder, ...props })
  return { ...result, onReorder }
}

describe('moving a card with the keyboard', () => {
  test('the Move handle lifts its card, which takes the lifted look and reads Drop', async () => {
    const { user } = renderMovable()

    handleOf(THIRD).focus()
    await user.keyboard('{Enter}')

    const handle = handleOf(THIRD)
    expect(handle).toHaveTextContent(queue.drop)
    expect(handle).toHaveFocus()
    expect(handle).not.toHaveAttribute('aria-pressed')
    expect(handle).not.toHaveAttribute('aria-grabbed')
    expect(getComputedStyle(cardOf(THIRD)).backgroundColor).toBe(
      resolvedColor('--color-accent-100')
    )
    expect(getComputedStyle(cardOf(THIRD)).borderTopColor).toBe(resolvedColor('--color-accent-300'))
    expect(moveRegion()).toHaveTextContent(`“${THIRD.task.title}” lifted. Position 3 of ${COUNT}`)
  })

  test('a click lifts too, and the arrows move the card after it', async () => {
    const { user } = renderMovable()

    await user.click(handleOf(THIRD))
    await user.keyboard('{ArrowUp}')

    expect(titles()[1]).toBe(THIRD.task.title)
    expect(handleOf(THIRD)).toHaveFocus()
  })

  test('Up, Down, Home and End move the lifted card, and every label follows the order', async () => {
    const { user, onReorder } = renderMovable()

    handleOf(THIRD).focus()
    await user.keyboard('{Enter}')

    await user.keyboard('{ArrowUp}')
    expect(titles()).toEqual([FIRST, THIRD, SECOND, FOURTH].map((task) => task.task.title))
    expect(positions()).toEqual(['#1 in line', '#2 in line', '#3 in line', '#4 in line'])
    expect(moveRegion()).toHaveTextContent(`Position 2 of ${COUNT}`)
    expect(handleOf(THIRD)).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')
    expect(titles()).toEqual([FIRST, SECOND, FOURTH, THIRD].map((task) => task.task.title))
    expect(handleOf(THIRD)).toHaveFocus()

    await user.keyboard('{Home}')
    expect(titles()[0]).toBe(THIRD.task.title)
    expect(handleOf(THIRD)).toHaveFocus()

    await user.keyboard('{End}')
    expect(titles()[COUNT - 1]).toBe(THIRD.task.title)
    expect(handleOf(THIRD)).toHaveFocus()
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('an arrow at the end of the list does nothing and says nothing', async () => {
    const { user } = renderMovable()

    handleOf(FIRST).focus()
    await user.keyboard('{Enter}')
    const lifted = moveRegion().textContent
    await user.keyboard('{ArrowUp}')

    expect(titles()[0]).toBe(FIRST.task.title)
    expect(moveRegion().textContent).toBe(lifted)
  })

  test.each(['{Enter}', ' '])(
    '%j drops in a new place and raises onReorder once with the new position',
    async (key) => {
      const { user, onReorder } = renderMovable()

      handleOf(THIRD).focus()
      await user.keyboard('{Enter}')
      await user.keyboard('{Home}')
      await user.keyboard(key)

      expect(onReorder).toHaveBeenCalledExactlyOnceWith(THIRD.task.id, 1)
      expect(handleOf(THIRD)).toHaveTextContent(queue.move)
      expect(moveRegion()).toHaveTextContent(
        `“${THIRD.task.title}” dropped at position 1 of ${COUNT}`
      )
    }
  )

  test('a drop where the card started raises nothing', async () => {
    const { user, onReorder } = renderMovable()

    handleOf(THIRD).focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowUp}')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onReorder).not.toHaveBeenCalled()
    expect(moveRegion()).toHaveTextContent(
      `“${THIRD.task.title}” dropped at position 3 of ${COUNT}`
    )
  })

  test('Escape cancels: the card goes back to where it was lifted and nothing is raised', async () => {
    const { user, onReorder } = renderMovable()

    handleOf(THIRD).focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{Home}')
    await user.keyboard('{Escape}')

    expect(titles()).toEqual(QUEUE.busy.map((task) => task.task.title))
    expect(onReorder).not.toHaveBeenCalled()
    expect(handleOf(THIRD)).toHaveTextContent(queue.move)
    expect(handleOf(THIRD)).toHaveFocus()
    expect(moveRegion()).toHaveTextContent(
      `Move cancelled. “${THIRD.task.title}” is back at position 3 of ${COUNT}`
    )
  })

  test('Tab away from a lifted handle cancels the move', async () => {
    const { user, onReorder } = renderMovable()

    handleOf(THIRD).focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowUp}')
    await user.tab()

    expect(titles()).toEqual(QUEUE.busy.map((task) => task.task.title))
    expect(handleOf(THIRD)).toHaveTextContent(queue.move)
    expect(onReorder).not.toHaveBeenCalled()
    expect(moveRegion()).toHaveTextContent(`Move cancelled. “${THIRD.task.title}”`)
  })

  test('one card is lifted at a time', async () => {
    const { user } = renderMovable()

    handleOf(SECOND).focus()
    await user.keyboard('{Enter}')

    expect(screen.getAllByRole('button', { name: queue.drop })).toHaveLength(1)
  })

  test('one assertive live region, with no handle while busy and no lift', async () => {
    const { user } = renderMovable({ busy: true })

    expect(document.querySelectorAll('[aria-live="assertive"]')).toHaveLength(1)
    expect(moveRegion()).toHaveAttribute('aria-atomic', 'true')
    for (const handle of screen.getAllByRole('button', { name: queue.move })) {
      expect(handle).toBeDisabled()
    }
    await user.click(handleOf(SECOND))
    expect(screen.queryByRole('button', { name: queue.drop })).toBeNull()
  })

  test('a lifted card is put back when a change of order starts', async () => {
    const onReorder = vi.fn()
    const { user, rerender } = renderMovable({ onReorder })

    handleOf(SECOND).focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{End}')
    act(() => {
      rerender(
        <div style={{ width: 600 }}>
          <QueueSection tasks={QUEUE.busy} busy onOpenTask={() => {}} onReorder={onReorder} />
        </div>
      )
    })

    expect(titles()).toEqual(QUEUE.busy.map((task) => task.task.title))
    expect(screen.queryByRole('button', { name: queue.drop })).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('a lifted card in a long queue is kept in view as it moves', async () => {
    const { user } = renderMovable({ tasks: QUEUE.twenty })
    const first = screen.getAllByRole('button', { name: queue.move })[0]

    first.focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{End}')

    const handle = screen.getByRole('button', { name: queue.drop })
    const item = handle.closest('li')!
    const box = item.getBoundingClientRect()
    expect(screen.getAllByRole('listitem').indexOf(item)).toBe(QUEUE.twenty.length - 1)
    expect(within(item).getByText(/in line$/)).toHaveTextContent(`#${QUEUE.twenty.length} in line`)
    expect(handle).toHaveFocus()
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 1)
    expect(box.top).toBeGreaterThanOrEqual(-1)
  })
})

describe('moving a card with a pointer', () => {
  type User = ReturnType<typeof renderMovable>['user']

  function middleOf(element: Element) {
    const box = element.getBoundingClientRect()
    return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }
  }

  function itemOf(task: QueueTask): HTMLElement {
    return cardOf(task).closest('li')!
  }

  /**
   * Presses on a card's title, moves the pointer to each point given and,
   * unless asked not to, releases it there.
   */
  async function drag(
    user: User,
    task: QueueTask,
    points: Array<{ clientX: number; clientY: number }>,
    { release = true } = {}
  ) {
    const title = screen.getByRole('button', { name: task.task.title })
    const start = middleOf(title)
    await user.pointer({ keys: '[MouseLeft>]', target: title, coords: start })
    for (const coords of points) {
      await user.pointer({ target: title, coords })
    }
    if (release) {
      await user.pointer({ keys: '[/MouseLeft]', target: title, coords: points.at(-1) ?? start })
    }
  }

  function aboveTheFront() {
    const box = itemOf(FIRST).getBoundingClientRect()
    return { clientX: box.left + 20, clientY: box.top + 2 }
  }

  function rerenderWith(
    rerender: (ui: React.ReactElement) => void,
    props: Partial<QueueSectionProps> & { onReorder: QueueSectionProps['onReorder'] }
  ) {
    act(() => {
      rerender(
        <div style={{ width: 600 }}>
          <QueueSection tasks={QUEUE.busy} onOpenTask={() => {}} {...props} />
        </div>
      )
    })
  }

  test('a drag of more than 4 px lifts a card, which shows lifted and silent until the drop', async () => {
    const { user } = renderMovable()
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))

    await drag(user, THIRD, [{ ...start, clientY: start.clientY + 6 }], { release: false })

    expect(handleOf(THIRD)).toHaveTextContent(queue.drop)
    expect(getComputedStyle(cardOf(THIRD)).backgroundColor).toBe(
      resolvedColor('--color-accent-100')
    )
    expect(moveRegion()).toBeEmptyDOMElement()
    expect(getComputedStyle(cardOf(SECOND)).cursor).toBe('grabbing')
    await user.pointer({ keys: '[/MouseLeft]' })
  })

  test('a press that moves less than 4 px is a click, and opens the task', async () => {
    const { user, onOpenTask, onReorder } = renderMovable()
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))

    await drag(user, THIRD, [{ ...start, clientX: start.clientX + 2, clientY: start.clientY + 2 }])

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(THIRD.task.id)
    expect(screen.queryByRole('button', { name: queue.drop })).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('the card takes the place nearest the pointer, and the release does not open the task', async () => {
    const { user, onOpenTask, onReorder } = renderMovable()
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))

    await drag(user, THIRD, [{ ...start, clientY: start.clientY - 6 }, aboveTheFront()])

    expect(onReorder).toHaveBeenCalledExactlyOnceWith(THIRD.task.id, 1)
    expect(onOpenTask).not.toHaveBeenCalled()
    expect(titles()).toEqual([THIRD, FIRST, SECOND, FOURTH].map((task) => task.task.title))
    expect(positions()[0]).toBe('#1 in line')
    expect(moveRegion()).toHaveTextContent(
      `“${THIRD.task.title}” dropped at position 1 of ${COUNT}`
    )
  })

  test('a drag that begins on the handle moves the card the same way', async () => {
    const { user, onReorder } = renderMovable()
    const handle = handleOf(FIRST)
    const start = middleOf(handle)
    const below = middleOf(itemOf(SECOND))

    await user.pointer({ keys: '[MouseLeft>]', target: handle, coords: start })
    await user.pointer({ target: handle, coords: { ...start, clientY: start.clientY + 6 } })
    await user.pointer({ target: handle, coords: { ...below, clientY: below.clientY + 4 } })
    await user.pointer({ keys: '[/MouseLeft]', target: handle })

    expect(onReorder).toHaveBeenCalledExactlyOnceWith(FIRST.task.id, 2)
    expect(screen.queryByRole('button', { name: queue.drop })).toBeNull()
  })

  test('Escape during a drag cancels it, and nothing is raised', async () => {
    const { user, onReorder, onOpenTask } = renderMovable()
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))

    await drag(user, THIRD, [{ ...start, clientY: start.clientY - 6 }, aboveTheFront()], {
      release: false,
    })
    await user.keyboard('{Escape}')
    await user.pointer({ keys: '[/MouseLeft]' })

    expect(titles()).toEqual(QUEUE.busy.map((task) => task.task.title))
    expect(onReorder).not.toHaveBeenCalled()
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('the pointer leaving the document cancels the drag', async () => {
    const { user, onReorder } = renderMovable()
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))

    await drag(user, THIRD, [{ ...start, clientY: start.clientY - 6 }, aboveTheFront()], {
      release: false,
    })
    act(() => {
      document.documentElement.dispatchEvent(new PointerEvent('pointerleave'))
    })
    await user.pointer({ keys: '[/MouseLeft]' })

    expect(titles()).toEqual(QUEUE.busy.map((task) => task.task.title))
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('no drag begins while busy', async () => {
    const { user, onReorder } = renderMovable({ busy: true })
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))

    await drag(user, THIRD, [{ ...start, clientY: start.clientY - 6 }, aboveTheFront()])

    expect(screen.queryByRole('button', { name: queue.drop })).toBeNull()
    expect(titles()).toEqual(QUEUE.busy.map((task) => task.task.title))
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('the dropped order is shown until the request ends', async () => {
    const { user, onReorder, rerender } = renderMovable()
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))
    const made = [THIRD, FIRST, SECOND, FOURTH].map((task) => task.task.title)

    await drag(user, THIRD, [{ ...start, clientY: start.clientY - 6 }, aboveTheFront()])
    expect(titles()).toEqual(made)

    rerenderWith(rerender, { onReorder, busy: true })
    expect(titles()).toEqual(made)
    expect(positions()).toEqual(['#1 in line', '#2 in line', '#3 in line', '#4 in line'])

    rerenderWith(rerender, { onReorder, busy: false })
    expect(titles()).toEqual(QUEUE.busy.map((task) => task.task.title))
  })

  test('the dropped order is shown until a new queue arrives', async () => {
    const { user, onReorder, rerender } = renderMovable()
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))

    await drag(user, THIRD, [{ ...start, clientY: start.clientY - 6 }, aboveTheFront()])
    rerenderWith(rerender, { onReorder, busy: true })

    const given = [FIRST, THIRD, SECOND, FOURTH].map((task, index) => ({
      ...task,
      position: index + 1,
    }))
    rerenderWith(rerender, { onReorder, busy: true, tasks: given })
    expect(titles()).toEqual(given.map((task) => task.task.title))
  })

  test('the move ends when the lifted card leaves the queue, with no onReorder and the announcement', async () => {
    const { user, onReorder, rerender } = renderMovable()
    const start = middleOf(screen.getByRole('button', { name: THIRD.task.title }))

    await drag(user, THIRD, [{ ...start, clientY: start.clientY - 6 }, aboveTheFront()], {
      release: false,
    })
    rerenderWith(rerender, { onReorder, tasks: [FIRST, SECOND, FOURTH] })
    await user.pointer({ keys: '[/MouseLeft]' })

    expect(screen.queryByRole('button', { name: queue.drop })).toBeNull()
    expect(titles()).toEqual([FIRST, SECOND, FOURTH].map((task) => task.task.title))
    expect(onReorder).not.toHaveBeenCalled()
    expect(moveRegion()).toHaveTextContent(`“${THIRD.task.title}” left the queue. Move ended`)
  })

  test('tasks that arrive or leave under a lifted card leave it in its place among the rest', async () => {
    const { user, onReorder, rerender } = renderMovable()
    const [, , , , NEW] = QUEUE.twenty.map((task, index) => ({
      ...task,
      task: { ...task.task, id: `new-${index}`, title: `Arrived ${index}` },
    }))

    handleOf(THIRD).focus()
    await user.keyboard('{Enter}{ArrowUp}')
    rerenderWith(rerender, { onReorder, tasks: [NEW, FIRST, THIRD, FOURTH] })

    expect(titles()).toEqual([NEW, FIRST, THIRD, FOURTH].map((task) => task.task.title))
    expect(handleOf(THIRD)).toHaveTextContent(queue.drop)
    expect(handleOf(THIRD)).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onReorder).not.toHaveBeenCalled()
  })
})

describe('Move to backlog', () => {
  test('each card that can go back has a ghost "Move to backlog", which reports its task and opens nothing', async () => {
    const onMoveToBacklog = vi.fn()
    const { user, section, onOpenTask } = renderQueue({ onMoveToBacklog })

    expect(within(section).getAllByRole('button', { name: queue.toBacklog })).toHaveLength(
      QUEUE.busy.filter((task) => task.canAct.backlog).length
    )
    await user.click(within(cardOf(SECOND)).getByRole('button', { name: queue.toBacklog }))

    expect(onMoveToBacklog).toHaveBeenCalledExactlyOnceWith(SECOND.task.id)
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('a card that cannot go back, or a section without the handler, offers no button', () => {
    const tasks = [{ ...FIRST, canAct: { ...FIRST.canAct, backlog: false } }, SECOND]
    const { section, rerender } = renderQueue({ tasks, onMoveToBacklog: vi.fn() })

    expect(within(cardOf(FIRST)).queryByRole('button', { name: queue.toBacklog })).toBeNull()
    expect(within(cardOf(SECOND)).getByRole('button', { name: queue.toBacklog })).toBeVisible()

    rerender(
      <div style={{ width: 600 }}>
        <QueueSection tasks={tasks} onOpenTask={() => {}} />
      </div>
    )
    expect(within(section).queryByRole('button', { name: queue.toBacklog })).toBeNull()
  })

  test('while it is in flight the button is busy and the card cannot be moved', async () => {
    const onMoveToBacklog = vi.fn()
    const { user } = renderQueue({
      onMoveToBacklog,
      onReorder: vi.fn(),
      pending: { taskId: SECOND.task.id, action: 'backlog' },
    })
    const button = within(cardOf(SECOND)).getByRole('button', { name: queue.toBacklog })

    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(within(cardOf(SECOND)).getByRole('button', { name: queue.move })).toBeDisabled()
    expect(within(cardOf(THIRD)).getByRole('button', { name: queue.move })).toBeEnabled()
    await user.click(button)
    expect(onMoveToBacklog).not.toHaveBeenCalled()
    expect(within(cardOf(THIRD)).getByRole('button', { name: queue.toBacklog })).toBeEnabled()
  })
})
