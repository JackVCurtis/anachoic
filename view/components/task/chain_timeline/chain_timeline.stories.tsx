import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DONE, RUNNING, TWELVE_STEPS } from '../../fixtures/task'
import { ViewFrame } from '../../testing/view_frame'
import { ChainTimeline, type ChainTimelineProps } from './chain_timeline'

/** Keeps the open step as the task view does, so the story can be pressed. */
function Kept(args: ChainTimelineProps) {
  const [open, setOpen] = useState(args.openStepId)
  return (
    <ChainTimeline
      {...args}
      openStepId={open}
      onToggleStep={(stepId) => {
        args.onToggleStep(stepId)
        setOpen((current) => (current === stepId ? null : stepId))
      }}
    />
  )
}

const meta = {
  title: 'Task/ChainTimeline',
  component: ChainTimeline,
  args: {
    steps: RUNNING.steps,
    currentStepId: RUNNING.currentStepId,
    openStepId: RUNNING.currentStepId,
    onToggleStep: fn(),
    onOpenLink: fn(),
  },
  render: (args) => <Kept {...args} />,
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story) => (
      <ViewFrame>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof ChainTimeline>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'A chain on its current step',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = canvas.getByRole('button', { name: /Draft the bus adapter/ })
    await userEvent.click(first)
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getAllByRole('button', { expanded: true })).toHaveLength(1)
  },
}

export const TwelveSteps: Story = {
  name: 'A chain of 12 steps',
  args: {
    steps: TWELVE_STEPS.steps,
    currentStepId: TWELVE_STEPS.currentStepId,
    openStepId: TWELVE_STEPS.currentStepId,
  },
}

export const DoneNoneOpen: Story = {
  name: 'A done chain with none open',
  args: { steps: DONE.steps, currentStepId: null, openStepId: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { expanded: true })).toBeNull()
  },
}
