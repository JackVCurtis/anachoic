// Copied from anachoic inertia/components/patterns/inline_confirm/inline_confirm.test.tsx at fd99e0d
import { act, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { done, fillTemplate, yourTurn } from '../../helpers/strings'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { InlineConfirm, type InlineConfirmLayout } from './inline_confirm'

const QUESTION = fillTemplate(yourTurn.parkQuestion, { title: 'Review the PR' })

async function inAct(input: () => Promise<unknown>) {
  await act(async () => {
    await input()
  })
}

interface HarnessProps {
  layout?: InlineConfirmLayout
  busy?: boolean
  onConfirm?: () => void
  onCancel?: () => void
  /** Pass the opener as a ref, or leave the question to remember what had focus. */
  byRef?: boolean
  /** Disable the opener while the question shows, as a card does. */
  disableOpener?: boolean
}

/**
 * An opener and the question it shows, as a card holds them. The question
 * hides again when it is confirmed or dismissed.
 */
function Harness({
  layout = 'row',
  busy = false,
  onConfirm = () => {},
  onCancel = () => {},
  byRef = true,
  disableOpener = false,
}: HarnessProps) {
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        disabled={disableOpener && open}
        onClick={() => setOpen(true)}
      >
        {yourTurn.park}
      </button>
      {open && (
        <InlineConfirm
          question={QUESTION}
          confirmLabel={yourTurn.park}
          dismissLabel={yourTurn.keepStep}
          layout={layout}
          busy={busy}
          onConfirm={() => {
            onConfirm()
          }}
          onCancel={() => {
            onCancel()
            setOpen(false)
          }}
          returnFocusTo={byRef ? openerRef : undefined}
        />
      )}
    </>
  )
}

function opener() {
  return screen.getAllByRole('button', { name: yourTurn.park })[0]
}

async function openQuestion() {
  await inAct(() => userEvent.click(opener()))
}

function renderAlone(props: { busy?: boolean; layout?: InlineConfirmLayout } = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const result = renderComponent(
    <InlineConfirm
      question={QUESTION}
      confirmLabel={yourTurn.park}
      dismissLabel={yourTurn.keepStep}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  )
  return {
    ...result,
    onConfirm,
    onCancel,
    confirm: screen.getByRole('button', { name: yourTurn.park }),
    dismiss: screen.getByRole('button', { name: yourTurn.keepStep }),
  }
}

describe('InlineConfirm', () => {
  test('on mount focus is on the dismiss button', () => {
    const { dismiss } = renderAlone()

    expect(document.activeElement).toBe(dismiss)
  })

  test('the question names the group the buttons sit in', () => {
    renderAlone()

    expect(screen.getByRole('group', { name: QUESTION })).toBeTruthy()
  })

  test('confirm calls onConfirm and not onCancel', async () => {
    const { confirm, onConfirm, onCancel } = renderAlone()

    await inAct(() => userEvent.click(confirm))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  describe.each([
    {
      how: 'the dismiss button',
      press: () => userEvent.click(screen.getByText(yourTurn.keepStep)),
    },
    { how: 'Enter on the dismiss button', press: () => userEvent.keyboard('{Enter}') },
    { how: 'Escape', press: () => userEvent.keyboard('{Escape}') },
  ])('dismissed with $how', ({ press }) => {
    test('calls onCancel and returns focus to the opener passed as a ref', async () => {
      const onCancel = vi.fn()
      renderComponent(<Harness onCancel={onCancel} />)

      await openQuestion()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: yourTurn.keepStep }))
      await inAct(press)
      expect(onCancel).toHaveBeenCalledOnce()
      expect(screen.queryByRole('group')).toBeNull()
      expect(document.activeElement).toBe(opener())
    })

    test('returns focus to the element that had it when no ref is passed', async () => {
      const onCancel = vi.fn()
      renderComponent(<Harness onCancel={onCancel} byRef={false} />)

      await openQuestion()
      await inAct(press)
      expect(onCancel).toHaveBeenCalledOnce()
      expect(document.activeElement).toBe(opener())
    })

    test('returns focus to an opener that was disabled while the question showed', async () => {
      renderComponent(<Harness disableOpener />)

      await openQuestion()
      expect(opener()).toBeDisabled()
      await inAct(press)
      expect(opener()).toBeEnabled()
      expect(document.activeElement).toBe(opener())
    })
  })

  test('confirming does not move focus to the opener', async () => {
    const onConfirm = vi.fn()
    renderComponent(<Harness onConfirm={onConfirm} />)

    await openQuestion()
    const confirm = screen.getAllByRole('button', { name: yourTurn.park })[1]
    await inAct(() => userEvent.click(confirm))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(confirm)
  })

  describe('while busy', () => {
    test('confirm is busy and does not call onConfirm again', async () => {
      const { confirm, onConfirm } = renderAlone({ busy: true })

      expect(confirm.getAttribute('aria-busy')).toBe('true')
      await inAct(() => userEvent.click(confirm, { force: true }))
      confirm.focus()
      await inAct(() => userEvent.keyboard('{Enter}'))
      await inAct(() => userEvent.keyboard(' '))
      expect(onConfirm).not.toHaveBeenCalled()
    })

    test('the dismiss button is disabled and Escape does not dismiss', async () => {
      const { confirm, dismiss, onCancel } = renderAlone({ busy: true })

      expect(dismiss).toBeDisabled()
      await inAct(() => userEvent.click(dismiss, { force: true }))
      confirm.focus()
      await inAct(() => userEvent.keyboard('{Escape}'))
      expect(onCancel).not.toHaveBeenCalled()
    })

    test('a question that turns busy after confirm keeps focus on confirm', async () => {
      const onConfirm = vi.fn()
      const { rerender } = renderComponent(
        <InlineConfirm
          question={QUESTION}
          confirmLabel={yourTurn.park}
          dismissLabel={yourTurn.keepStep}
          onConfirm={onConfirm}
          onCancel={() => {}}
        />
      )
      const confirm = screen.getByRole('button', { name: yourTurn.park })

      await inAct(() => userEvent.click(confirm))
      rerender(
        <InlineConfirm
          question={QUESTION}
          confirmLabel={yourTurn.park}
          dismissLabel={yourTurn.keepStep}
          busy
          onConfirm={onConfirm}
          onCancel={() => {}}
        />
      )
      await inAct(() => userEvent.click(confirm, { force: true }))
      expect(onConfirm).toHaveBeenCalledOnce()
      expect(document.activeElement).toBe(confirm)
    })
  })

  test('the frame has its tint, line, padding, type and gap', () => {
    const { dismiss } = renderAlone()
    const frame = dismiss.closest('[data-layout]') as HTMLElement
    const style = getComputedStyle(frame)

    expect(style.backgroundColor).toBe(resolvedColor('--color-accent-100'))
    expect(style.borderTopColor).toBe(resolvedColor('--color-accent-300'))
    expect(style.borderTopWidth).toBe('1px')
    expect(style.padding).toBe('6.8px 10.2px')
    expect(style.fontSize).toBe('13px')
    expect(style.columnGap).toBe('6.8px')
    expect(getComputedStyle(dismiss.parentElement!).columnGap).toBe('6.8px')
  })

  test('the confirm button is primary and the dismiss button ghost', () => {
    const { confirm, dismiss } = renderAlone()

    expect(getComputedStyle(confirm).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(dismiss).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  test('a row puts the question and the buttons on one line, the question taking the free width', () => {
    renderComponent(
      <div style={{ width: 560 }}>
        <InlineConfirm
          question={fillTemplate(done.archiveQuestion, { title: 'Fix flaky login test' })}
          confirmLabel={done.archive}
          dismissLabel={done.keepTask}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </div>
    )
    const question = screen.getByText(/^Archive “Fix flaky login test”\?/)
    const confirm = screen.getByRole('button', { name: done.archive })
    const dismiss = screen.getByRole('button', { name: done.keepTask })

    expect(confirm.getBoundingClientRect().left).toBeGreaterThan(
      question.getBoundingClientRect().right - 1
    )
    expect(dismiss.getBoundingClientRect().left).toBeGreaterThan(
      confirm.getBoundingClientRect().right
    )
    expect(getComputedStyle(confirm).fontSize).toBe('14px')
    expect(getComputedStyle(dismiss).fontSize).toBe('14px')
  })

  test('a long question wraps in a row', () => {
    renderComponent(
      <div style={{ width: 560 }}>
        <InlineConfirm
          question={fillTemplate(done.archiveQuestion, {
            title: 'Internationalisationandlocalisationsweepacrosseverypage',
          })}
          confirmLabel={done.archive}
          dismissLabel={done.keepTask}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </div>
    )
    const question = screen.getByText(/^Archive “/)
    const frame = question.closest('[data-layout]') as HTMLElement

    expect(question.getBoundingClientRect().height).toBeGreaterThan(20)
    expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth)
  })

  test('a stack puts the question across the top and small buttons at the left below', () => {
    renderComponent(
      <div style={{ width: 310 }}>
        <InlineConfirm
          question={QUESTION}
          confirmLabel={yourTurn.park}
          dismissLabel={yourTurn.keepStep}
          layout="stack"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </div>
    )
    const question = screen.getByText(QUESTION)
    const confirm = screen.getByRole('button', { name: yourTurn.park })
    const dismiss = screen.getByRole('button', { name: yourTurn.keepStep })
    const frame = question.closest('[data-layout]') as HTMLElement
    const frameBox = frame.getBoundingClientRect()
    const questionBox = question.getBoundingClientRect()
    const padding = Number.parseFloat(getComputedStyle(frame).paddingLeft)
    const border = Number.parseFloat(getComputedStyle(frame).borderLeftWidth)

    expect(frameBox.width).toBe(310)
    expect(questionBox.width).toBeCloseTo(310 - 2 * (padding + border), 0)
    expect(confirm.getBoundingClientRect().top).toBeGreaterThanOrEqual(questionBox.bottom)
    expect(confirm.getBoundingClientRect().left).toBeCloseTo(questionBox.left, 0)
    expect(dismiss.getBoundingClientRect().top).toBe(confirm.getBoundingClientRect().top)
    expect(dismiss.getBoundingClientRect().left).toBeGreaterThan(
      confirm.getBoundingClientRect().right
    )
    expect(getComputedStyle(confirm).fontSize).toBe('12px')
    expect(getComputedStyle(dismiss).fontSize).toBe('12px')
  })
})
