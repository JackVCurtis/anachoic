// Copied from anachoic inertia/components/primitives/icon_button/icon_button.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ViewFrame } from '../../testing/view_frame'
import { IconButton } from './icon_button'

const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  args: {
    'glyph': '×',
    'aria-label': 'Close',
    'onPress': fn(),
  },
} satisfies Meta<typeof IconButton>

export default meta

type Story = StoryObj<typeof meta>

export const Close: Story = {
  name: 'Close, as in the task view header',
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Close' })

    await expect(button.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(button)
    await expect(args.onPress).toHaveBeenCalledTimes(1)
  },
}

export const Disabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Close' }))
    await expect(args.onPress).not.toHaveBeenCalled()
  },
}

export const Inverted: Story = {
  name: 'Close, inverted',
  parameters: { tone: 'inverse' },
}

export const Narrow: Story = {
  name: 'Close, at the narrow width',
  decorators: [
    (Story) => (
      <ViewFrame width="narrow">
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Story />
        </div>
      </ViewFrame>
    ),
  ],
}

export const NarrowInverted: Story = {
  ...Narrow,
  name: 'Close, inverted, at the narrow width',
  parameters: { tone: 'inverse' },
}
