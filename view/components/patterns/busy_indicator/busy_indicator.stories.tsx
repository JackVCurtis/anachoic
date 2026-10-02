// Copied from anachoic inertia/components/patterns/busy_indicator/busy_indicator.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { busy } from '../../helpers/strings'
import { BusyIndicator } from './busy_indicator'

const meta = {
  title: 'Patterns/BusyIndicator',
  component: BusyIndicator,
  parameters: {
    a11y: {
      /*
       * The label shows --color-text-subtle, which is below 4.5:1 by design
       * (ui/16, "Built as designed"). The contrast of the text roles belongs to
       * the tokens, so only that rule is off here.
       */
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
  args: { label: busy.loadingTask },
} satisfies Meta<typeof BusyIndicator>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Loading task, in the task view',
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status')

    await expect(status).toHaveTextContent(busy.loadingTask)
  },
}

export const LoadingBoard: Story = {
  name: 'Loading board',
  args: { label: busy.loadingBoard },
}

export const Inverted: Story = {
  name: 'Loading task, inverted',
  parameters: { tone: 'inverse' },
}
