// Copied from anachoic inertia/components/patterns/status_badge/status_badge.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { taskView } from '../../helpers/strings'
import { StatusBadge } from './status_badge'

const INVERSE = { tone: 'inverse' } as const

const meta = {
  title: 'Patterns/StatusBadge',
  component: StatusBadge,
  args: { list: 'working' },
} satisfies Meta<typeof StatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Working: running',
}

export const YourTurn: Story = {
  name: 'Your turn, an agent step that asked you',
  args: { list: 'yourTurn' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(taskView.badgeYourTurn)).toBeVisible()
  },
}

export const ToSignOff: Story = {
  name: 'To sign off',
  args: { list: 'toSignOff' },
}

export const SignedOff: Story = {
  name: 'Signed off: done',
  args: { list: 'signedOff' },
}

export const Queue: Story = {
  name: 'Queue: queue',
  args: { list: 'queue' },
}

export const Backlog: Story = {
  name: 'Backlog: backlog',
  args: { list: 'backlog' },
}

export const DefaultInverted: Story = {
  name: 'Working: running, inverted',
  parameters: INVERSE,
}

export const YourTurnInverted: Story = {
  name: 'Your turn, inverted',
  args: YourTurn.args,
  parameters: INVERSE,
}

export const ToSignOffInverted: Story = {
  name: 'To sign off, inverted',
  args: ToSignOff.args,
  parameters: INVERSE,
}

export const SignedOffInverted: Story = {
  name: 'Signed off: done, inverted',
  args: SignedOff.args,
  parameters: INVERSE,
}

export const QueueInverted: Story = {
  name: 'Queue: queue, inverted',
  args: Queue.args,
  parameters: INVERSE,
}

export const BacklogInverted: Story = {
  name: 'Backlog: backlog, inverted',
  args: Backlog.args,
  parameters: INVERSE,
}
