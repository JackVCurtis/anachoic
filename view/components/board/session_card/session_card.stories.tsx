// Copied from anachoic inertia/components/board/agent_slot_card/agent_slot_card.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SESSIONS } from '../../fixtures/board_sections'
import { fillTemplate, sessions as strings } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { SessionCard } from './session_card'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

const meta = {
  title: 'Board/SessionCard',
  component: SessionCard,
  args: {
    session: SESSIONS.running,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The state label and the released ids show --color-text-subtle, below
       * 4.5:1 by design (ui/16, "Built as designed"). The contrast of the text
       * roles belongs to the tokens, so only that rule is off here.
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
} satisfies Meta<typeof SessionCard>

export default meta

type Story = StoryObj<typeof meta>

export const Running: Story = {
  name: 'Holding a running step',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const holding = SESSIONS.running.holding!
    await expect(canvas.getByText('Running')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: holding.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(holding.task.id)
  },
}

export const Waiting: Story = {
  name: 'Holding a step that waits on you',
  args: { session: SESSIONS.waitingWorker },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Waiting on user')).toBeVisible()
    await expect(canvasElement.querySelector('[data-tone="inverse"]')).toBeNull()
  },
}

export const Blocked: Story = {
  name: 'Holding a step it blocked',
  args: { session: SESSIONS.blocked },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Blocked on T-030 step 2')).toBeVisible()
    await expect(canvas.getByText('Step 2 · Deploy')).toBeVisible()
    await expect(canvasElement.querySelector('[data-tone="inverse"]')).toBeNull()
  },
}

export const BlockedNarrow: Story = {
  ...Blocked,
  name: 'Holding a step it blocked, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const ThisChat: Story = {
  name: 'This chat holding a step',
  args: { session: SESSIONS.thisChat },
}

export const Idle: Story = {
  name: 'Idle',
  args: { session: SESSIONS.idle },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Idle')).toBeVisible()
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
  },
}

export const Ended: Story = {
  name: 'Ended, released two tasks',
  args: { session: SESSIONS.endedTwo },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Ended 4m ago')).toBeVisible()
    await expect(canvas.getByText('T-026')).toBeVisible()
    await expect(canvas.getByText('T-027')).toBeVisible()
  },
}

export const LongName: Story = {
  name: 'Long name and title',
  args: { session: SESSIONS.long[1] },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const LongNameNarrow: Story = {
  ...LongName,
  name: 'Long name and title, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const EndedNarrow: Story = {
  ...Ended,
  name: 'Ended, released two tasks, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const RemoveConfirming: Story = {
  name: 'Remove, a live worker holding a step, confirming',
  args: { session: SESSIONS.running, onRemove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const holding = SESSIONS.running.holding!
    await userEvent.click(canvas.getByRole('button', { name: strings.remove }))
    const question = fillTemplate(strings.removeQuestion, {
      name: SESSIONS.running.name,
      id: holding.task.displayId,
    })
    await expect(canvas.getByText(question)).toBeVisible()
    await expect(canvas.getByRole('button', { name: strings.keepWorker })).toHaveFocus()
    await expect(args.onRemove).not.toHaveBeenCalled()
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const RemoveConfirmingNarrow: Story = {
  ...RemoveConfirming,
  name: 'Remove, a live worker holding a step, confirming, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const RemoveEnded: Story = {
  name: 'Remove, an ended worker',
  args: { session: SESSIONS.endedTwo, onRemove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: strings.remove }))
    await expect(args.onRemove).toHaveBeenCalledWith(SESSIONS.endedTwo.id)
    await expect(canvas.queryByRole('group')).toBeNull()
  },
}

export const RemoveEndedNarrow: Story = {
  ...RemoveEnded,
  name: 'Remove, an ended worker, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const RemoveThisChat: Story = {
  name: 'Remove offered, this chat holding a step',
  args: { session: SESSIONS.thisChat, onRemove: fn() },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: strings.remove })).toBeNull()
  },
}
