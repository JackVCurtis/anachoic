import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ASKING, BLOCKED, EVERY_APPEARANCE, REVIEW, RUNNING, TEN_LINKS } from '../../fixtures/task'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { TimelineStep } from './timeline_step'

const meta = {
  title: 'Task/TimelineStep',
  component: TimelineStep,
  args: {
    step: RUNNING.steps[2],
    isCurrent: true,
    open: true,
    onToggle: fn(),
    onOpenLink: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The step number, the status label and the event times are dimmed
       * below 4.5:1 by design (ui/16, "Built as designed"). The contrast of
       * the text roles belongs to the tokens, so only that rule is off here.
       */
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
  decorators: [
    (Story) => (
      <ViewFrame>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          <Story />
        </ol>
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof TimelineStep>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'An agent step running, open',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Running · 6m 12s')).toBeVisible()
    await userEvent.click(canvas.getByRole('button'))
    await expect(args.onToggle).toHaveBeenCalledTimes(1)
  },
}

export const Closed: Story = {
  name: 'Closed',
  args: { open: false },
}

export const EveryAppearance: Story = {
  name: 'Every appearance on one chain',
  render: (args) => (
    <>
      {EVERY_APPEARANCE.map(({ step, isCurrent }) => (
        <TimelineStep key={step.id} {...args} step={step} isCurrent={isCurrent} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const items = canvasElement.querySelectorAll('[data-appearance]')
    await expect([...items].map((item) => item.getAttribute('data-appearance'))).toEqual([
      'done',
      'current-agent-running',
      'current-agent-pending',
      'current-waiting',
      'current-waiting',
      'current-you-pending',
      'pending',
    ])
  },
}

export const LongQuestion: Story = {
  name: 'An agent step waiting on a question of 2,000 characters, with its answer',
  args: { step: ASKING.steps[0] },
  play: async ({ canvasElement }) => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
    await expect(within(canvasElement).getByText(ASKING.steps[0].question!)).toBeVisible()
  },
}

export const Blocked: Story = {
  name: 'An agent step its worker blocked',
  args: { step: BLOCKED.steps[1] },
}

export const UserStepWithInput: Story = {
  name: 'A user step waiting, with its input',
  args: { step: REVIEW.steps[1] },
}

export const TenLinks: Story = {
  name: 'A step with ten links',
  args: { step: TEN_LINKS.steps[0], isCurrent: false },
  play: async ({ args, canvasElement }) => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
    const link = within(canvasElement).getByRole('link', { name: /Dashboard 3 / })
    await userEvent.click(link)
    await expect(args.onOpenLink).toHaveBeenCalledWith(TEN_LINKS.steps[0].links![2].url)
  },
}

export const Narrow: Story = {
  name: 'At the narrow width',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  args: { step: TEN_LINKS.steps[0], isCurrent: false },
}
