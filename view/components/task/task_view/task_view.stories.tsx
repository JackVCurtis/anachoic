import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { ASSIGNED, DONE, LONG_TITLE, RUNNING, TWELVE_STEPS } from '../../fixtures/task'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { TaskView } from './task_view'

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
  parameters: {
    a11y: {
      /*
       * The id, the step label, the step numbers, the status labels and the
       * event times are dimmed below 4.5:1 by design (ui/16, "Built as
       * designed"), so only that rule is off here.
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
