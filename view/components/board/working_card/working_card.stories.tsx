import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WORKING } from '../../fixtures/board_sections'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { WorkingCard } from './working_card'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

async function expectNoSidewaysScroll() {
  const [sideways] = await windowOverflow()
  await expect(sideways).toBe(0)
}

const meta = {
  title: 'Board/WorkingCard',
  component: WorkingCard,
  args: {
    item: WORKING.one,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The elapsed time, the task id and the dimmed note are below 4.5:1 by
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
} satisfies Meta<typeof WorkingCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'A worker running a step',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12m 00s elapsed')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: WORKING.one.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(WORKING.one.task.id)
  },
}

export const ThisChat: Story = {
  name: 'This chat running a step',
  args: { item: WORKING.thisChat },
}

export const NoNote: Story = {
  name: 'No note',
  args: { item: WORKING.noNote },
}

export const LongNote: Story = {
  name: 'A note of 500 characters',
  args: { item: WORKING.longNote },
  play: expectNoSidewaysScroll,
}

export const LongTitle: Story = {
  name: 'Long title and session name',
  args: { item: WORKING.longTitle },
  play: expectNoSidewaysScroll,
}

export const LongNoteNarrow: Story = {
  ...LongNote,
  name: 'A note of 500 characters, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title and session name, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
