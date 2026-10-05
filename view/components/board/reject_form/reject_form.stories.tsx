import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { reject } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { RejectForm } from './reject_form'

const meta = {
  title: 'Board/RejectForm',
  component: RejectForm,
  args: { tone: 'plain', onSend: fn(), onCancel: fn() },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof RejectForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'On a Done card, empty',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: reject.label })).toHaveFocus()
    await expect(canvas.getByText(reject.needsNote)).toBeVisible()
    await expect(canvas.getByRole('button', { name: reject.sendBack })).toBeDisabled()
    await expect(args.onSend).not.toHaveBeenCalled()
  },
}

export const WithNote: Story = {
  name: 'With a note typed',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole('textbox', { name: reject.label }),
      '  The PR targets the wrong branch  '
    )
    await expect(canvas.getByText(reject.redoes)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: reject.sendBack }))
    await expect(args.onSend).toHaveBeenCalledWith('The PR targets the wrong branch')
  },
}

export const Inverted: Story = {
  name: 'On a Waiting on user card',
  args: { tone: 'inverse' },
  parameters: { tone: 'inverse' },
}

export const Busy: Story = {
  name: 'Sending back',
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: reject.sendBack })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(canvas.getByRole('button', { name: reject.cancel })).toBeDisabled()
  },
}

export const Narrow: Story = {
  name: 'Narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}
