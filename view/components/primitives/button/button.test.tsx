// Copied from anachoic inertia/components/primitives/button/button.test.tsx at fd99e0d
import { composeStories } from '@storybook/react-vite'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { VIEW_WIDTHS, windowOverflow } from '../../testing/view_frame'
import {
  Button,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  type ButtonSize,
  type ButtonVariant,
} from './button'
import * as stories from './button.stories'

function renderButton(
  variant: ButtonVariant,
  size: ButtonSize = 'md',
  tone: 'light' | 'inverse' = variant.startsWith('inverse') ? 'inverse' : 'light'
) {
  const result = renderComponent(
    // The union of props is narrowed by BUTTON_SIZES, which the compiler cannot follow.
    <Button {...({ variant, size } as { variant: 'primary'; size: ButtonSize })}>
      Queue task
    </Button>,
    { tone }
  )
  return { ...result, button: screen.getByRole('button', { name: 'Queue task' }) }
}

const EVERY_LOOK = BUTTON_VARIANTS.flatMap((variant) =>
  BUTTON_SIZES[variant].map((size) => ({ variant, size }))
)

const HEADING = { fontWeight: '600', letterSpacing: 'normal', textTransform: 'none' }
const INVERTED = { fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }
const UTILITY = { fontWeight: '400', textTransform: 'uppercase' }

/**
 * The measurement table of ui/07. Letter spacing is 0.08em, written in pixels
 * at the button's font size.
 */
const MEASUREMENTS: Array<{
  variant: ButtonVariant
  size: ButtonSize
  padding: string
  fontSize: string
  fontWeight: string
  letterSpacing: string
  textTransform: string
}> = [
  { variant: 'primary', size: 'md', padding: '6.8px 12.24px', fontSize: '14px', ...HEADING },
  { variant: 'secondary', size: 'md', padding: '6.8px 12.24px', fontSize: '14px', ...HEADING },
  { variant: 'primary', size: 'sm', padding: '3px 10px', fontSize: '12px', ...HEADING },
  { variant: 'secondary', size: 'sm', padding: '3px 10px', fontSize: '12px', ...HEADING },
  { variant: 'ghost', size: 'md', padding: '6.8px 3.4px', fontSize: '14px', ...HEADING },
  { variant: 'ghost', size: 'sm', padding: '3px 3.4px', fontSize: '12px', ...HEADING },
  { variant: 'inverse-solid', size: 'md', padding: '7px 14px', fontSize: '12.5px', ...INVERTED },
  { variant: 'inverse-outline', size: 'md', padding: '7px 14px', fontSize: '12.5px', ...INVERTED },
  {
    variant: 'utility',
    size: 'sm',
    padding: '3px 9px',
    fontSize: '11px',
    letterSpacing: '0.88px',
    ...UTILITY,
  },
  {
    variant: 'utility',
    size: 'md',
    padding: '5px 11px',
    fontSize: '11.5px',
    letterSpacing: '0.92px',
    ...UTILITY,
  },
]

/**
 * The fill, border and text of each variant at rest, then its hover fill. A
 * null text is inherited from the surface, which is --tone-fg.
 */
const LOOKS: Array<{
  variant: ButtonVariant
  fill: string | null
  border: string
  text: string
  hover: string
}> = [
  {
    variant: 'primary',
    fill: '--color-accent',
    border: '--color-accent',
    text: '--color-text-on-fill',
    hover: '--color-accent-600',
  },
  {
    variant: 'secondary',
    fill: null,
    border: '--color-divider',
    text: '--color-text',
    hover: '--tint-hover',
  },
  {
    variant: 'ghost',
    fill: null,
    border: 'transparent',
    text: '--color-text-accent',
    hover: '--tint-accent-hover',
  },
  {
    variant: 'inverse-solid',
    fill: '--color-bg',
    border: '--color-bg',
    text: '--color-accent-900',
    hover: '--color-accent-100',
  },
  {
    variant: 'inverse-outline',
    fill: null,
    border: '--inverse-border',
    text: '--tone-fg',
    hover: '--tone-tint-hover',
  },
  {
    variant: 'utility',
    fill: null,
    border: '--tone-control-border-quiet',
    text: '--tone-fg',
    hover: '--tone-tint-hover',
  },
]

function colorOf(token: string, at: Element): string {
  return token === 'transparent' ? 'rgba(0, 0, 0, 0)' : resolvedColor(token, at)
}

describe('Button', () => {
  test('is a native button of type button, or submit when asked', () => {
    renderComponent(
      <>
        <Button>Add to backlog</Button>
        <Button type="submit">Register repo</Button>
      </>
    )

    expect(screen.getByRole('button', { name: 'Add to backlog' }).getAttribute('type')).toBe(
      'button'
    )
    expect(screen.getByRole('button', { name: 'Register repo' }).getAttribute('type')).toBe(
      'submit'
    )
  })

  test('a press calls onPress', async () => {
    const onPress = vi.fn()
    const { user } = renderComponent(<Button onPress={onPress}>Sign off</Button>)

    await user.click(screen.getByRole('button'))
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onPress).toHaveBeenCalledTimes(3)
  })

  test.each([
    { state: 'busy', props: { busy: true } },
    { state: 'disabled', props: { disabled: true } },
    { state: 'busy and disabled', props: { busy: true, disabled: true } },
  ])('a $state button does not call its handler on click or Enter', async ({ props }) => {
    const onPress = vi.fn()
    const { user } = renderComponent(
      <Button {...props} onPress={onPress}>
        Sign off
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Sign off' })

    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onPress).not.toHaveBeenCalled()
  })

  test('a busy submit button does not submit its form', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault())
    const { user } = renderComponent(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button type="submit" busy>
          Register repo
        </Button>
      </form>
    )
    const button = screen.getByRole('button')

    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('busy sets aria-busy, keeps its label and its focus, and looks disabled', async () => {
    const { user } = renderComponent(<Button busy>Approve &amp; resume</Button>)
    const button = screen.getByRole('button', { name: 'Approve & resume' })
    const style = getComputedStyle(button)

    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(style.opacity).toBe('0.45')
    expect(style.cursor).toBe('not-allowed')

    await user.tab()
    expect(document.activeElement).toBe(button)
  })

  test('disabled uses --opacity-disabled and the not-allowed cursor', () => {
    renderComponent(<Button disabled>Delete</Button>)
    const button = screen.getByRole('button', { name: 'Delete' })
    const style = getComputedStyle(button)

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.hasAttribute('aria-busy')).toBe(false)
    expect(style.opacity).toBe('0.45')
    expect(style.cursor).toBe('not-allowed')
  })

  test.each(MEASUREMENTS)(
    '$variant $size is padded $padding, type $fontWeight $fontSize',
    ({ variant, size, ...expected }) => {
      const style = getComputedStyle(renderButton(variant, size).button)

      expect(style.padding).toBe(expected.padding)
      expect(style.fontSize).toBe(expected.fontSize)
      expect(style.fontWeight).toBe(expected.fontWeight)
      expect(style.letterSpacing).toBe(expected.letterSpacing)
      expect(style.textTransform).toBe(expected.textTransform)
      expect(style.fontFamily).toContain('Barlow Condensed')
      expect(style.borderTopWidth).toBe('1px')
      expect(style.borderRadius).toBe('0px')
    }
  )

  test.each(LOOKS)('$variant has its fill, border and text', ({ variant, ...look }) => {
    const { button } = renderButton(variant)
    const style = getComputedStyle(button)

    expect(style.backgroundColor).toBe(look.fill ? colorOf(look.fill, button) : 'rgba(0, 0, 0, 0)')
    expect(style.borderTopColor).toBe(colorOf(look.border, button))
    expect(style.color).toBe(colorOf(look.text, button))
  })

  test('utility and inverse-outline take the text of the surface', () => {
    renderComponent(
      <div style={{ color: 'rgb(1, 2, 3)' }}>
        <Button variant="utility">Copy</Button>
        <Button variant="inverse-outline">Cancel</Button>
      </div>
    )

    expect(getComputedStyle(screen.getByRole('button', { name: 'Copy' })).color).toBe(
      'rgb(1, 2, 3)'
    )
    expect(getComputedStyle(screen.getByRole('button', { name: 'Cancel' })).color).toBe(
      'rgb(1, 2, 3)'
    )
  })

  test('utility on the light surface has the light quiet border', () => {
    const { button } = renderButton('utility', 'sm', 'light')

    expect(getComputedStyle(button).borderTopColor).toBe(resolvedColor('--color-divider'))
  })

  test.each(LOOKS)(
    '$variant takes its hover fill under the pointer',
    async ({ variant, hover }) => {
      const { button } = renderButton(variant)

      await userEvent.hover(button)
      expect(getComputedStyle(button).backgroundColor).toBe(colorOf(hover, button))
      await userEvent.unhover(button)
    }
  )

  test.each(['busy', 'disabled'] as const)('a %s button has no hover fill', async (state) => {
    renderComponent(
      <Button variant="secondary" {...{ [state]: true }}>
        Follow up
      </Button>
    )
    const button = screen.getByRole('button')

    await userEvent.hover(button)
    expect(getComputedStyle(button).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    await userEvent.unhover(button)
  })

  test.each([
    { tone: 'light', variant: 'primary', ring: '--color-accent' },
    { tone: 'inverse', variant: 'inverse-solid', ring: '--color-accent-300' },
  ] as const)(
    'keyboard focus on the $tone surface draws a 2px ring of $ring at 2px',
    async ({ tone, variant, ring }) => {
      renderComponent(<Button variant={variant}>Approve</Button>, { tone })
      const button = screen.getByRole('button')

      await userEvent.keyboard('{Tab}')
      expect(document.activeElement).toBe(button)
      const style = getComputedStyle(button)
      expect(style.outlineStyle).toBe('solid')
      expect(style.outlineWidth).toBe('2px')
      expect(style.outlineOffset).toBe('2px')
      expect(style.outlineColor).toBe(resolvedColor(ring))
    }
  )

  test('a click does not draw the focus ring', async () => {
    renderComponent(<Button>Approve</Button>)
    const button = screen.getByRole('button')

    await userEvent.click(button)
    expect(document.activeElement).toBe(button)
    expect(getComputedStyle(button).outlineStyle).toBe('none')
  })

  test.each(EVERY_LOOK.filter(({ size }) => size === 'sm'))(
    '$variant sm is at least 24px tall',
    ({ variant }) => {
      const { button } = renderButton(variant, 'sm')

      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    }
  )

  test('a leading icon sits 6px before the label, hidden', () => {
    renderComponent(
      <Button variant="secondary" icon="plus">
        New workflow
      </Button>
    )
    const button = screen.getByRole('button', { name: 'New workflow' })
    const svg = button.querySelector('svg') as SVGSVGElement

    expect(button.firstElementChild).toBe(svg)
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getBoundingClientRect().width).toBe(14)
    expect(getComputedStyle(button).columnGap).toBe('6px')
  })

  test('block fills its parent, stretch takes the free space in a row', () => {
    renderComponent(
      <div style={{ display: 'flex', width: 400 }}>
        <Button variant="inverse-solid" stretch>
          Deny &amp; resume
        </Button>
        <div style={{ width: 100 }} />
      </div>
    )
    renderComponent(
      <div style={{ width: 300 }}>
        <Button variant="secondary" block>
          New workflow
        </Button>
      </div>
    )

    expect(
      screen.getByRole('button', { name: 'Deny & resume' }).getBoundingClientRect().width
    ).toBe(300)
    expect(screen.getByRole('button', { name: 'New workflow' }).getBoundingClientRect().width).toBe(
      300
    )
  })

  test('passes native attributes and a className through', () => {
    renderComponent(
      <>
        <p id="title">Refactor the sync worker</p>
        <Button variant="secondary" size="sm" aria-describedby="title" className="placed">
          Queue →
        </Button>
      </>
    )
    const button = screen.getByRole('button', { description: 'Refactor the sync worker' })

    expect(button.classList.contains('placed')).toBe(true)
  })

  test('the inverted buttons have one size, checked by the compiler', () => {
    const small = (
      // @ts-expect-error The inverted buttons have no small size.
      <Button variant="inverse-solid" size="sm">
        Confirm
      </Button>
    )
    // @ts-expect-error The handler is onPress, named for the product.
    const clicked = <Button onClick={() => {}}>Confirm</Button>

    expect([small, clicked]).toHaveLength(2)
  })
})

const { Narrow, NarrowInverse, NarrowLongLabel } = composeStories(stories)

describe('Button at the narrow width', () => {
  afterEach(async () => {
    await page.viewport(414, 896)
  })

  test.each([
    ['every light variant', Narrow],
    ['every inverted variant', NarrowInverse],
    ['a long label', NarrowLongLabel],
  ])('%s drawn in ViewFrame at 600 px has no sideways overflow', async (_name, Story) => {
    await page.viewport(VIEW_WIDTHS.narrow, 900)
    renderComponent(<Story />)

    const [sideways] = await windowOverflow()
    expect(sideways).toBe(0)
  })
})
