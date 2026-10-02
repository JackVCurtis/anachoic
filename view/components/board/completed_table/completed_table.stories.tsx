// Copied from anachoic inertia/components/completed/completed_table/completed_table.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { HISTORY } from '../../fixtures/history'
import { LONG_TEXT } from '../../fixtures/long_text'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { CompletedTable } from './completed_table'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

const meta = {
  title: 'Board/CompletedTable',
  component: CompletedTable,
  args: {
    tasks: HISTORY.onePage.rows,
    onOpenTask: fn(),
    onOpenLink: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The header cells, the ids and the faint columns show
       * --color-text-column, --color-text-subtle and --color-text-faint,
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
} satisfies Meta<typeof CompletedTable>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Three tasks',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const [first] = HISTORY.onePage.rows

    await expect(canvas.getAllByRole('row')).toHaveLength(4)
    await userEvent.click(canvas.getByRole('button', { name: first.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledOnce()
    await expect(args.onOpenTask).toHaveBeenLastCalledWith(first.task.id)
  },
}

export const Twenty: Story = {
  name: 'A full page of twenty',
  args: { tasks: HISTORY.firstOfThree.rows },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('row')).toHaveLength(21)
  },
}

export const LongText: Story = {
  name: 'Long title, worker names and links',
  args: { tasks: HISTORY.longText.rows },
  play: async ({ canvasElement }) => {
    await expect(LONG_TEXT.title).toHaveLength(120)
    await expect(within(canvasElement).getByRole('button', { name: LONG_TEXT.title })).toBeVisible()
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const DefaultNarrow: Story = {
  ...Default,
  name: 'Three tasks, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongTextNarrow: Story = {
  ...LongText,
  name: 'Long title, worker names and links, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
