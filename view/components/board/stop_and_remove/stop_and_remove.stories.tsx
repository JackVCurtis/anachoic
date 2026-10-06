import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { sessions as strings } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { StopAndRemove } from './stop_and_remove'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

const meta = {
  title: 'Board/StopAndRemove',
  component: StopAndRemove,
  args: {
    workerName: 'api-server',
    taskDisplayId: 'T-012',
    onConfirm: fn(),
  },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof StopAndRemove>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'A worker holding a step',
}

export const Confirming: Story = {
  name: 'Asking before it stops the worker',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: strings.stopAndRemove }))
    await userEvent.click(canvas.getByRole('button', { name: strings.stopAndRemove }))
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}

export const Busy: Story = {
  name: 'Removing the worker',
  args: { busy: true },
}

export const Inverted: Story = {
  name: 'On the inverted field',
  args: { tone: 'inverse' },
  parameters: { tone: 'inverse' },
}

export const InvertedConfirming: Story = {
  ...Confirming,
  name: 'Asking on the inverted field',
  args: { tone: 'inverse' },
  parameters: { tone: 'inverse' },
}

export const LongName: Story = {
  name: 'A worker name of 40 characters, narrow',
  args: { workerName: LONG_TEXT.name },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: strings.stopAndRemove })
    )
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}
