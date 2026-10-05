import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ASSIGNED, DONE, LONG_TITLE, RUNNING, SIGNED_OFF, TWELVE_STEPS } from '../../fixtures/task'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { TaskView, type TaskViewProps } from './task_view'

async function expectNoSidewaysScroll() {
  const [sideways] = await windowOverflow()
  await expect(sideways).toBe(0)
}

const meta = {
  title: 'Task/TaskView',
  component: TaskView,
  args: {
    task: ASSIGNED.task,
    data: ASSIGNED,
    displayMode: 'inline',
    fullscreenAvailable: true,
    onRequestDisplayMode: fn(),
    onOpenLink: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof TaskView>

export default meta

type Story = StoryObj<typeof meta>

export const Inline: Story = {
  name: 'Inline at 735 px',
  play: async ({ canvasElement }) => {
    await expectNoSidewaysScroll()
    await expect(
      within(canvasElement).getByRole('button', { name: 'Open in full screen' })
    ).toBeVisible()
  },
}

export const Fullscreen: Story = {
  name: 'In full screen',
  args: { displayMode: 'fullscreen', data: TWELVE_STEPS, task: TWELVE_STEPS.task },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Back to inline' })
    ).toBeVisible()
  },
}

export const InTheBoard: Story = {
  name: 'In the board, with Back to board',
  args: { onBackToBoard: fn() },
}

export const Loading: Story = {
  name: 'Loading',
  args: { data: null },
}

export const Done: Story = {
  name: 'Done',
  args: { task: DONE.task, data: DONE },
}

export const Archived: Story = {
  name: 'Archived',
  args: { archived: 'T-031 was archived' },
}

export const Narrow: Story = {
  name: 'At 600 px, with a long title',
  args: { task: LONG_TITLE.task, data: LONG_TITLE, onBackToBoard: fn() },
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
  play: expectNoSidewaysScroll,
}

export const NoFullscreen: Story = {
  name: 'With no full screen offered',
  args: { task: RUNNING.task, data: RUNNING, fullscreenAvailable: false },
}

export const BothActions: Story = {
  name: 'With Park and Archive',
  args: { onPark: fn(), onArchive: fn() },
}

export const WithClone: Story = {
  name: 'With Clone task, Park and Archive',
  args: { onClone: fn(), onPark: fn(), onArchive: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Clone task' }))
    await expect(args.onClone).toHaveBeenCalledOnce()
    await expect(canvas.queryByRole('button', { name: 'Keep task' })).toBeNull()
  },
}

export const ParkConfirming: Story = {
  name: 'With Park confirming',
  args: { onPark: fn(), onArchive: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Park' }))
    await expect(canvas.getByRole('button', { name: 'Keep step' })).toHaveFocus()
    await expect(args.onPark).not.toHaveBeenCalled()
  },
}

/** A confirmed action stays in flight, as while its tool call runs. */
function InFlight(args: TaskViewProps) {
  const [pending, setPending] = useState<TaskViewProps['pending']>(null)
  return <TaskView {...args} pending={pending} onArchive={() => setPending('archive')} />
}

export const ArchiveConfirmingBusy: Story = {
  name: 'With Archive confirming and busy',
  args: { onPark: fn(), onArchive: fn() },
  render: (args) => <InFlight {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Archive' }))
    await userEvent.click(canvas.getAllByRole('button', { name: 'Archive' }).at(-1)!)
    await expect(canvas.getAllByRole('button', { name: 'Archive' }).at(-1)).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(canvas.getByRole('button', { name: 'Keep task' })).toBeDisabled()
  },
}

export const ErrorStrip: Story = {
  name: 'With an error strip',
  args: {
    onPark: fn(),
    onArchive: fn(),
    messages: [{ id: 'm1', kind: 'error', text: 'T-031 is not active' }],
    onDismissMessage: fn(),
  },
}

export const NeitherAction: Story = {
  name: 'With neither action',
  args: { task: SIGNED_OFF.task, data: SIGNED_OFF, onPark: fn(), onArchive: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Park' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Archive' })).toBeNull()
  },
}
