// Copied from anachoic inertia/components/board/backlog_section/backlog_section.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BACKLOG } from '../../fixtures/board_sections'
import { backlog, queue } from '../../helpers/strings'
import { resolvedColor } from '../../testing/resolved_color'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { BacklogSection } from './backlog_section'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

function sectionOf(canvasElement: HTMLElement): HTMLElement {
  const heading = within(canvasElement).getByRole('heading', { level: 2, name: backlog.title })
  return heading.closest('section') as HTMLElement
}

const meta = {
  title: 'Board/BacklogSection',
  component: BacklogSection,
  args: {
    tasks: BACKLOG.busy,
    selectedTaskId: null,
    onOpenTask: fn(),
    onQueueTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The count and the meta lines show --color-text-subtle and
       * --color-text-meta, below 4.5:1 by design (ui/16, "Built as designed").
       * The contrast of the text roles belongs to the tokens, so only that
       * rule is off here.
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
} satisfies Meta<typeof BacklogSection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Six tasks',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('listitem')).toHaveLength(BACKLOG.busy.length)
    await expect(canvas.getAllByRole('button', { name: 'Queue' })).toHaveLength(BACKLOG.busy.length)
    await expect(canvas.queryByRole('button', { name: queue.move })).toBeNull()
  },
}

export const Empty: Story = {
  name: 'Empty',
  args: { tasks: [] },
  play: async ({ canvasElement }) => {
    await expect(sectionOf(canvasElement).children).toHaveLength(1)
    await expect(within(canvasElement).queryByRole('list')).toBeNull()
  },
}

export const Many: Story = {
  name: 'Fourteen tasks, folded after eight',
  args: { tasks: BACKLOG.fourteen },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('listitem')).toHaveLength(8)
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 14' }))
    await expect(canvas.getAllByRole('listitem')).toHaveLength(14)
  },
}

export const CannotQueue: Story = {
  name: 'A task that cannot be queued',
  args: { tasks: [BACKLOG.cannotQueue, ...BACKLOG.busy.slice(0, 2)] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('button', { name: 'Queue' })).toHaveLength(2)
  },
}

export const Selected: Story = {
  name: 'A card whose task is open in the task panel',
  args: { selectedTaskId: BACKLOG.busy[1].task.id },
  play: async ({ canvasElement }) => {
    const title = within(canvasElement).getByRole('button', { name: BACKLOG.busy[1].task.title })
    const card = title.closest('li')?.firstElementChild as HTMLElement

    await expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--color-accent-100'))
  },
}

export const LongTitle: Story = {
  name: 'Long title',
  args: { tasks: BACKLOG.longTitle },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const DefaultNarrow: Story = {
  ...Default,
  name: 'Six tasks, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
