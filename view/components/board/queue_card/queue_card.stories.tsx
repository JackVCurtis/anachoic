// Copied from anachoic inertia/components/board/queue_card/queue_card.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { QUEUE } from '../../fixtures/board_sections'
import { LONG_TEXT } from '../../fixtures/long_text'
import { assistive, queue } from '../../helpers/strings'
import { VisuallyHidden } from '../../primitives/visually_hidden/visually_hidden'
import { resolvedColor } from '../../testing/resolved_color'
import { ViewFrame } from '../../testing/view_frame'
import { QueueCard } from './queue_card'

const INSTRUCTIONS_ID = 'move-instructions'

const [RESUMES, STARTS] = QUEUE.busy

function cardOf(canvasElement: HTMLElement, title: string): HTMLElement {
  return within(canvasElement).getByRole('heading', { level: 3, name: title })
    .parentElement as HTMLElement
}

const meta = {
  title: 'Board/QueueCard',
  component: QueueCard,
  args: {
    task: STARTS,
    movable: true,
    instructionsId: INSTRUCTIONS_ID,
    onOpenTask: fn(),
    onLift: fn(),
    onDrop: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The meta line shows --color-text-meta, which is below 4.5:1 by design
       * (ui/16, "Built as designed"). The contrast of the text roles belongs
       * to the tokens, so only that rule is off here.
       */
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <VisuallyHidden id={INSTRUCTIONS_ID}>{assistive.moveDescription}</VisuallyHidden>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof QueueCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Starts at its first step',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const handle = canvas.getByRole('button', { name: queue.move })

    await expect(canvas.getByText('#2 in line')).toBeVisible()
    await expect(canvas.getByRole('img')).toBeVisible()
    await expect(cardOf(canvasElement, STARTS.task.title)).toHaveTextContent(
      'T-015 · starts at step 1/2 · agent'
    )
    await expect(handle).toHaveAccessibleDescription(
      `${STARTS.task.title} ${assistive.moveDescription}`
    )
    await expect(handle).not.toHaveAttribute('aria-pressed')

    await userEvent.click(handle)
    await expect(args.onLift).toHaveBeenCalledWith(STARTS.task.id)
    await expect(args.onOpenTask).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: STARTS.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(STARTS.task.id)
  },
}

export const Resumes: Story = {
  name: 'Resumes partway through',
  args: { task: RESUMES },
  play: async ({ canvasElement }) => {
    await expect(cardOf(canvasElement, RESUMES.task.title)).toHaveTextContent(
      'T-013 · resumes at step 2/3 · agent'
    )
  },
}

export const NotMovable: Story = {
  name: 'Cannot be moved',
  args: { movable: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: queue.move })).toBeNull()
  },
}

export const Selected: Story = {
  name: 'Selected, its task is open',
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(cardOf(canvasElement, STARTS.task.title)).backgroundColor).toBe(
      resolvedColor('--color-accent-100')
    )
  },
}

export const Lifted: Story = {
  name: 'Lifted',
  args: { lifted: true },
  play: async ({ args, canvasElement }) => {
    const card = cardOf(canvasElement, STARTS.task.title)
    const handle = within(canvasElement).getByRole('button', { name: queue.drop })

    await expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--color-accent-100'))
    await expect(getComputedStyle(card).borderTopColor).toBe(resolvedColor('--color-accent-300'))
    await expect(getComputedStyle(handle).cursor).toBe('grabbing')
    await userEvent.click(handle)
    await expect(args.onDrop).toHaveBeenCalledWith(STARTS.task.id)
  },
}

export const Disabled: Story = {
  name: 'Handle disabled while a change of order is in flight',
  args: { busy: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: queue.move })).toBeDisabled()
  },
}

export const LongTitle: Story = {
  name: 'Long title',
  args: { task: QUEUE.longTitle[0] },
  play: async ({ canvasElement }) => {
    const card = cardOf(canvasElement, LONG_TEXT.title)

    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
  },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}
