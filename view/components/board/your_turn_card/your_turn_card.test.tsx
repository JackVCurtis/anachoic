import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { OUTPUTS, REJECTABLE, YOUR_TURN } from '../../fixtures/board_sections'
import { FIXED_NOW } from '../../fixtures/clock'
import { assistive, questionForm, reject, yourTurn } from '../../helpers/strings'
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
    expect(screen.getByText('Which cache should the search endpoint use?')).toBeVisible()
    expect(screen.queryByText('User step')).toBeNull()
  })

  test('a question with no session named reads "Asks"', () => {
    renderCard({ ...YOUR_TURN.question, sessionName: null })

    expect(screen.getByText('Asks')).toBeVisible()
  })

  test('a form at the longest a page takes is shown in full and does not widen the card', () => {
    renderComponent(
      <div style={{ width: 600 }}>
        <YourTurnCard item={YOUR_TURN.longQuestion} onOpenTask={() => {}} onAnswer={() => {}} />
      </div>
    )
    const page = YOUR_TURN.longQuestion.step.form!.pages[0]

    expect(page.question).toHaveLength(250)
    expect(screen.getByText(page.question)).toBeVisible()
    for (const option of page.options!) {
      expect(option.label).toHaveLength(150)
      expect(screen.getByRole('radio', { name: option.label })).toBeVisible()
    }
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
    const fill = resolvedColor('--inverse-bg')

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

  test('the form walks the branch the answers lead to and reports every answer on it', async () => {
    const { user, onAnswer, onOpenTask } = renderActions(YOUR_TURN.question)

    expect(screen.getByText('Question 1 of 3')).toBeVisible()
    expect(button(questionForm.next)).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Redis' }))
    await user.click(button(questionForm.next))

    const prefix = screen.getByRole('textbox', { name: 'What key prefix should it use?' })
    expect(prefix).toHaveFocus()
    expect(screen.getByText('Question 2 of 3')).toBeVisible()
    await user.type(prefix, '   ')
    expect(button(questionForm.next)).toBeDisabled()
    await user.type(prefix, 'search:')
    await user.click(button(questionForm.next))

    await user.click(screen.getByRole('radio', { name: '10 minutes' }))
    expect(onAnswer).not.toHaveBeenCalled()
    await user.click(button(questionForm.answer))

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.question.task.id, {
      responses: [
        { page: 'cache', picked: [0] },
        { page: 'prefix', text: '   search:' },
        { page: 'ttl', picked: [1] },
      ],
    })
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  test('Back keeps the answers, and changing one drops the pages after it', async () => {
    const { user, onAnswer } = renderActions(YOUR_TURN.question)

    await user.click(screen.getByRole('radio', { name: 'Redis' }))
    await user.click(button(questionForm.next))
    await user.type(screen.getByRole('textbox'), 'search:')
    await user.click(button(questionForm.back))

    expect(screen.getByRole('radio', { name: 'Redis' })).toBeChecked()
    await user.click(button(questionForm.next))
    expect(screen.getByRole('textbox')).toHaveValue('search:')
    await user.click(button(questionForm.back))

    await user.click(screen.getByRole('radio', { name: 'In-process' }))
    await user.click(button(questionForm.next))
    expect(screen.getByRole('group', { name: 'Which responses may it cache?' })).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Search results' }))
    await user.click(screen.getByRole('checkbox', { name: 'Suggestions' }))
    await user.click(button(questionForm.next))
    await user.click(screen.getByRole('radio', { name: '1 hour' }))
    await user.click(button(questionForm.answer))

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.question.task.id, {
      responses: [
        { page: 'cache', picked: [1] },
        { page: 'scope', picked: [0, 2] },
        { page: 'ttl', picked: [2] },
      ],
    })
  })

  test('Answer directly takes the user’s own words instead, trimmed', async () => {
    const { user, onAnswer } = renderActions(YOUR_TURN.question)
    await user.click(screen.getByRole('radio', { name: 'Redis' }))
    await user.click(button(questionForm.answerDirectly))

    const field = screen.getByRole('textbox', { name: yourTurn.answerLabel })
    expect(button(yourTurn.answer)).toBeDisabled()
    expect(field).toHaveAccessibleDescription(yourTurn.needsAnswer)
    await user.type(field, '   ')
    expect(button(yourTurn.answer)).toBeDisabled()

    await user.click(button(questionForm.backToForm))
    expect(screen.getByRole('textbox', { name: 'What key prefix should it use?' })).toBeVisible()
    await user.click(button(questionForm.back))
    expect(screen.getByRole('radio', { name: 'Redis' })).toBeChecked()
    await user.click(button(questionForm.answerDirectly))

    await user.type(screen.getByRole('textbox'), 'Neither{Enter}we drop the cache  ')
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('This chat resumes with this')
    await user.click(button(yourTurn.answer))

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(YOUR_TURN.question.task.id, {
      direct: 'Neither\nwe drop the cache',
    })
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
    expect(button(questionForm.next)).toBeDisabled()
  })

  test('while complete is in flight its button is busy, Park disabled, the field editable', () => {
    renderActions(YOUR_TURN.yourStep, 'complete')

    expect(button(yourTurn.markDone)).toHaveAttribute('aria-busy', 'true')
    expect(button(yourTurn.park)).toBeDisabled()
    expect(screen.getByRole('textbox')).toBeEnabled()
  })

  test('while an answer is in flight the form is busy and held still', () => {
    renderActions(YOUR_TURN.question, 'answer')

    expect(button(questionForm.next)).toHaveAttribute('aria-busy', 'true')
    expect(button(questionForm.answerDirectly)).toBeDisabled()
    expect(button(yourTurn.park)).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Redis' })).toBeDisabled()
  })

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
    await user.click(screen.getByRole('radio', { name: 'Redis' }))
    const next = { ...YOUR_TURN.question, step: { ...YOUR_TURN.question.step, number: 3 } }
    rerender(<YourTurnCard item={next} onOpenTask={vi.fn()} onAnswer={vi.fn()} />)

    expect(screen.getByRole('radio', { name: 'Redis' })).not.toBeChecked()
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

  test('offers Reject on a user step only where the server allows it, and never on a question', () => {
    const onReject = vi.fn()
    const { unmount } = renderComponent(
      <YourTurnCard item={OUTPUTS.handedPullRequest} onOpenTask={vi.fn()} onReject={onReject} />
    )
    expect(screen.queryByRole('button', { name: reject.reject })).toBeNull()
    unmount()
    const question = {
      ...YOUR_TURN.question,
      canAct: { ...YOUR_TURN.question.canAct, reject: true },
    }
    renderComponent(<YourTurnCard item={question} onOpenTask={vi.fn()} onReject={onReject} />)
    expect(screen.queryByRole('button', { name: reject.reject })).toBeNull()
  })

  test('a failed rejection keeps its note in the form', async () => {
    const onReject = vi.fn()
    const { user, rerender } = renderComponent(
      <YourTurnCard item={REJECTABLE.yourStep} onOpenTask={vi.fn()} onReject={onReject} />
    )
    await user.click(screen.getByRole('button', { name: reject.reject }))
    await user.type(screen.getByRole('textbox', { name: reject.label }), 'Wrong branch')
    await user.click(screen.getByRole('button', { name: reject.sendBack }))
    expect(onReject).toHaveBeenCalledWith(REJECTABLE.yourStep.task.id, 'Wrong branch')
    rerender(
      <YourTurnCard
        item={REJECTABLE.yourStep}
        onOpenTask={vi.fn()}
        onReject={onReject}
        busy="reject"
      />
    )
    rerender(<YourTurnCard item={REJECTABLE.yourStep} onOpenTask={vi.fn()} onReject={onReject} />)
    expect(screen.getByRole('textbox', { name: reject.label })).toHaveValue('Wrong branch')
  })
})
