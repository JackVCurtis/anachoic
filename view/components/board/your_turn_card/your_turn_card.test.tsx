import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { OUTPUTS, YOUR_TURN } from '../../fixtures/board_sections'
import { FIXED_NOW } from '../../fixtures/clock'
import { assistive, yourTurn } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import type { YourTurnTask } from '../board_data'
import { YourTurnCard, type YourTurnAction } from './your_turn_card'
import { fullText } from '../../testing/text'

function renderCard(item: YourTurnTask) {
  const onOpenTask = vi.fn()
  const rendered = renderComponent(<YourTurnCard item={item} onOpenTask={onOpenTask} />)
  const card = screen.getByRole('article')
  return { ...rendered, onOpenTask, card }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('YourTurnCard', () => {
  test('a user step reads "User step" and shows no question', () => {
    const { card } = renderCard(YOUR_TURN.yourStep)

    expect(screen.getByText('User step')).toBeVisible()
    expect(screen.getByText(YOUR_TURN.yourStep.task.displayId)).toBeVisible()
    expect(screen.getByText(YOUR_TURN.yourStep.step.title)).toBeVisible()
    expect(screen.getByText(fullText('Step 3/4 · 14m'))).toBeVisible()
    expect(card.querySelectorAll('p')).toHaveLength(1)
  })

  test("an agent's question shows the session's name and the question text", () => {
    renderCard(YOUR_TURN.question)

    expect(screen.getByText('This chat asks')).toBeVisible()
    expect(screen.getByText('Redis or in-process?')).toBeVisible()
    expect(screen.queryByText('User step')).toBeNull()
  })

  test('a question with no session named reads "Asks"', () => {
    renderCard({ ...YOUR_TURN.question, sessionName: null })

    expect(screen.getByText('Asks')).toBeVisible()
  })

  test('a question of 2,000 characters is shown in full and does not widen the card', () => {
    renderComponent(
      <div style={{ width: 600 }}>
        <YourTurnCard item={YOUR_TURN.longQuestion} onOpenTask={() => {}} />
      </div>
    )
    const question = YOUR_TURN.longQuestion.step.question!

    expect(question).toHaveLength(2000)
    expect(screen.getByText(question)).toBeVisible()
    const article = screen.getByRole('article')
    expect(article.scrollWidth).toBeLessThanOrEqual(article.clientWidth)
    expect(article.getBoundingClientRect().width).toBeLessThanOrEqual(600)
  })

  test('the waited time advances from "14m" with the fixed clock at the 30-second tick', () => {
    vi.useFakeTimers({
      now: Date.parse(FIXED_NOW) + 45_000,
      toFake: ['setInterval', 'clearInterval', 'Date'],
    })
    render(<YourTurnCard item={YOUR_TURN.yourStep} onOpenTask={() => {}} />)
    expect(screen.getByText(fullText('Step 3/4 · 14m'))).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByText(fullText('Step 3/4 · 14m'))).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByText(fullText('Step 3/4 · 15m'))).toBeDefined()
  })

  test('pressing the title raises onOpenTask with the task id', async () => {
    const { user, onOpenTask } = renderCard(YOUR_TURN.question)
    const title = screen.getByRole('button', { name: YOUR_TURN.question.task.title })

    expect(title.closest('h3')).not.toBeNull()
    await user.click(title)

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.question.task.id)
  })

  test('the card is inverted, padded --space-4, and does not change on hover', async () => {
    const { card } = renderCard(YOUR_TURN.yourStep)
    const style = getComputedStyle(card)
    const fill = resolvedColor('--color-accent-900')

    expect(card.getAttribute('data-tone')).toBe('inverse')
    expect(style.backgroundColor).toBe(fill)
    expect(style.borderTopColor).toBe(fill)
    expect(style.paddingTop).toBe(
      getComputedStyle(document.documentElement).getPropertyValue('--space-4').trim()
    )
    await userEvent.hover(screen.getByRole('button', { name: YOUR_TURN.yourStep.task.title }))
    expect(getComputedStyle(card).backgroundColor).toBe(fill)
  })
})

describe('YourTurnCard actions', () => {
  function renderActions(item: YourTurnTask, busy: YourTurnAction | null = null) {
    const callbacks = {
      onOpenTask: vi.fn(),
      onCompleteStep: vi.fn(),
      onAnswer: vi.fn(),
      onPark: vi.fn(),
    }
    const rendered = renderComponent(<YourTurnCard item={item} busy={busy} {...callbacks} />)
    return { ...rendered, ...callbacks }
  }

  const button = (name: string) => screen.getByRole('button', { name })

  test.each([
    ['  Merged, with one nit  ', 'Merged, with one nit'],
    ['   ', undefined],
  ])('Mark done with the note "%s" reports %s', async (typed, note) => {
    const { user, onCompleteStep, onOpenTask } = renderActions(YOUR_TURN.yourStep)

    await user.type(screen.getByRole('textbox', { name: yourTurn.noteLabel }), typed)
    await user.click(button(yourTurn.markDone))

    expect(onCompleteStep).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.yourStep.task.id, note)
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('Answer is disabled while the answer is empty or spaces, and reports it trimmed', async () => {
    const { user, onAnswer, onOpenTask } = renderActions(YOUR_TURN.question)
    const field = screen.getByRole('textbox', { name: yourTurn.answerLabel })

    expect(button(yourTurn.answer)).toBeDisabled()
    expect(field).toHaveAccessibleDescription(yourTurn.needsAnswer)
    await user.type(field, '   ')
    expect(button(yourTurn.answer)).toBeDisabled()

    await user.type(field, 'Redis{Enter}with a 5 m TTL  ')
    expect(field).toHaveValue('   Redis\nwith a 5 m TTL  ')
    expect(onAnswer).not.toHaveBeenCalled()
    expect(field).toHaveAccessibleDescription('This chat resumes with this')

    await user.click(button(yourTurn.answer))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(
      YOUR_TURN.question.task.id,
      'Redis\nwith a 5 m TTL'
    )
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('Park reports only after its confirmation, which does not open the task', async () => {
    const { user, onPark, onOpenTask } = renderActions(YOUR_TURN.yourStep)

    await user.click(button(yourTurn.park))
    expect(onPark).not.toHaveBeenCalled()
    expect(button(yourTurn.keepStep)).toHaveFocus()
    expect(
      screen.getByText(`Park “${YOUR_TURN.yourStep.task.title}”?`, { exact: false })
    ).toBeVisible()

    await user.click(button(yourTurn.park))
    expect(onPark).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.yourStep.task.id)
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test.each([
    [
      'Keep step',
      async (user: ReturnType<typeof renderComponent>['user']) => {
        await user.click(screen.getByRole('button', { name: yourTurn.keepStep }))
      },
    ],
    [
      'Escape',
      async (user: ReturnType<typeof renderComponent>['user']) => {
        await user.keyboard('{Escape}')
      },
    ],
  ])('%s reports nothing and returns focus to Park', async (_, dismiss) => {
    const { user, onPark } = renderActions(YOUR_TURN.question)

    await user.click(button(yourTurn.park))
    await dismiss(user)

    expect(onPark).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: yourTurn.keepStep })).toBeNull()
    expect(button(yourTurn.park)).toHaveFocus()
  })

  test('an action absent from canAct has no button', () => {
    renderActions({ ...YOUR_TURN.yourStep, canAct: { complete: false, park: true } })
    expect(screen.queryByRole('button', { name: yourTurn.markDone })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(button(yourTurn.park)).toBeEnabled()

    cleanup()
    renderActions({ ...YOUR_TURN.question, canAct: { answer: true, park: false } })
    expect(screen.queryByRole('button', { name: yourTurn.park })).toBeNull()
    expect(button(yourTurn.answer)).toBeDisabled()
  })

  test.each([
    ['complete', YOUR_TURN.yourStep, yourTurn.markDone],
    ['answer', YOUR_TURN.question, yourTurn.answer],
  ] as const)(
    'while %s is in flight its button is busy, the others disabled, the field editable',
    (busy, item, label) => {
      renderActions(item, busy)

      expect(button(label)).toHaveAttribute('aria-busy', 'true')
      expect(button(yourTurn.park)).toBeDisabled()
      expect(screen.getByRole('textbox')).toBeEnabled()
    }
  )

  test('while a park is in flight its confirmation is busy and the other button is disabled', async () => {
    const onPark = vi.fn()
    const { user, rerender } = renderComponent(
      <YourTurnCard
        item={YOUR_TURN.yourStep}
        onOpenTask={vi.fn()}
        onCompleteStep={vi.fn()}
        onPark={onPark}
      />
    )
    await user.click(button(yourTurn.park))
    await user.click(button(yourTurn.park))
    rerender(
      <YourTurnCard
        item={YOUR_TURN.yourStep}
        onOpenTask={vi.fn()}
        onCompleteStep={vi.fn()}
        onPark={onPark}
        busy="park"
      />
    )

    expect(button(yourTurn.park)).toHaveAttribute('aria-busy', 'true')
    expect(button(yourTurn.keepStep)).toBeDisabled()
    expect(screen.queryByRole('button', { name: yourTurn.markDone })).toBeNull()
  })

  test('a draft is kept by step: a new step of the same task starts empty', async () => {
    const { user, rerender } = renderComponent(
      <YourTurnCard item={YOUR_TURN.question} onOpenTask={vi.fn()} onAnswer={vi.fn()} />
    )
    await user.type(screen.getByRole('textbox'), 'Redis')
    const next = { ...YOUR_TURN.question, step: { ...YOUR_TURN.question.step, number: 3 } }
    rerender(<YourTurnCard item={next} onOpenTask={vi.fn()} onAnswer={vi.fn()} />)

    expect(screen.getByRole('textbox')).toHaveValue('')
  })
})

describe('YourTurnCard, a user step handed an artifact', () => {
  const item = OUTPUTS.handedPullRequest
  const linkName = `Pull request from step 1 ${assistive.opensInBrowser}`

  function renderHanded(onOpenLink?: (url: string) => void) {
    const callbacks = { onOpenTask: vi.fn(), onCompleteStep: vi.fn() }
    const rendered = renderComponent(
      <YourTurnCard item={item} onOpenLink={onOpenLink} {...callbacks} />
    )
    return { ...rendered, ...callbacks }
  }

  test('shows the link above Mark done, and pressing it asks the host to open it', async () => {
    const onOpenLink = vi.fn()
    const { user, onOpenTask } = renderHanded(onOpenLink)
    const link = screen.getByRole('link', { name: linkName })
    const markDone = screen.getByRole('button', { name: yourTurn.markDone })

    expect(link.compareDocumentPosition(markDone)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(link).toHaveAttribute('title', item.input!.url)
    await user.click(link)

    expect(onOpenLink).toHaveBeenCalledExactlyOnceWith(item.input!.url)
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('has no URL field: the note is its only field, and Mark done reports no link', async () => {
    const { user, onCompleteStep } = renderHanded(vi.fn())

    expect(screen.getAllByRole('textbox')).toEqual([
      screen.getByRole('textbox', { name: yourTurn.noteLabel }),
    ])
    await user.click(screen.getByRole('button', { name: yourTurn.markDone }))

    expect(onCompleteStep).toHaveBeenCalledExactlyOnceWith(item.task.id, undefined)
  })

  test('draws no link without onOpenLink, nor on a step handed nothing', () => {
    renderHanded()
    expect(screen.queryByRole('link')).toBeNull()
    cleanup()

    renderComponent(
      <YourTurnCard item={YOUR_TURN.yourStep} onOpenTask={vi.fn()} onOpenLink={vi.fn()} />
    )
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('YourTurnCard, blocked', () => {
  function renderBlocked(item: YourTurnTask) {
    const callbacks = {
      onOpenTask: vi.fn(),
      onCompleteStep: vi.fn(),
      onAnswer: vi.fn(),
      onPark: vi.fn(),
    }
    const rendered = renderComponent(<YourTurnCard item={item} {...callbacks} />)
    return { ...rendered, ...callbacks, card: screen.getByRole('article') }
  }

  test('shows the Blocked tag, the worker, the step, the reason, the time and where to unblock it', () => {
    const { card } = renderBlocked(YOUR_TURN.blocked)

    expect(screen.getByText('Blocked')).toBeVisible()
    expect(screen.getByText('api-server')).toBeVisible()
    expect(screen.getByText(YOUR_TURN.blocked.task.displayId)).toBeVisible()
    expect(screen.getByText(fullText('Step 2 · Deploy'))).toBeVisible()
    expect(screen.getByText(YOUR_TURN.blocked.blocked!.reason)).toBeVisible()
    expect(screen.getByText('Blocked 20m')).toBeVisible()
    expect(screen.getByText('Unblock it in api-server’s session')).toBeVisible()
    expect(card.getAttribute('data-tone')).toBe('inverse')
  })

  test('has no button but its title, no field and no Park, even where the server allows Park', () => {
    expect(YOUR_TURN.blocked.canAct.park).toBe(true)
    renderBlocked(YOUR_TURN.blocked)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      YOUR_TURN.blocked.task.title,
    ])
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText(yourTurn.park)).toBeNull()
  })

  test('pressing the title raises onOpenTask with the task id', async () => {
    const { user, onOpenTask } = renderBlocked(YOUR_TURN.blocked)

    await user.click(screen.getByRole('button', { name: YOUR_TURN.blocked.task.title }))

    expect(onOpenTask).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.blocked.task.id)
  })

  test('without a worker named, it says to unblock it in the worker’s session', () => {
    renderBlocked({ ...YOUR_TURN.blocked, sessionName: null })

    expect(screen.getByText('Unblock it in the worker’s session')).toBeVisible()
  })

  test.each([
    ['a reason of 2,000 characters', YOUR_TURN.longBlocked.blocked!.reason],
    ['a reason with no space', `https://console.aws.example.com/${'x'.repeat(400)}`],
  ])('%s wraps in full within 600 px and never widens the card', (_, reason) => {
    const item = {
      ...YOUR_TURN.longBlocked,
      blocked: { ...YOUR_TURN.longBlocked.blocked!, reason },
    }
    renderComponent(
      <div style={{ width: 600 }}>
        <YourTurnCard item={item} onOpenTask={() => {}} />
      </div>
    )
    const shown = screen.getByText(reason)
    const article = screen.getByRole('article')

    expect(shown.textContent).toBe(reason)
    expect(getComputedStyle(shown).textOverflow).not.toBe('ellipsis')
    expect(shown.scrollHeight).toBeLessThanOrEqual(shown.clientHeight)
    expect(shown.getBoundingClientRect().height).toBeGreaterThan(40)
    expect(article.scrollWidth).toBeLessThanOrEqual(article.clientWidth)
    expect(article.getBoundingClientRect().width).toBeLessThanOrEqual(600)
  })

  test('the time blocked advances each minute', () => {
    vi.useFakeTimers({
      now: Date.parse(FIXED_NOW) + 45_000,
      toFake: ['setInterval', 'clearInterval', 'Date'],
    })
    render(<YourTurnCard item={YOUR_TURN.blocked} onOpenTask={() => {}} />)
    expect(screen.getByText('Blocked 20m')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText('Blocked 21m')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('Blocked 22m')).toBeDefined()
  })
})
