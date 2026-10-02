import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DONE } from '../../fixtures/board_sections'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { SignOffCard } from './sign_off_card'

const meta = {
  title: 'Board/SignOffCard',
  component: SignOffCard,
  args: {
    task: DONE.flaky,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The task id shows --color-text-subtle and the stats line
       * --color-text-muted, below 4.5:1 by design (ui/16, "Built as
       * designed"). The contrast of the text roles belongs to the tokens, so
       * only that rule is off here.
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
} satisfies Meta<typeof SignOffCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Finished earlier today',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Finished today 08:05')).toBeVisible()
    await expect(canvasElement).toHaveTextContent('agent 42m · you 9m · 2 links')
    await userEvent.click(canvas.getByRole('button', { name: DONE.flaky.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(DONE.flaky.task.id)
  },
}

export const NoLinks: Story = {
  name: 'No links, finished yesterday',
  args: { task: DONE.noLinks },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('agent 5m · you — · 0 links')
  },
}

export const LongTitle: Story = {
  name: 'Long title',
  args: { task: DONE.longTitle },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}
