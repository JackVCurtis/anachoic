import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WORKING } from '../../fixtures/board_sections'
import { working } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { WorkingSection } from './working_section'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

const meta = {
  title: 'Board/WorkingSection',
  component: WorkingSection,
  args: {
    tasks: [WORKING.one],
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The count, the empty state, the elapsed times and the dimmed notes are
       * below 4.5:1 by design (ui/16, "Built as designed"). The contrast of
       * the text roles belongs to the tokens, so only that rule is off here.
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
} satisfies Meta<typeof WorkingSection>

export default meta

type Story = StoryObj<typeof meta>

export const OneTask: Story = {
  name: 'One task',
}

export const SeveralSessions: Story = {
  name: 'Several sessions working at once',
  args: { tasks: WORKING.severalSessions },
}

export const ThisChat: Story = {
  name: 'This chat working',
  args: { tasks: [WORKING.thisChat, WORKING.one] },
}

export const NoNote: Story = {
  name: 'No note',
  args: { tasks: [WORKING.noNote] },
}

export const LongNote: Story = {
  name: 'A note of 500 characters and a long title',
  args: { tasks: [WORKING.longNote, WORKING.longTitle] },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const Many: Story = {
  name: 'Twelve cards, folded after eight',
  args: { tasks: WORKING.many },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('article')).toHaveLength(8)
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 12' }))
    await expect(canvas.getAllByRole('article')).toHaveLength(12)
  },
}

export const Empty: Story = {
  name: 'Nothing running',
  args: { tasks: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(working.nothingWorking)).toBeVisible()
  },
}

export const SeveralSessionsNarrow: Story = {
  ...SeveralSessions,
  name: 'Several sessions working at once, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongNoteNarrow: Story = {
  ...LongNote,
  name: 'A note of 500 characters and a long title, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
