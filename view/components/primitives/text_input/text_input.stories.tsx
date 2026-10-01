// Copied from anachoic inertia/components/primitives/text_input/text_input.stories.tsx at fd99e0d
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { resolvedColor } from '../../testing/resolved_color'
import { Frame } from '../frame/frame'
import { TextArea } from '../text_area/text_area'
import { TextInput, type TextFieldBaseProps, type TextInputProps } from './text_input'

const LONG_TITLE = LONG_TEXT.title

/**
 * Holds the value the way a form does, so typing in the story shows.
 */
function Controlled(props: TextInputProps) {
  const [value, setValue] = useState(props.value)
  return (
    <TextInput
      {...props}
      value={value}
      onChange={(text) => {
        setValue(text)
        props.onChange(text)
      }}
    />
  )
}

/**
 * Storybook cannot draw controls for the union that requires a name, so the
 * stories name each field with `label`.
 */
type StoryArgs = TextFieldBaseProps<HTMLInputElement> & { label: string }

const meta = {
  title: 'Primitives/TextInput',
  component: TextInput,
  args: {
    label: 'Title',
    placeholder: 'What needs doing?',
    value: '',
    onChange: fn(),
    onKeyDown: fn(),
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
  name: 'Field fill, empty with a placeholder',
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Title' })
    await userEvent.type(input, 'Fix')

    expect(args.onChange).toHaveBeenLastCalledWith('Fix')
    expect(getComputedStyle(input).backgroundColor).toBe(resolvedColor('--color-surface'))
  },
}

export const Filled: Story = {
  name: 'Field fill, with a value',
  args: { value: 'Write the release notes for the billing webhooks' },
}

export const Ground: Story = {
  name: 'Ground fill, inside the follow-up composer tint',
  args: { label: 'Follow-up task', fill: 'ground', placeholder: 'Describe the follow-up' },
  render: (args) => (
    <Frame fill="tint" emphasis="selected">
      <div style={{ padding: 'var(--space-3)' }}>
        <Controlled {...args} />
      </div>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Follow-up task' })

    expect(getComputedStyle(input).backgroundColor).toBe(resolvedColor('--color-bg'))
  },
}

export const Disabled: Story = {
  args: { value: 'Write the release notes for the billing webhooks', disabled: true },
}

export const Invalid: Story = {
  name: 'Invalid, with a describing note',
  args: {
    label: 'Step title',
    placeholder: 'What this step does',
    value: '',
    invalid: true,
    describedBy: 'step-note',
  },
  render: (args) => (
    <div style={{ display: 'grid', gap: 'var(--gap-stack)' }}>
      <Controlled {...args} />
      <p id="step-note" className="text-hint">
        A step needs a title
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', {
      name: 'Step title',
      description: 'A step needs a title',
    })

    expect(input.getAttribute('aria-describedby')).toBe('step-note')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  },
}

export const LongValue: Story = {
  name: 'A value of 120 characters',
  args: { value: LONG_TITLE },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox') as HTMLInputElement

    expect(input.value).toHaveLength(120)
  },
}

export const Inverted: Story = {
  name: 'Both fields inside an inverse Frame',
  render: (args) => (
    <Frame tone="inverse">
      <div style={{ display: 'grid', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
        <span id="inverse-label" className="text-body-sm">
          Answer
        </span>
        <TextArea
          labelledBy="inverse-label"
          describedBy="inverse-note"
          placeholder="Your answer to the agent"
          minHeight={64}
          value=""
          onChange={args.onChange}
        />
        <span id="inverse-note" className="text-hint">
          An answer needs some text
        </span>
        <Controlled {...args} label="Note" placeholder="Add a note for the next step" />
      </div>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const area = canvas.getByRole('textbox', { name: 'Answer' })
    const input = canvas.getByRole('textbox', { name: 'Note' })

    for (const field of [area, input]) {
      const style = getComputedStyle(field)
      expect(style.backgroundColor).toBe(resolvedColor('--inverse-well'))
      expect(style.borderTopColor).toBe(resolvedColor('--inverse-border'))
      expect(style.color).toBe(resolvedColor('--inverse-fg'))
    }
  },
}
