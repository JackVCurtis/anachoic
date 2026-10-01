// Copied from anachoic inertia/components/primitives/text_area/text_area.stories.tsx at fd99e0d
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { Frame } from '../frame/frame'
import type { TextFieldBaseProps } from '../text_input/text_input'
import { TextArea, type TextAreaProps } from './text_area'

/**
 * Holds the value the way a form does, so typing in the story shows.
 */
function Controlled(props: TextAreaProps) {
  const [value, setValue] = useState(props.value)
  return (
    <TextArea
      {...props}
      value={value}
      onChange={(text) => {
        setValue(text)
        props.onChange(text)
      }}
    />
  )
}

async function expectMinHeight(canvasElement: HTMLElement, minHeight: number) {
  const area = within(canvasElement).getByRole('textbox')

  expect(getComputedStyle(area).minHeight).toBe(`${minHeight}px`)
  expect(area.getBoundingClientRect().height).toBeGreaterThanOrEqual(minHeight)
}

/**
 * Storybook cannot draw controls for the union that requires a name, so the
 * stories name each field with `label`.
 */
type StoryArgs = TextFieldBaseProps<HTMLTextAreaElement> & { label: string; minHeight: number }

const meta = {
  title: 'Primitives/TextArea',
  component: TextArea,
  args: {
    label: 'Detail',
    placeholder: 'What whoever does this step needs to know',
    minHeight: 76,
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
  name: 'Step detail in task entry, 76px',
  play: ({ canvasElement }) => expectMinHeight(canvasElement, 76),
}

export const Composer: Story = {
  name: 'Follow-up in the Done section, 64px, ground fill',
  args: { label: 'Follow-up', minHeight: 64, fill: 'ground' },
  render: (args) => (
    <Frame fill="tint" emphasis="selected">
      <div style={{ padding: 'var(--space-3)' }}>
        <Controlled {...args} />
      </div>
    </Frame>
  ),
  play: ({ canvasElement }) => expectMinHeight(canvasElement, 64),
}

export const Note: Story = {
  name: 'Note on Mark done, 72px',
  args: {
    label: 'Note',
    placeholder: 'Add a note for the next step',
    minHeight: 72,
  },
  play: ({ canvasElement }) => expectMinHeight(canvasElement, 72),
}

export const Answer: Story = {
  name: 'Answer to an agent’s question, 64px, inverted',
  args: {
    label: 'Answer',
    placeholder: 'Your answer to the agent',
    minHeight: 64,
  },
  parameters: { tone: 'inverse' },
  play: ({ canvasElement }) => expectMinHeight(canvasElement, 64),
}

export const Filled: Story = {
  name: 'Detail with several lines',
  args: {
    value:
      'Read the webhook consumers and list every place they retry.\nFor each, say what they retry on and how long they wait.\nDo not change any code.',
  },
}

export const Disabled: Story = {
  args: { value: 'Summarize the failing tests', disabled: true },
}

export const Invalid: Story = {
  name: 'Invalid, with a describing note',
  args: { label: 'Answer', invalid: true, describedBy: 'answer-note' },
  render: (args) => (
    <div style={{ display: 'grid', gap: 'var(--gap-stack)' }}>
      <Controlled {...args} />
      <p id="answer-note" className="text-hint">
        An answer needs some text
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const area = within(canvasElement).getByRole('textbox', {
      name: 'Answer',
      description: 'An answer needs some text',
    })

    expect(area.getAttribute('aria-invalid')).toBe('true')
  },
}

export const LongestAnswer: Story = {
  name: 'Answer of 4,000 characters, the longest answer_question accepts, inverted',
  args: { label: 'Answer', minHeight: 64, value: LONG_TEXT.answer },
  parameters: { tone: 'inverse' },
  play: async ({ canvasElement }) => {
    const area = within(canvasElement).getByRole('textbox', { name: 'Answer' })

    expect((area as HTMLTextAreaElement).value).toHaveLength(4000)
  },
}
