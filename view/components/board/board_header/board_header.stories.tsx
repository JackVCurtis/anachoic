import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { before, FIXED_NOW } from '../../fixtures/clock'
import { boardHeader } from '../../helpers/strings'
import { ViewFrame } from '../../testing/view_frame'
import { BoardHeader } from './board_header'

const meta = {
  title: 'Board/BoardHeader',
  component: BoardHeader,
  args: {
    counts: { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 },
    updatedAt: null,
    unreachable: false,
  },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof BoardHeader>

export default meta

type Story = StoryObj<typeof meta>

export const ZeroCounts: Story = {
  name: 'Every count at zero',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Waiting on user: 0 tasks')).toBeInTheDocument()
    await expect(canvas.queryByText(/^Updated/)).toBeNull()
    await expect(canvas.queryByText(boardHeader.cantReach)).toBeNull()
  },
}

export const MixedCounts: Story = {
  name: 'Mixed counts',
  args: { counts: { yourTurn: 2, working: 3, queue: 1, toSignOff: 12 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Queue: 1 task')).toBeInTheDocument()
    await expect(canvas.getByText('To sign off: 12 tasks')).toBeInTheDocument()
  },
}

export const Updated: Story = {
  name: 'Just updated',
  args: { counts: { yourTurn: 1, working: 2, queue: 4, toSignOff: 0 }, updatedAt: FIXED_NOW },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Updated just now')).toBeVisible()
  },
}

export const UpdatedAWhileAgo: Story = {
  name: 'Updated a while ago',
  args: {
    counts: { yourTurn: 1, working: 2, queue: 4, toSignOff: 0 },
    updatedAt: before({ minutes: 12 }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Updated 12m ago')).toBeVisible()
  },
}

export const Unreachable: Story = {
  name: "Can't reach the board",
  args: { counts: { yourTurn: 1, working: 2, queue: 4, toSignOff: 0 }, unreachable: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(boardHeader.cantReach)).toBeVisible()
  },
}

export const Narrow: Story = {
  name: 'Mixed counts, narrow',
  args: { counts: { yourTurn: 12, working: 3, queue: 20, toSignOff: 14 }, unreachable: true },
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}
