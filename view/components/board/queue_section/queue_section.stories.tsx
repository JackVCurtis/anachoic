// Copied from anachoic inertia/components/board/queue_section/queue_section.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { QUEUE } from '../../fixtures/board_sections'
import { queue } from '../../helpers/strings'
import { resolvedColor } from '../../testing/resolved_color'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { QueueSection } from './queue_section'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

const [FIRST, SECOND, THIRD] = QUEUE.busy

function sectionOf(canvasElement: HTMLElement): HTMLElement {
  const heading = within(canvasElement).getByRole('heading', { level: 2, name: queue.title })
  return heading.closest('section') as HTMLElement
}

const meta = {
  title: 'Board/QueueSection',
  component: QueueSection,
  args: {
    tasks: QUEUE.busy,
    busy: false,
    selectedTaskId: null,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof QueueSection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Four tasks, one resumes and the others start',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const items = canvas.getAllByRole('listitem')

    await expect(canvas.getByRole('list').tagName).toBe('OL')
    await expect(items).toHaveLength(QUEUE.busy.length)
    await expect(items[0]).toHaveTextContent('#1 in line')
    await expect(items[0]).toHaveTextContent('resumes at step 2/3 · agent')
    await expect(items[1]).toHaveTextContent('starts at step 1/2 · agent')
    await expect(canvas.queryByRole('button', { name: queue.move })).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: FIRST.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(FIRST.task.id)
  },
}

export const Empty: Story = {
  name: 'Empty',
  args: { tasks: [] },
  play: async ({ canvasElement }) => {
    const section = sectionOf(canvasElement)

    await expect(section.children).toHaveLength(1)
    await expect(section).toHaveTextContent(`${queue.title}0`)
    await expect(within(canvasElement).queryByRole('list')).toBeNull()
  },
}

export const OneCard: Story = {
  name: 'One task, nothing to reorder',
  args: { tasks: QUEUE.one, onReorder: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('listitem')).toHaveLength(1)
    await expect(canvas.queryByRole('button', { name: queue.move })).toBeNull()
  },
}

export const Many: Story = {
  name: 'Twenty tasks, never folded',
  args: { tasks: QUEUE.twenty },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('listitem')).toHaveLength(20)
    await expect(canvas.getByText('#20 in line')).toBeVisible()
  },
}

export const Movable: Story = {
  name: 'With Move handles',
  args: { onReorder: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('button', { name: queue.move })).toHaveLength(4)
    await userEvent.click(canvas.getAllByRole('button', { name: queue.move })[0])
    await expect(args.onOpenTask).not.toHaveBeenCalled()
  },
}

/**
 * Lifts the card whose title is given with its Move handle, then presses the
 * keys given, as the keyboard would.
 */
async function liftWithKeys(canvasElement: HTMLElement, title: string, keys = '') {
  const canvas = within(canvasElement)
  const item = canvas.getByRole('button', { name: title }).closest('li') as HTMLElement
  within(item).getByRole('button', { name: queue.move }).focus()
  await userEvent.keyboard(`{Enter}${keys}`)
  return within(item).getByRole('button', { name: queue.drop })
}

export const Lifted: Story = {
  name: 'A card lifted',
  args: { onReorder: fn() },
  play: async ({ canvasElement }) => {
    const handle = await liftWithKeys(canvasElement, THIRD.task.title, '{ArrowUp}')

    await expect(handle).toHaveFocus()
    await expect(canvasElement.querySelector('[aria-live="assertive"]')).toHaveTextContent(
      'Position 2 of 4'
    )
  },
}

export const LiftedAtFront: Story = {
  name: 'A card lifted to the front',
  args: { onReorder: fn() },
  play: async ({ canvasElement }) => {
    const handle = await liftWithKeys(canvasElement, THIRD.task.title, '{Home}')

    await expect(handle.closest('li')).toHaveTextContent('#1 in line')
  },
}

export const LiftedAtBack: Story = {
  name: 'A card lifted to the back',
  args: { onReorder: fn() },
  play: async ({ canvasElement }) => {
    const handle = await liftWithKeys(canvasElement, FIRST.task.title, '{End}')

    await expect(handle.closest('li')).toHaveTextContent(`#${QUEUE.busy.length} in line`)
  },
}

export const Twelve: Story = {
  name: 'Twelve tasks with Move handles, one lifted',
  args: { tasks: QUEUE.twenty.slice(0, 12), onReorder: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getAllByRole('button', { name: queue.move })[0].focus()
    await userEvent.keyboard('{Enter}{ArrowDown}{ArrowDown}')

    await expect(canvas.getAllByRole('listitem')).toHaveLength(12)
    await expect(canvas.getByRole('button', { name: queue.drop }).closest('li')).toHaveTextContent(
      '#3 in line'
    )
  },
}

export const Selected: Story = {
  name: 'A card whose task is open in the task panel',
  args: { selectedTaskId: SECOND.task.id },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const selected = canvas.getByRole('button', { name: SECOND.task.title }).closest('li')
      ?.firstElementChild as HTMLElement

    await expect(getComputedStyle(selected).backgroundColor).toBe(
      resolvedColor('--color-accent-100')
    )
  },
}

export const LongTitle: Story = {
  name: 'Long title',
  args: { tasks: QUEUE.longTitle },
  play: async ({ canvasElement }) => {
    const title = within(canvasElement).getByRole('button', { name: LONG_TEXT.title })
    const card = title.closest('li') as HTMLElement

    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const DefaultNarrow: Story = {
  ...Default,
  name: 'Four tasks, one resumes and the others start, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
