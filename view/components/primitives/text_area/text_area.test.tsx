// Copied from anachoic inertia/components/primitives/text_area/text_area.test.tsx at fd99e0d
import { createRef, useState, type KeyboardEvent } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { renderComponent, renderInTone } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { TextArea } from './text_area'

function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

function Controlled({ onChange }: { onChange: (text: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <TextArea
      label="Message to the workflow agent"
      minHeight={72}
      value={value}
      onChange={(text) => {
        setValue(text)
        onChange(text)
      }}
    />
  )
}

describe('TextArea', () => {
  test('is a textarea at 13px that resizes vertically only, on the field tokens', () => {
    renderComponent(
      <TextArea label="Prompt" placeholder="Prompt" minHeight={76} value="" onChange={() => {}} />
    )
    const style = getComputedStyle(field())

    expect(field().tagName).toBe('TEXTAREA')
    expect(style.fontSize).toBe('13px')
    expect(style.resize).toBe('vertical')
    expect(style.padding).toBe('6px 10px')
    expect(style.borderRadius).toBe('0px')
    expect(style.backgroundColor).toBe(resolvedColor('--color-surface'))
    expect(style.borderTopColor).toBe(resolvedColor('--color-divider'))
    expect(style.color).toBe(resolvedColor('--color-text'))
    expect(style.caretColor).toBe(resolvedColor('--color-accent'))
    expect(getComputedStyle(field(), '::placeholder').color).toBe(
      resolvedColor('--color-text-subtle')
    )
  })

  test.each([76, 64, 72])('takes the minimum height of %ipx from its parent', (minHeight) => {
    renderComponent(<TextArea label="Prompt" minHeight={minHeight} value="" onChange={() => {}} />)

    expect(getComputedStyle(field()).minHeight).toBe(`${minHeight}px`)
    expect(field().getBoundingClientRect().height).toBeGreaterThanOrEqual(minHeight)
  })

  test('the ground fill is --color-bg', () => {
    renderComponent(
      <TextArea label="Prompt" fill="ground" minHeight={64} value="" onChange={() => {}} />
    )

    expect(getComputedStyle(field()).backgroundColor).toBe(resolvedColor('--color-bg'))
  })

  test('on the inverted surface it is the dark well', () => {
    renderInTone(
      <TextArea
        label="Instruction"
        placeholder="What should the agent do instead?"
        minHeight={64}
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

  test('disabled dims it, and invalid sets aria-invalid', () => {
    renderComponent(
      <TextArea label="Prompt" minHeight={76} value="" onChange={() => {}} disabled invalid />
    )

    expect(getComputedStyle(field()).opacity).toBe('0.45')
    expect(field().getAttribute('aria-invalid')).toBe('true')
  })

  test('typing raises onChange with the new text, across lines', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<Controlled onChange={onChange} />)
    await user.type(field(), 'a{Enter}b')

    expect(onChange.mock.calls).toEqual([['a'], ['a\n'], ['a\nb']])
  })

  test('onKeyDown receives Enter with shiftKey and isComposing intact', async () => {
    const keys: Array<{ shiftKey: boolean; isComposing: boolean }> = []
    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter') {
        keys.push({ shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing })
      }
    }
    const { user } = renderComponent(
      <TextArea
        label="Message to the workflow agent"
        minHeight={72}
        value=""
        onChange={() => {}}
        onKeyDown={onKeyDown}
      />
    )
    await user.click(field())
    await user.keyboard('{Enter}{Shift>}{Enter}{/Shift}')
    fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true, isComposing: true })

    expect(keys).toEqual([
      { shiftKey: false, isComposing: false },
      { shiftKey: true, isComposing: false },
      { shiftKey: true, isComposing: true },
    ])
  })

  test('aria-describedby points at the note id, and the label names it', () => {
    const ref = createRef<HTMLTextAreaElement>()
    renderComponent(
      <>
        <span id="instruction-label">Instruction</span>
        <TextArea
          labelledBy="instruction-label"
          describedBy="instruction-note"
          minHeight={64}
          value=""
          onChange={() => {}}
          ref={ref}
        />
        <span id="instruction-note">Needs an instruction</span>
      </>
    )

    expect(field().getAttribute('aria-describedby')).toBe('instruction-note')
    expect(
      screen.getByRole('textbox', { name: 'Instruction', description: 'Needs an instruction' })
    ).toBe(field())
    expect(ref.current).toBe(field())
  })
})
