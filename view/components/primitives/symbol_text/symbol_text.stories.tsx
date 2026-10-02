import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { SymbolText } from './symbol_text'
import { fullText } from '../../testing/text'

const meta = {
  title: 'Primitives/SymbolText',
  component: SymbolText,
  args: { children: 'Step 2 of 3 · Draft the migration' },
  render: (args) => (
    <p className="text-body-sm">
      <SymbolText {...args} />
    </p>
  ),
} satisfies Meta<typeof SymbolText>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'A middle dot between two facts',
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByText(fullText('·'))
    await expect(dot).toHaveAttribute('aria-hidden', 'true')
  },
}

export const Arrow: Story = {
  name: 'An artifact link’s label and arrow',
  args: { children: 'Pull request · step 1 ↗' },
}

export const Plain: Story = {
  name: 'Text without symbols',
  args: { children: 'Waiting on user' },
}

export const LongText: Story = {
  name: 'A step title of 120 characters',
  args: { children: `Step 1 · ${LONG_TEXT.title}` },
}

export const Inverted: Story = {
  name: 'On the inverted field',
  parameters: { tone: 'inverse' },
}
