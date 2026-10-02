// Copied from anachoic inertia/components/sign_off/sign_off_view/sign_off_view.test.tsx at fd99e0d
import { screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { DONE } from '../../fixtures/board_sections'
import { done } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { DoneSection, type DoneSectionProps } from './done_section'

function renderSection(props: Partial<DoneSectionProps> = {}) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(
    <DoneSection
      toSignOff={DONE.two}
      signedOff={DONE.signedOff}
      onOpenTask={onOpenTask}
      {...props}
    />
  )
  const section = screen.getByRole('heading', { level: 2, name: done.title }).closest('section')!
  return { ...rendered, onOpenTask, section }
}

describe('DoneSection', () => {
  test('an empty Done section shows "Nothing waiting for sign-off"', () => {
    const { section } = renderSection({ toSignOff: [], signedOff: [] })

    expect(within(section).getByText('Nothing waiting for sign-off')).toBeVisible()
    expect(within(section).getByText('0')).toBeVisible()
    expect(within(section).queryByRole('button')).toBeNull()
  })

  test('counts the tasks to sign off, one card each, each title at h3', () => {
    const { section } = renderSection()

    expect(within(section).getByText('2')).toBeVisible()
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(DONE.two.map(({ task }) => task.title))
  })

  test('the signed-off Disclosure is closed at first and shows 10 rows when opened, each title raising onOpenTask', async () => {
    const { user, section, onOpenTask } = renderSection({ toSignOff: [] })
    const toggle = within(section).getByRole('button', { name: '10 tasks signed off' })

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(within(section).queryByRole('list')).toBeNull()

    await user.click(toggle)
    const rows = within(section).getAllByRole('listitem')
    expect(rows).toHaveLength(10)
    expect(rows[0]).toHaveTextContent('T-024Add a health check endpointyesterday')

    for (const [index, row] of rows.entries()) {
      const { task } = DONE.signedOff[index]
      await user.click(within(row).getByRole('button', { name: task.title }))
      expect(onOpenTask).toHaveBeenLastCalledWith(task.id)
    }
    expect(onOpenTask).toHaveBeenCalledTimes(10)
  })

  test('the signed-off list is never longer than 10', async () => {
    const extra = {
      task: { id: 'extra', displayId: 'T-099', title: 'One more' },
      signedOffAt: DONE.signedOff[9].signedOffAt,
    }
    const { user, section } = renderSection({
      toSignOff: [],
      signedOff: [...DONE.signedOff, extra],
    })

    await user.click(within(section).getByRole('button', { name: '10 tasks signed off' }))
    expect(within(section).getAllByRole('listitem')).toHaveLength(10)
  })

  test('with nothing signed off there is no Disclosure', () => {
    const { section } = renderSection({ signedOff: [] })

    expect(within(section).queryByRole('button', { name: /signed off/ })).toBeNull()
  })

  test('twelve tasks to sign off fold after eight', async () => {
    const { user, section } = renderSection({ toSignOff: DONE.twelve, signedOff: [] })

    expect(within(section).getAllByRole('article')).toHaveLength(8)
    await user.click(within(section).getByRole('button', { name: 'Show all 12' }))
    expect(within(section).getAllByRole('article')).toHaveLength(12)
  })

  test('a card title raises onOpenTask with the task id', async () => {
    const { user, onOpenTask } = renderSection()

    await user.click(screen.getByRole('button', { name: DONE.flaky.task.title }))

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(DONE.flaky.task.id)
  })
})
