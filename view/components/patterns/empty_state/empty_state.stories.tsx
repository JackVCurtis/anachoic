// Copied from anachoic inertia/components/patterns/empty_state/empty_state.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LONG_TEXT } from '../../fixtures/long_text'
import { EmptyState } from './empty_state'

const meta = {
  title: 'Patterns/EmptyState',
  component: EmptyState,
  args: {
    variant: 'dashed',
    message: 'Nothing waiting on the user',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Waiting on user, dashed',
}

export const Inverted: Story = {
  name: 'Waiting on user, dashed, inverted',
  parameters: { tone: 'inverse' },
}

export const Queue: Story = {
  name: 'An empty section, dashed',
  args: { message: 'The queue is empty' },
}

export const Done: Story = {
  name: 'Nothing to sign off, framed',
  args: { variant: 'framed', message: 'Nothing to sign off' },
}

export const LongMessage: Story = {
  name: 'Long message, framed',
  args: { variant: 'framed', message: LONG_TEXT.message },
}
