// Copied from anachoic inertia/components/board/backlog_card/backlog_card.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BACKLOG, OUTPUTS } from '../../fixtures/board_sections'
import { LONG_TEXT } from '../../fixtures/long_text'
import { artifactLinkLabel } from '../../helpers/output_format'
import { assistive } from '../../helpers/strings'
import { resolvedColor } from '../../testing/resolved_color'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { BacklogCard } from './backlog_card'
import { spoken } from '../../testing/text'

const [RENAME] = BACKLOG.busy

/** T-010, assigned to web-client. */
const DARK_MODE = BACKLOG.busy[4]

function cardOf(canvasElement: HTMLElement, title: string): HTMLElement {
  return within(canvasElement).getByRole('heading', { level: 3, name: title })
    .parentElement as HTMLElement
}

const meta = {
  title: 'Board/BacklogCard',
  component: BacklogCard,
  args: {
    task: RENAME,
    onOpenTask: fn(),
    onQueueTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof BacklogCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Can be queued',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const queue = canvas.getByRole('button', { name: 'Queue' })

    await expect(cardOf(canvasElement, RENAME.task.title)).toHaveTextContent(
      'T-003 · 2 steps · 1 for the user'
    )
    await expect(queue).toHaveTextContent(/^Queue\s*→$/)
    await expect(canvas.queryByRole('img')).toBeNull()

    await userEvent.click(queue)
    await expect(args.onQueueTask).toHaveBeenCalledWith(RENAME.task.id)
    await expect(args.onOpenTask).not.toHaveBeenCalled()
  },
}

export const CannotQueue: Story = {
  name: 'Cannot be queued',
  args: { task: BACKLOG.cannotQueue },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Queue' })).toBeNull()
  },
}

export const Selected: Story = {
  name: 'Selected, its task is open',
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(cardOf(canvasElement, RENAME.task.title)).backgroundColor).toBe(
      resolvedColor('--color-accent-100')
    )
  },
}

export const LongTitle: Story = {
  name: 'Long title',
  args: { task: BACKLOG.longTitle[0] },
  play: async ({ canvasElement }) => {
    const card = cardOf(canvasElement, LONG_TEXT.title)
    const queue = within(canvasElement).getByRole('button', { name: 'Queue' })

    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
    await expect(queue.getBoundingClientRect().right).toBeLessThanOrEqual(
      card.getBoundingClientRect().right
    )
  },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}

export const ArchiveConfirming: Story = {
  name: 'Archive, confirming',
  args: { onArchive: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Archive' }))
    const group = canvas.getByRole('group')
    await expect(within(group).getByRole('button', { name: 'Keep task' })).toHaveFocus()
    await userEvent.click(within(group).getByRole('button', { name: 'Archive' }))
    await expect(args.onArchive).toHaveBeenCalledWith(RENAME.task.id)
    await expect(args.onOpenTask).not.toHaveBeenCalled()
  },
}

export const Archiving: Story = {
  name: 'Archiving',
  args: { onArchive: fn(), pending: 'archive' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Archive' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Queue' })).toBeDisabled()
  },
}

export const Assigned: Story = {
  name: 'Assigned to a worker',
  args: { task: DARK_MODE },
  play: async ({ canvasElement }) => {
    await expect(cardOf(canvasElement, DARK_MODE.task.title)).toHaveTextContent(
      'T-010 · 3 steps · 1 for the user · Assigned to web-client'
    )
  },
}

export const AssignedNarrow: Story = {
  ...Assigned,
  name: 'Assigned to a worker, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}

export const WithArtifacts: Story = {
  name: 'With artifact links',
  args: { task: OUTPUTS.parked, onOpenLink: fn() },
  play: async ({ args, canvasElement }) => {
    const [first] = OUTPUTS.parked.artifacts
    const link = within(canvasElement).getByRole('link', {
      name: `${spoken(artifactLinkLabel(first.format, first.stepNumber))} ${assistive.opensInBrowser}`,
    })
    await expect(link).toHaveAttribute('title', first.url)
    await userEvent.click(link)
    await expect(args.onOpenLink).toHaveBeenCalledWith(first.url)
    await expect(args.onOpenTask).not.toHaveBeenCalled()
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const WithArtifactsNarrow: Story = {
  ...WithArtifacts,
  name: 'With artifact links, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}
