import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { boardHeader } from '../../helpers/strings'
import { ViewFrame } from '../../testing/view_frame'
import { BoardHeader } from './board_header'

const meta = {
  title: 'Board/BoardHeader',
  component: BoardHeader,
  args: {
    counts: { yourTurn: 0, working: 0, queue: 0, toSignOff: 0 },
    updated: false,
    unreachable: false,
  },
  parameters: {
    a11y: {
      /*
       * The labels and the updated cue show --color-text-subtle, which is
       * below 4.5:1 by design (ui/16, "Built as designed"). The contrast of
       * the text roles belongs to the tokens, so only that rule is off here.
       */
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
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
    await expect(canvas.getByText('Your turn: 0 tasks')).toBeInTheDocument()
    await expect(canvas.queryByText(boardHeader.updated)).toBeNull()
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
  args: { counts: { yourTurn: 1, working: 2, queue: 4, toSignOff: 0 }, updated: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(boardHeader.updated)).toBeVisible()
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
