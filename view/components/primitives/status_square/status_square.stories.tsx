// Copied from anachoic inertia/components/primitives/status_square/status_square.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatusSquare } from './status_square'

const meta = {
  title: 'Primitives/StatusSquare',
  component: StatusSquare,
  args: { state: 'attention' },
  render: (args) => (
    <span
      className="text-name"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
    >
      <StatusSquare {...args} />
      {args.state}
    </span>
  ),
} satisfies Meta<typeof StatusSquare>

export default meta

type Story = StoryObj<typeof meta>

const INVERSE = { tone: 'inverse' } as const

export const Default: Story = {
  name: 'Attention, blinking every 1.6s',
}

export const Busy: Story = {
  name: 'Busy, blinking every 1s',
  args: { state: 'busy' },
}

export const Running: Story = {
  name: 'Running, still',
  args: { state: 'running' },
}

export const Waiting: Story = {
  name: 'Waiting, still',
  args: { state: 'waiting' },
}

export const Idle: Story = {
  name: 'Idle, still',
  args: { state: 'idle' },
}

export const AttentionInverted: Story = {
  name: 'Attention, inverted',
  parameters: INVERSE,
}

export const BusyInverted: Story = {
  name: 'Busy, inverted',
  args: { state: 'busy' },
  parameters: INVERSE,
}

export const RunningInverted: Story = {
  name: 'Running, inverted',
  args: { state: 'running' },
  parameters: INVERSE,
}

export const WaitingInverted: Story = {
  name: 'Waiting, inverted',
  args: { state: 'waiting' },
  parameters: INVERSE,
}

export const IdleInverted: Story = {
  name: 'Idle, inverted',
  args: { state: 'idle' },
  parameters: INVERSE,
}
