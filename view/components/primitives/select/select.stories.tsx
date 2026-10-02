// Adapted from anachoic inertia/components/primitives/select/select.stories.tsx at fd99e0d
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { resolvedColor } from '../../testing/resolved_color'
import { Select, type SelectOption, type SelectProps } from './select'

const THREE_WORKERS: SelectOption[] = [
  { value: 'api-server', label: 'api-server' },
  { value: 'web-client', label: 'web-client' },
  { value: 'billing-jobs', label: 'billing-jobs' },
]

/**
 * Thirty worker names of 40 characters each.
 */
const THIRTY_WORKERS: SelectOption[] = Array.from({ length: 30 }, (_, index) => {
  const name = `platform-${String(index + 1).padStart(2, '0')}-ledger-reconciliation-runner`
  return { value: name, label: name }
})

/**
 * Holds the value the way a form does, so choosing in the story shows.
 */
function Controlled(props: SelectProps) {
  const [value, setValue] = useState(props.value)
  return (
    <Select
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next)
        props.onChange(next)
      }}
    />
  )
}

/**
 * Storybook cannot draw controls for the union that requires a name, so the
 * stories name each field with `label`.
 */
type StoryArgs = Omit<SelectProps, 'labelledBy'> & { label: string }

const meta = {
  title: 'Primitives/Select',
  component: Select,
  args: {
    label: 'Worker',
    options: THREE_WORKERS,
    value: 'api-server',
    onChange: fn(),
  },
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 356 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<StoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Three workers',
  play: async ({ canvasElement, args }) => {
    const select = within(canvasElement).getByRole('combobox', { name: 'Worker' })
    await userEvent.selectOptions(select, 'billing-jobs')

    expect(args.onChange).toHaveBeenLastCalledWith('billing-jobs')
    expect(select).toHaveValue('billing-jobs')
    expect(getComputedStyle(select).backgroundColor).toBe(resolvedColor('--color-surface'))
  },
}

export const Many: Story = {
  name: 'Thirty workers of 40 characters',
  args: { options: THIRTY_WORKERS, value: THIRTY_WORKERS[0].value },
  play: async ({ canvasElement, args }) => {
    const select = within(canvasElement).getByRole('combobox', { name: 'Worker' })
    const last = THIRTY_WORKERS[29].value
    await userEvent.selectOptions(select, last)

    expect(within(select).getAllByRole('option')).toHaveLength(30)
    expect(last).toHaveLength(40)
    expect(args.onChange).toHaveBeenLastCalledWith(last)
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', { name: 'Worker' })

    expect(select).toBeDisabled()
  },
}

export const LongValue: Story = {
  name: 'A long selected value, cut by the browser',
  args: { options: THIRTY_WORKERS, value: THIRTY_WORKERS[11].value },
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole('combobox', { name: 'Worker' })

    expect(select).toHaveValue(THIRTY_WORKERS[11].value)
    expect(select.getBoundingClientRect().width).toBe(200)
  },
}
