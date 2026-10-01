// Copied from anachoic inertia/components/primitives/action_card/action_card.test.tsx at fd99e0d
import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import type { Tone } from '../../types'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { Button } from '../button/button'
import { ActionCard, type ActionCardProps } from './action_card'
import sample from './action_card_sample.module.css'

const TITLE = 'Research the retry policy for the sync worker'

const COMMAND = 'claude --resume 7f3a2c'

const CLEAR = 'rgba(0, 0, 0, 0)'

/**
 * Text on the card sits under the stretched hit area, which Playwright sees
 * as covering it. Forcing the pointer skips that check; the event still lands
 * on whatever is on top at the point, which is the hit area.
 */
const UNDER_THE_HIT_AREA = { force: true }

/**
 * A card as YourTurnCard lays it out: a row before the title, then the
 * meta line, a terminal link, a command in a code box and a button.
 */
function renderCard(props: Partial<ActionCardProps> = {}, tone: Tone = 'light') {
  const onAction = vi.fn()
  const onQueue = vi.fn()
  const result = renderComponent(
    <div style={{ width: 360 }}>
      <ActionCard
        title={TITLE}
        className={sample.card}
        titleClassName="text-title-1"
        onAction={onAction}
        tone={tone}
        leading={<p className="text-note">Approval needed</p>}
        {...props}
      >
        <p className="text-note">Research · step 2 of 3</p>
        <a href="#terminal" className={sample.link} onClick={(event) => event.preventDefault()}>
          Open terminal
        </a>
        <pre>
          <code>{COMMAND}</code>
        </pre>
        <div className={sample.actions}>
          <Button variant="secondary" size="sm" onPress={onQueue}>
            Queue →
          </Button>
        </div>
      </ActionCard>
    </div>,
    { tone }
  )
  const card = screen.getByRole('article')
  return {
    ...result,
    card,
    onAction,
    onQueue,
    action: screen.getByRole('button', { name: TITLE }),
    link: screen.getByRole('link', { name: 'Open terminal' }),
    button: screen.getByRole('button', { name: 'Queue →' }),
    code: screen.getByText(COMMAND),
  }
}

/**
 * Clicks at a point of the card, given as fractions of its box, the way a
 * pointer would: the element under the point takes the click.
 */
async function clickAt(card: HTMLElement, x: number, y: number) {
  const box = card.getBoundingClientRect()
  await userEvent.click(card, {
    position: { x: Math.round(box.width * x), y: Math.round(box.height * y) },
  })
}

function selectedText(): string {
  return window.getSelection()?.toString() ?? ''
}

describe('ActionCard', () => {
  test('clicking anywhere on the card body calls onAction once', async () => {
    const { card, onAction } = renderCard()

    for (const [x, y] of [
      [0.02, 0.02],
      [0.95, 0.3],
      [0.95, 0.85],
      [0.5, 0.98],
    ]) {
      onAction.mockClear()
      await clickAt(card, x, y)
      expect(onAction).toHaveBeenCalledTimes(1)
    }

    onAction.mockClear()
    await userEvent.click(screen.getByText('Research · step 2 of 3'), UNDER_THE_HIT_AREA)
    await userEvent.click(screen.getByText('Approval needed'), UNDER_THE_HIT_AREA)
    await userEvent.click(screen.getByText(TITLE))
    expect(onAction).toHaveBeenCalledTimes(3)
  })

  test.each(['light', 'inverse'] as const)(
    'on the %s tone, clicking a nested button or link does not call onAction',
    async (tone) => {
      const { onAction, onQueue, link, button } = renderCard({}, tone)

      await userEvent.click(button)
      await userEvent.click(link)
      expect(onQueue).toHaveBeenCalledTimes(1)
      expect(onAction).not.toHaveBeenCalled()
    }
  )

  test('pressing Enter on a nested button or link does not call onAction', async () => {
    const { onAction, onQueue, link, button } = renderCard()

    button.focus()
    await userEvent.keyboard('{Enter}')
    link.focus()
    await userEvent.keyboard('{Enter}')
    expect(onQueue).toHaveBeenCalledTimes(1)
    expect(onAction).not.toHaveBeenCalled()
  })

  test('Enter and Space on the main action call onAction', async () => {
    const { onAction, action } = renderCard()

    action.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onAction).toHaveBeenCalledTimes(2)
  })

  test('the main action and the nested controls are siblings, none inside another', () => {
    const { action, link, button } = renderCard()

    for (const control of [link, button]) {
      expect(action.contains(control)).toBe(false)
      expect(control.contains(action)).toBe(false)
    }
    expect(action.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull()
  })

  test.each([
    { tone: 'light', ring: '--color-accent' },
    { tone: 'inverse', ring: '--color-accent-300' },
  ] as const)(
    'on the $tone tone, Tab reaches the main action then each nested control, with the ring of $ring on the card',
    async ({ tone, ring }) => {
      const { card, action, link, button } = renderCard({}, tone)

      await userEvent.keyboard('{Tab}')
      expect(document.activeElement).toBe(action)
      const cardStyle = getComputedStyle(card)
      expect(cardStyle.outlineStyle).toBe('solid')
      expect(cardStyle.outlineWidth).toBe('2px')
      expect(cardStyle.outlineOffset).toBe('2px')
      expect(cardStyle.outlineColor).toBe(resolvedColor(ring, card))
      expect(getComputedStyle(action).outlineStyle).toBe('none')

      await userEvent.keyboard('{Tab}')
      expect(document.activeElement).toBe(link)
      expect(getComputedStyle(card).outlineStyle).toBe('none')

      await userEvent.keyboard('{Tab}')
      expect(document.activeElement).toBe(button)
      expect(getComputedStyle(card).outlineStyle).toBe('none')
    }
  )

  test('a click on the card does not draw the ring', async () => {
    const { card, action } = renderCard()

    await userEvent.click(action)
    expect(document.activeElement).toBe(action)
    expect(getComputedStyle(card).outlineStyle).toBe('none')
  })

  test('text inside a nested code element can be selected, and selecting it does not call onAction', async () => {
    const { code, onAction } = renderCard()

    window.getSelection()?.removeAllRanges()
    await userEvent.tripleClick(code)
    expect(selectedText()).toContain(COMMAND)
    expect(onAction).not.toHaveBeenCalled()
  })

  test('text under the hit area cannot be selected with the mouse', async () => {
    renderCard()
    const meta = screen.getByText('Research · step 2 of 3')

    window.getSelection()?.removeAllRanges()
    await userEvent.tripleClick(meta, UNDER_THE_HIT_AREA)
    expect(selectedText()).toBe('')
    expect(getComputedStyle(meta).userSelect).toBe('none')
  })

  test('the nested controls are raised one step above the hit area', () => {
    const { link, button, code, action } = renderCard()

    for (const control of [link, button, code]) {
      expect(getComputedStyle(control).zIndex).toBe('1')
      expect(getComputedStyle(control).position).toBe('relative')
    }
    expect(getComputedStyle(action).zIndex).toBe('auto')
    expect(getComputedStyle(action, '::after').position).toBe('absolute')
  })

  test('the light card fills --color-accent-100 on hover and --color-accent-200 while pressed', async () => {
    const { card, action } = renderCard()

    expect(getComputedStyle(card).backgroundColor).toBe(CLEAR)
    await userEvent.hover(screen.getByText('Research · step 2 of 3'), UNDER_THE_HIT_AREA)
    expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--color-accent-100'))

    action.focus()
    await userEvent.keyboard('{Space>}')
    expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--color-accent-200'))
    await userEvent.keyboard('{/Space}')
    await userEvent.unhover(card)
  })

  test('the light card keeps its rest fill under the pointer on a nested control', async () => {
    const { card, button } = renderCard()

    await userEvent.hover(button)
    expect(getComputedStyle(card).backgroundColor).toBe(CLEAR)
    await userEvent.unhover(button)
  })

  test('the inverse card does not change on hover', async () => {
    const { card } = renderCard({}, 'inverse')
    const rest = getComputedStyle(card).backgroundColor

    expect(rest).toBe(resolvedColor('--inverse-bg'))
    await userEvent.hover(screen.getByText('Research · step 2 of 3'), UNDER_THE_HIT_AREA)
    expect(getComputedStyle(card).backgroundColor).toBe(rest)
    await userEvent.unhover(card)
  })

  test.each([
    { state: 'selected', props: { selected: true }, border: '--color-divider' },
    { state: 'lifted', props: { lifted: true }, border: '--color-accent-300' },
  ])('a $state light card fills --color-accent-100 with a $border border', ({ props, border }) => {
    const { card } = renderCard(props)
    const style = getComputedStyle(card)

    expect(style.backgroundColor).toBe(resolvedColor('--color-accent-100'))
    expect(style.borderTopColor).toBe(resolvedColor(border))
  })

  test('selected and lifted do not change the inverse card', () => {
    const { card } = renderCard({ selected: true, lifted: true }, 'inverse')
    const style = getComputedStyle(card)

    expect(style.backgroundColor).toBe(resolvedColor('--inverse-bg'))
    expect(style.borderTopColor).toBe(resolvedColor('--inverse-bg'))
  })

  test('the card has no padding or gap of its own', () => {
    renderComponent(
      <ActionCard title={TITLE} onAction={() => {}}>
        <p>Plain</p>
      </ActionCard>
    )
    const style = getComputedStyle(screen.getByRole('article'))

    expect(style.padding).toBe('0px')
    expect(style.rowGap).toBe('normal')
  })

  test('renders an article with the title in an h3 by default, and other elements when asked', () => {
    renderComponent(
      <>
        <ActionCard title="Default" onAction={() => {}} />
        <ActionCard title="As a div" element="div" headingLevel={2} onAction={() => {}} />
        <ul>
          <ActionCard title="As an item" element="li" headingLevel={null} onAction={() => {}} />
        </ul>
      </>
    )

    expect(screen.getByRole('article')).toContainElement(
      screen.getByRole('heading', { level: 3, name: 'Default' })
    )
    expect(screen.getByRole('heading', { level: 2, name: 'As a div' }).closest('div')).not.toBe(
      null
    )
    expect(screen.getByRole('listitem')).toContainElement(
      screen.getByRole('button', { name: 'As an item' })
    )
    expect(screen.queryByRole('heading', { name: 'As an item' })).toBeNull()
  })

  test('aria-haspopup is set on the main action only when asked', () => {
    renderComponent(
      <>
        <ActionCard title="Opens the drawer" aria-haspopup="dialog" onAction={() => {}} />
        <ActionCard title="Plain" onAction={() => {}} />
      </>
    )

    expect(
      screen.getByRole('button', { name: 'Opens the drawer' }).getAttribute('aria-haspopup')
    ).toBe('dialog')
    expect(screen.getByRole('button', { name: 'Plain' }).hasAttribute('aria-haspopup')).toBe(false)
  })
})
