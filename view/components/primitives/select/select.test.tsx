// Adapted from anachoic inertia/components/primitives/select/select.test.tsx at fd99e0d
import { createRef, useState } from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { userEvent as browserUser } from 'vitest/browser'
import { renderComponent } from '../../testing/render'
import { resolvedColor } from '../../testing/resolved_color'
import { Select, type SelectOption } from './select'

const WORKERS: SelectOption[] = [
  { value: '', label: 'Any worker' },
  { value: 'api-server', label: 'api-server' },
  { value: 'web-client', label: 'web-client' },
  { value: 'billing-jobs', label: 'billing-jobs' },
]

function Controlled({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('api-server')
  return (
    <Select
      label="Worker"
      options={WORKERS}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

function field(): HTMLSelectElement {
  return screen.getByRole('combobox') as HTMLSelectElement
}

function chevron(): SVGElement {
  return field().parentElement!.querySelector('svg')!
}

describe('Select look', () => {
  test('is the native select drawn as a text field', () => {
    renderComponent(
      <Select label="Worker" options={WORKERS} value="api-server" onChange={() => {}} />
    )
    const style = getComputedStyle(field())

    expect(field().tagName).toBe('SELECT')
    expect(style.appearance).toBe('none')
    expect(style.width).toBe(getComputedStyle(field().parentElement!.parentElement!).width)
    expect(style.minHeight).toBe('36px')
    expect(field().getBoundingClientRect().height).toBe(36)
    expect(style.padding).toBe('6px 32px 6px 10px')
    expect(style.fontSize).toBe('14px')
    expect(style.fontWeight).toBe('400')
    expect(style.fontFamily).toBe(getComputedStyle(document.body).fontFamily)
    expect(style.color).toBe(resolvedColor('--color-text'))
    expect(style.backgroundColor).toBe(resolvedColor('--color-surface'))
    expect(style.borderTopColor).toBe(resolvedColor('--color-divider'))
    expect(style.borderTopWidth).toBe('1px')
    expect(style.borderRadius).toBe('0px')
  })

  test('the chevron is chevron-down at 14px in --color-text-subtle, 10px in and centred', () => {
    renderComponent(
      <Select label="Worker" options={WORKERS} value="api-server" onChange={() => {}} />
    )
    const icon = chevron()
    const box = icon.getBoundingClientRect()
    const frame = field().getBoundingClientRect()

    expect(icon.classList.contains('lucide-chevron-down')).toBe(true)
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(box.width).toBe(14)
    expect(box.height).toBe(14)
    expect(getComputedStyle(icon).color).toBe(resolvedColor('--color-text-subtle'))
    expect(getComputedStyle(icon).pointerEvents).toBe('none')
    expect(frame.right - box.right).toBe(10)
    expect(box.top + box.height / 2).toBe(frame.top + frame.height / 2)
  })

  test('a click on the chevron reaches the field', () => {
    renderComponent(
      <Select label="Worker" options={WORKERS} value="api-server" onChange={() => {}} />
    )
    const box = chevron().getBoundingClientRect()

    expect(document.elementFromPoint(box.left + 7, box.top + 7)).toBe(field())
  })

  test('hover darkens the border to --tint-field-hover', async () => {
    renderComponent(
      <Select label="Worker" options={WORKERS} value="api-server" onChange={() => {}} />
    )
    await browserUser.hover(field())

    expect(getComputedStyle(field()).borderTopColor).toBe(resolvedColor('--tint-field-hover'))
  })

  test('focus turns the border to --tone-focus with a 2px ring at offset 0', async () => {
    const { user } = renderComponent(
      <Select label="Worker" options={WORKERS} value="api-server" onChange={() => {}} />
    )
    await user.tab()
    const style = getComputedStyle(field())

    expect(document.activeElement).toBe(field())
    expect(style.borderTopColor).toBe(resolvedColor('--color-accent'))
    expect(style.outlineColor).toBe(resolvedColor('--color-accent'))
    expect(style.outlineStyle).toBe('solid')
    expect(style.outlineWidth).toBe('2px')
    expect(style.outlineOffset).toBe('0px')
  })

  test('disabled dims the field and its chevron to --opacity-disabled', async () => {
    renderComponent(
      <Select label="Worker" options={WORKERS} value="api-server" onChange={() => {}} disabled />
    )
    await browserUser.hover(field(), { force: true })

    expect(field().disabled).toBe(true)
    expect(getComputedStyle(field().parentElement!).opacity).toBe('0.45')
    expect(getComputedStyle(field()).borderTopColor).toBe(resolvedColor('--color-divider'))
    expect(getComputedStyle(field()).cursor).toBe('not-allowed')
  })
})

describe('Select data and events', () => {
  test('shows each option and the selected value', () => {
    renderComponent(
      <Select label="Worker" options={WORKERS} value="web-client" onChange={() => {}} />
    )

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Any worker',
      'api-server',
      'web-client',
      'billing-jobs',
    ])
    expect(field().value).toBe('web-client')
    expect(screen.getByRole('option', { name: 'web-client', selected: true })).toBeTruthy()
  })

  test('choosing an option raises onChange with its value, including the last and the empty one', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<Controlled onChange={onChange} />)
    await user.selectOptions(field(), 'web-client')
    await user.selectOptions(field(), 'billing-jobs')
    await user.selectOptions(field(), 'Any worker')

    expect(onChange.mock.calls).toEqual([['web-client'], ['billing-jobs'], ['']])
    expect(field().value).toBe('')
  })

  test('the name comes from label or from the labelling element', () => {
    renderComponent(
      <>
        <Select label="Worker" options={WORKERS} value="" onChange={() => {}} />
        <span id="worker-legend">Assigned worker</span>
        <Select labelledBy="worker-legend" options={WORKERS} value="" onChange={() => {}} />
      </>
    )

    expect(screen.getByRole('combobox', { name: 'Worker' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Assigned worker' })).toBeTruthy()
  })

  test('passes id, name, a describing note and ref to the select', () => {
    const ref = createRef<HTMLSelectElement>()
    renderComponent(
      <>
        <Select
          label="Worker"
          id="worker"
          name="worker"
          describedBy="worker-note"
          options={WORKERS}
          value=""
          onChange={() => {}}
          ref={ref}
        />
        <p id="worker-note">Optional</p>
      </>
    )

    expect(field().id).toBe('worker')
    expect(field().name).toBe('worker')
    expect(screen.getByRole('combobox', { description: 'Optional' })).toBe(field())
    expect(ref.current).toBe(field())
  })
})
