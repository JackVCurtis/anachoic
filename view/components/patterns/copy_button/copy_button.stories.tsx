// Copied from anachoic inertia/components/patterns/copy_button/copy_button.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { QUEUE } from '../../fixtures/board_sections'
import { copy } from '../../helpers/strings'
import { clipboardAnswer, installClipboard } from '../../testing/clipboard'
import { CopyButton } from './copy_button'

const IDS = QUEUE.busy.map((item) => item.task.displayId)

const writeText = fn(clipboardAnswer('resolve'))

const meta = {
  title: 'Patterns/CopyButton',
  component: CopyButton,
  args: {
    text: IDS[0],
    label: copy.copy,
    confirmedLabel: copy.copied,
    use: 'command',
    onCopied: fn(),
  },
  /* The story's own clipboard, so a press confirms without the page's permission. */
  beforeEach: () => installClipboard(writeText),
} satisfies Meta<typeof CopyButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Copy a task id',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: copy.copy }))
    await expect(await canvas.findByRole('button', { name: copy.copied })).toBeInTheDocument()
    await expect(writeText).toHaveBeenCalledWith(args.text)
    await expect(args.onCopied).toHaveBeenCalledTimes(1)
  },
}

export const Inverted: Story = {
  name: 'Copy a task id, inverted',
  parameters: { tone: 'inverse' },
}

export const CopyAll: Story = {
  name: 'Copy every id in the queue',
  args: {
    text: IDS.join('\n'),
    label: copy.copyAll,
    confirmedLabel: copy.copiedAll,
    use: 'all',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: copy.copyAll }))
    await expect(await canvas.findByRole('button', { name: copy.copiedAll })).toBeInTheDocument()
    await expect(writeText).toHaveBeenCalledWith(args.text)
  },
}
