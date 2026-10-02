import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { YOUR_TURN } from '../../fixtures/board_sections'
import { yourTurn } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { YourTurnSection } from './your_turn_section'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

const meta = {
  title: 'Board/YourTurnSection',
  component: YourTurnSection,
  args: {
    tasks: [YOUR_TURN.yourStep, YOUR_TURN.question],
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The count, the empty state and the dimmed counters are below 4.5:1 by
       * design (ui/16, "Built as designed"). The contrast of the text roles
       * belongs to the tokens, so only that rule is off here.
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
} satisfies Meta<typeof YourTurnSection>

export default meta

type Story = StoryObj<typeof meta>

export const EachKind: Story = {
  name: 'Your step and an agent’s question',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your step')).toBeVisible()
    await expect(canvas.getByText('This chat asks')).toBeVisible()
  },
}

export const NothingWaiting: Story = {
  name: 'Nothing waiting',
  args: { tasks: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(yourTurn.nothingWaiting)).toBeVisible()
  },
}

export const Many: Story = {
  name: 'Twenty cards, folded after eight',
  args: { tasks: YOUR_TURN.many },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('article')).toHaveLength(8)
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 20' }))
    await expect(canvas.getAllByRole('article')).toHaveLength(20)
  },
}

export const LongText: Story = {
  name: 'Long title and a question of 2,000 characters',
  args: { tasks: [YOUR_TURN.longTitle, YOUR_TURN.longQuestion] },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const EachKindNarrow: Story = {
  ...EachKind,
  name: 'Your step and an agent’s question, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const NothingWaitingNarrow: Story = {
  ...NothingWaiting,
  name: 'Nothing waiting, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const ManyNarrow: Story = {
  ...Many,
  name: 'Twenty cards, folded after eight, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongTextNarrow: Story = {
  ...LongText,
  name: 'Long title and a question of 2,000 characters, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
