// Copied from anachoic inertia/components/primitives/text_input/text_input.test.tsx at fd99e0d
import { createRef, useState, type KeyboardEvent } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent as browserUser } from 'vitest/browser'
import { renderComponent, renderInTone } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { TextInput, type TextInputProps } from './text_input'

function Controlled({ onChange, ...props }: Omit<TextInputProps, 'value'>) {
  const [value, setValue] = useState('')
  return (
    <TextInput
      {...(props as TextInputProps)}
      value={value}
      onChange={(text) => {
        setValue(text)
        onChange(text)
      }}
    />
  )
}

function field(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement
}

/**
 * WCAG relative luminance of an `rgb()` or `rgba()` computed color, after
 * blending it over an opaque backdrop into the 8-bit channels the screen shows.
 */
function luminance(color: string, backdrop: string): number {
  const parse = (value: string) => value.match(/[\d.]+/g)!.map(Number)
  const [r, g, b, alpha = 1] = parse(color)
  const [br, bg, bb] = parse(backdrop)
  const channels = [
    [r, br],
    [g, bg],
    [b, bb],
  ].map(([front, back]) => {
    const blended = Math.round(front * alpha + back * (1 - alpha)) / 255
    return blended <= 0.04045 ? blended / 12.92 : ((blended + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(color: string, backdrop: string): number {
  const [light, dark] = [luminance(color, backdrop), luminance(backdrop, backdrop)].sort(
    (a, b) => b - a
  )
  return (light + 0.05) / (dark + 0.05)
}

/**
 * From anachoic ui/16-accessibility.md, "Measured ratios", the row
 * "White at 45% | Accent-900 | 4.11": the border of the outlined button and of
 * a field on the inverted field.
 */
const WHITE_45_ON_ACCENT_900 = 4.11

describe('TextInput on the light surface', () => {
  test('rests on the field tokens at the documented measurements', () => {
    renderComponent(
      <TextInput label="Enter task" placeholder="Title" value="" onChange={() => {}} />
    )
    const style = getComputedStyle(field())

    expect(field().type).toBe('text')
    expect(style.backgroundColor).toBe(resolvedColor('--tone-field-bg'))
    expect(style.backgroundColor).toBe(resolvedColor('--color-surface'))
    expect(style.borderTopColor).toBe(resolvedColor('--color-divider'))
    expect(style.borderTopWidth).toBe('1px')
    expect(style.borderRadius).toBe('0px')
    expect(style.color).toBe(resolvedColor('--color-text'))
    expect(style.caretColor).toBe(resolvedColor('--color-accent'))
    expect(style.fontSize).toBe('14px')
    expect(style.minHeight).toBe('36px')
    expect(style.padding).toBe('6px 10px')
    expect(style.width).toBe(getComputedStyle(field().parentElement!).width)
    expect(getComputedStyle(field(), '::placeholder').color).toBe(
      resolvedColor('--color-text-subtle')
    )
  })

  test('the ground fill is --color-bg', () => {
    renderComponent(<TextInput label="Prompt" fill="ground" value="" onChange={() => {}} />)

    expect(getComputedStyle(field()).backgroundColor).toBe(resolvedColor('--color-bg'))
  })

  test('hover darkens the border to --tint-field-hover', async () => {
    renderComponent(<TextInput label="Enter task" value="" onChange={() => {}} />)
    await browserUser.hover(field())

    expect(getComputedStyle(field()).borderTopColor).toBe(resolvedColor('--tint-field-hover'))
  })

  test('focus turns the border to --tone-focus with a 2px ring at offset 0', async () => {
    const { user } = renderComponent(<TextInput label="Enter task" value="" onChange={() => {}} />)
    await user.tab()
    const style = getComputedStyle(field())

    expect(document.activeElement).toBe(field())
    expect(style.borderTopColor).toBe(resolvedColor('--color-accent'))
    expect(style.outlineColor).toBe(resolvedColor('--color-accent'))
    expect(style.outlineStyle).toBe('solid')
    expect(style.outlineWidth).toBe('2px')
    expect(style.outlineOffset).toBe('0px')
  })

  test('disabled dims the field to --opacity-disabled', () => {
    renderComponent(<TextInput label="Enter task" value="" onChange={() => {}} disabled />)

    expect(field().disabled).toBe(true)
    expect(getComputedStyle(field()).opacity).toBe('0.45')
  })

  test('invalid sets aria-invalid and changes no color', () => {
    renderComponent(
      <>
        <TextInput label="Path" value="~/code" onChange={() => {}} invalid />
        <TextInput label="Name" value="core" onChange={() => {}} />
      </>
    )
    const [invalid, valid] = screen.getAllByRole('textbox')
    const [bad, good] = [getComputedStyle(invalid), getComputedStyle(valid)]

    expect(invalid.getAttribute('aria-invalid')).toBe('true')
    expect(valid.hasAttribute('aria-invalid')).toBe(false)
    expect(bad.borderTopColor).toBe(good.borderTopColor)
    expect(bad.color).toBe(good.color)
    expect(bad.backgroundColor).toBe(good.backgroundColor)
  })
})

describe('TextInput on the inverted surface', () => {
  test('is a dark well with the outlined button border, light text and an accent-300 caret', () => {
    renderInTone(
      <TextInput
        label="Instruction"
        placeholder="What should the agent do instead?"
        value=""
        onChange={() => {}}
      />,
      'inverse'
    )
    const style = getComputedStyle(field())

    expect(style.backgroundColor).toBe(resolvedColor('--inverse-well'))
    expect(style.borderTopColor).toBe(resolvedColor('--inverse-border'))
    expect(style.color).toBe(resolvedColor('--inverse-fg'))
    expect(style.caretColor).toBe(resolvedColor('--color-accent-300'))
    expect(getComputedStyle(field(), '::placeholder').color).toBe('rgba(242, 242, 243, 0.6)')
  })

  test('hover takes --inverse-border-strong and focus takes accent-300', async () => {
    const { user } = renderInTone(
      <TextInput label="Instruction" value="" onChange={() => {}} />,
      'inverse'
    )
    await browserUser.hover(field())
    expect(getComputedStyle(field()).borderTopColor).toBe(resolvedColor('--inverse-border-strong'))

    await user.tab()
    const style = getComputedStyle(field())
    expect(style.borderTopColor).toBe(resolvedColor('--color-accent-300'))
    expect(style.outlineColor).toBe(resolvedColor('--color-accent-300'))
  })

  test('the border measures 4.11:1 against accent-900, as the token table says', () => {
    renderInTone(<TextInput label="Instruction" value="" onChange={() => {}} />, 'inverse')
    const border = getComputedStyle(field()).borderTopColor
    const ratio = contrast(border, resolvedColor('--color-accent-900'))

    expect(border).toBe('rgba(255, 255, 255, 0.45)')
    expect(ratio.toFixed(2)).toBe(WHITE_45_ON_ACCENT_900.toFixed(2))
    expect(ratio).toBeGreaterThanOrEqual(3)
  })
})

describe('TextInput data and events', () => {
  test('typing raises onChange with the new text', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<Controlled label="Enter task" onChange={onChange} />)
    await user.type(field(), 'Fix')

    expect(onChange.mock.calls).toEqual([['F'], ['Fi'], ['Fix']])
    expect(field().value).toBe('Fix')
  })

  test('onKeyDown receives Enter with shiftKey and isComposing intact', async () => {
    const keys: Array<{ key: string; shiftKey: boolean; isComposing: boolean }> = []
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) =>
      keys.push({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
      })
    const { user } = renderComponent(
      <TextInput label="Enter task" value="" onChange={() => {}} onKeyDown={onKeyDown} />
    )
    await user.click(field())
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    fireEvent.keyDown(field(), { key: 'Enter', shiftKey: false, isComposing: true })

    expect(keys.filter((entry) => entry.key === 'Enter')).toEqual([
      { key: 'Enter', shiftKey: true, isComposing: false },
      { key: 'Enter', shiftKey: false, isComposing: true },
    ])
  })

  test('aria-describedby points at the note id when given', () => {
    renderComponent(
      <>
        <TextInput
          label="Path"
          value="~/code/nowhere"
          onChange={() => {}}
          describedBy="path-note"
          invalid
        />
        <p id="path-note">No folder at that path</p>
      </>
    )

    expect(field().getAttribute('aria-describedby')).toBe('path-note')
    expect(screen.getByRole('textbox', { description: 'No folder at that path' })).toBe(field())
  })

  test('without a note there is no aria-describedby', () => {
    renderComponent(<TextInput label="Enter task" value="" onChange={() => {}} />)

    expect(field().hasAttribute('aria-describedby')).toBe(false)
  })

  test('the name comes from label or from the labelling element, never the placeholder', () => {
    renderComponent(
      <>
        <TextInput label="Enter task" placeholder="Title" value="" onChange={() => {}} />
        <span id="repo-name">Name</span>
        <TextInput labelledBy="repo-name" placeholder="Optional" value="" onChange={() => {}} />
      </>
    )

    expect(screen.getByRole('textbox', { name: 'Enter task' }).getAttribute('placeholder')).toBe(
      'Title'
    )
    expect(screen.getByRole('textbox', { name: 'Name' }).getAttribute('placeholder')).toBe(
      'Optional'
    )
  })

  test('shows the value, and passes id, name and ref to the input', () => {
    const ref = createRef<HTMLInputElement>()
    renderComponent(
      <TextInput
        label="Path"
        id="repo-path"
        name="path"
        value="~/code/core-api"
        onChange={() => {}}
        ref={ref}
      />
    )

    expect(field().value).toBe('~/code/core-api')
    expect(field().id).toBe('repo-path')
    expect(field().name).toBe('path')
    expect(ref.current).toBe(field())
  })
})
