import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { YOUR_TURN } from '../../fixtures/board_sections'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { YourTurnCard } from './your_turn_card'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

async function expectNoSidewaysScroll() {
  const [sideways] = await windowOverflow()
  await expect(sideways).toBe(0)
}

const meta = {
  title: 'Board/YourTurnCard',
  component: YourTurnCard,
  args: {
    item: YOUR_TURN.yourStep,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The counter and the task id are dimmed to --dim-2 on the inverted
       * field, below 4.5:1 by design (ui/16, "Built as designed"). The
       * contrast of the text roles belongs to the tokens, so only that rule is
       * off here.
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
} satisfies Meta<typeof YourTurnCard>

export default meta

type Story = StoryObj<typeof meta>

export const YourStep: Story = {
  name: 'Your step',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your step')).toBeVisible()
    await expect(canvas.getByText('Step 3/4 · 14m')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: YOUR_TURN.yourStep.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(YOUR_TURN.yourStep.task.id)
  },
}

export const Question: Story = {
  name: "An agent's question",
  args: { item: YOUR_TURN.question },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('This chat asks')).toBeVisible()
    await expect(canvas.getByText('Redis or in-process?')).toBeVisible()
  },
}

export const LongQuestion: Story = {
  name: 'A question of 2,000 characters',
  args: { item: YOUR_TURN.longQuestion },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const LongTitle: Story = {
  name: 'Long title and session name',
  args: { item: YOUR_TURN.longTitle },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const YourStepNarrow: Story = {
  name: 'Your step, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const LongQuestionNarrow: Story = {
  name: 'A question of 2,000 characters, narrow',
  args: { item: YOUR_TURN.longQuestion },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const LongTitleNarrow: Story = {
  name: 'Long title and session name, narrow',
  args: { item: YOUR_TURN.longTitle },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}
