// Copied from anachoic inertia/components/sign_off/sign_off_view/sign_off_view.test.tsx at fd99e0d
import { act, screen, within } from '@testing-library/react'
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

describe('DoneSection follow-up composer', () => {
  const [FLAKY, RETRY] = DONE.two

  function renderComposing(props: Partial<DoneSectionProps> = {}) {
    const onFollowUp = vi.fn()
    const onSignOff = vi.fn()
    const rendered = renderSection({ onFollowUp, onSignOff, onArchive: vi.fn(), ...props })
    const cardOf = (title: string) =>
      screen.getByRole('button', { name: title }).closest('article') as HTMLElement
    return { ...rendered, onFollowUp, onSignOff, cardOf }
  }

  test('Follow up opens the composer in place of the actions, with Back chosen and focus in the first step title', async () => {
    const { user, cardOf } = renderComposing()
    const card = cardOf(FLAKY.task.title)

    await user.click(within(card).getByRole('button', { name: 'Follow up' }))

    const form = within(card).getByRole('form', { name: 'Follow-up task' })
    expect(within(card).queryByRole('button', { name: 'Sign off' })).toBeNull()
    expect(within(form).getByRole('radio', { name: 'Back' })).toBeChecked()
    expect(within(form).getByRole('radio', { name: 'Front' })).not.toBeChecked()
    expect(within(form).getByRole('group', { name: 'Place in queue' })).toBeVisible()
    const first = FLAKY.steps.length + 1
    expect(document.activeElement).toBe(
      within(form).getByRole('textbox', { name: `Title of step ${first}` })
    )
  })

  test('Append & queue is disabled until every step has a title, then reports the steps and the placement', async () => {
    const { user, cardOf, onFollowUp } = renderComposing()
    const card = cardOf(FLAKY.task.title)
    await user.click(within(card).getByRole('button', { name: 'Follow up' }))
    const form = within(card).getByRole('form')
    const append = within(form).getByRole('button', { name: 'Append & queue' })
    const first = FLAKY.steps.length + 1

    expect(append).toBeDisabled()
    expect(form).toHaveTextContent('A step needs a title')

    await user.keyboard('Fix the flake')
    await user.click(within(form).getByRole('button', { name: 'Add step' }))
    expect(append).toBeDisabled()
    await user.keyboard('Check the run')
    await user.click(
      within(form)
        .getByRole('group', { name: `Owner of step ${first + 1}` })
        .querySelector('input[value="you"]')!
    )
    await user.click(within(form).getByRole('radio', { name: 'Front' }))

    expect(append).toBeEnabled()
    expect(form).toHaveTextContent('Extends the chain · re-enters the queue')
    await user.click(append)

    expect(onFollowUp).toHaveBeenCalledExactlyOnceWith(FLAKY.task.id, {
      steps: [
        { title: 'Fix the flake', owner: 'agent' },
        { title: 'Check the run', owner: 'you' },
      ],
      placement: 'first',
    })
  })

  test.each(['Cancel', 'Escape'])(
    '%s closes the composer and returns focus to Follow up',
    async (how) => {
      const { user, cardOf, onFollowUp } = renderComposing()
      const card = cardOf(FLAKY.task.title)
      await user.click(within(card).getByRole('button', { name: 'Follow up' }))
      await user.keyboard('Half written')

      if (how === 'Cancel') {
        await user.click(within(card).getByRole('button', { name: 'Cancel' }))
      } else {
        await user.keyboard('{Escape}')
      }

      expect(within(card).queryByRole('form')).toBeNull()
      expect(document.activeElement).toBe(within(card).getByRole('button', { name: 'Follow up' }))
      expect(onFollowUp).not.toHaveBeenCalled()
    }
  )

  test('each time a composer opens it starts empty, with Back chosen', async () => {
    const { user, cardOf } = renderComposing()
    const card = cardOf(FLAKY.task.title)
    await user.click(within(card).getByRole('button', { name: 'Follow up' }))
    await user.keyboard('Fix the flake')
    await user.click(within(card).getByRole('radio', { name: 'Front' }))
    await user.click(within(card).getByRole('button', { name: 'Cancel' }))

    await user.click(within(card).getByRole('button', { name: 'Follow up' }))

    expect(within(card).getByRole('radio', { name: 'Back' })).toBeChecked()
    expect(within(card).getAllByRole('textbox')[0]).toHaveValue('')
  })

  test('opening a composer on a second card closes the first', async () => {
    const { user, cardOf } = renderComposing()

    await user.click(within(cardOf(FLAKY.task.title)).getByRole('button', { name: 'Follow up' }))
    await user.click(within(cardOf(RETRY.task.title)).getByRole('button', { name: 'Follow up' }))

    expect(screen.getAllByRole('form')).toHaveLength(1)
    expect(within(cardOf(RETRY.task.title)).getByRole('form')).toBeVisible()
    expect(
      within(cardOf(FLAKY.task.title)).getByRole('button', { name: 'Follow up' })
    ).toBeVisible()
  })

  test('signing off a card closes its composer, and the draft goes with it', async () => {
    const onFollowUp = vi.fn()
    const { user, cardOf, rerender } = renderComposing({ onFollowUp })
    await user.click(within(cardOf(FLAKY.task.title)).getByRole('button', { name: 'Follow up' }))
    await user.keyboard('Fix the flake')

    const section = (toSignOff: DoneSectionProps['toSignOff']) => (
      <DoneSection
        toSignOff={toSignOff}
        signedOff={DONE.signedOff}
        onOpenTask={() => {}}
        onSignOff={() => {}}
        onFollowUp={onFollowUp}
      />
    )
    await act(async () => rerender(section([RETRY])))
    expect(screen.queryByRole('form')).toBeNull()

    await act(async () => rerender(section(DONE.two)))
    expect(screen.queryByRole('form')).toBeNull()
    expect(within(cardOf(FLAKY.task.title)).getByRole('button', { name: 'Sign off' })).toBeVisible()
  })

  test('Sign off on another card leaves an open composer alone', async () => {
    const { user, cardOf, onSignOff } = renderComposing()
    await user.click(within(cardOf(FLAKY.task.title)).getByRole('button', { name: 'Follow up' }))

    await user.click(within(cardOf(RETRY.task.title)).getByRole('button', { name: 'Sign off' }))

    expect(onSignOff).toHaveBeenCalledExactlyOnceWith(RETRY.task.id)
    expect(within(cardOf(FLAKY.task.title)).getByRole('form')).toBeVisible()
  })

  test('while the follow-up is in flight Append & queue is busy, Cancel disabled and the draft kept', async () => {
    const { user, cardOf, rerender, onFollowUp } = renderComposing()
    await user.click(within(cardOf(FLAKY.task.title)).getByRole('button', { name: 'Follow up' }))
    await user.keyboard('Fix the flake')

    rerender(
      <DoneSection
        toSignOff={DONE.two}
        signedOff={DONE.signedOff}
        onOpenTask={() => {}}
        onFollowUp={onFollowUp}
        pending={{ taskId: FLAKY.task.id, action: 'followUp' }}
      />
    )
    const form = screen.getByRole('form')
    expect(
      within(form).getByRole('button', { name: 'Append & queue' }).getAttribute('aria-busy')
    ).toBe('true')
    expect(within(form).getByRole('button', { name: 'Cancel' })).toBeDisabled()

    rerender(
      <DoneSection
        toSignOff={DONE.two}
        signedOff={DONE.signedOff}
        onOpenTask={() => {}}
        onFollowUp={onFollowUp}
      />
    )
    expect(within(screen.getByRole('form')).getAllByRole('textbox')[0]).toHaveValue('Fix the flake')
  })
})
