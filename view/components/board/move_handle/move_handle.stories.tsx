// Copied from anachoic inertia/components/board/move_handle/move_handle.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { assistive, queue } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import { MoveHandle } from './move_handle'

const TITLE_ID = 'card-title'
const INSTRUCTIONS_ID = 'move-instructions'
const TITLE = 'Add rate limiting to the public search endpoint'

const meta = {
  title: 'Board/MoveHandle',
  component: MoveHandle,
  args: {
    lifted: false,
    disabled: false,
    describedBy: `${TITLE_ID} ${INSTRUCTIONS_ID}`,
    onLift: fn(),
    onDrop: fn(),
  },
  decorators: [
    (Story) => (
      <div>
        <VisuallyHidden id={TITLE_ID}>{TITLE}</VisuallyHidden>
        <VisuallyHidden id={INSTRUCTIONS_ID}>{assistive.moveDescription}</VisuallyHidden>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MoveHandle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'At rest',
  play: async ({ args, canvasElement }) => {
    const handle = within(canvasElement).getByRole('button', { name: queue.move })

    await expect(handle).toHaveAccessibleDescription(`${TITLE} ${assistive.moveDescription}`)
    await expect(getComputedStyle(handle).cursor).toBe('grab')
    await expect(handle.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    await userEvent.click(handle)
    await expect(args.onLift).toHaveBeenCalledOnce()
    await expect(args.onDrop).not.toHaveBeenCalled()
  },
}

export const Lifted: Story = {
  name: 'Its card lifted',
  args: { lifted: true },
  play: async ({ args, canvasElement }) => {
    const handle = within(canvasElement).getByRole('button', { name: queue.drop })

    await expect(getComputedStyle(handle).cursor).toBe('grabbing')
    await userEvent.click(handle)
    await expect(args.onDrop).toHaveBeenCalledOnce()
    await expect(args.onLift).not.toHaveBeenCalled()
  },
}

export const Disabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: queue.move })).toBeDisabled()
  },
}
