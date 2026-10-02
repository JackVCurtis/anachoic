// Copied from anachoic inertia/components/board/agents_section/agents_section.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SESSIONS } from '../../fixtures/board_sections'
import { sessions as strings } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { SessionsSection } from './sessions_section'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

async function expectNoCap(canvasElement: HTMLElement) {
  await expect(canvasElement.textContent).not.toMatch(/Cancel step|Capped|\bcap\b/i)
}

const meta = {
  title: 'Board/SessionsSection',
  component: SessionsSection,
  args: {
    sessions: SESSIONS.busy,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The count, the state labels and the released ids show
       * --color-text-subtle, below 4.5:1 by design (ui/16, "Built as
       * designed"). The contrast of the text roles belongs to the tokens, so
       * only that rule is off here.
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
} satisfies Meta<typeof SessionsSection>

export default meta

type Story = StoryObj<typeof meta>

export const Busy: Story = {
  name: 'This chat holding a step, a worker running, one idle and one ended',
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Ended 4m ago')).toBeVisible()
    await expectNoCap(canvasElement)
  },
}

export const SeveralWorkers: Story = {
  name: 'Several workers running and waiting',
  args: { sessions: SESSIONS.severalWorkers },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Running')).toHaveLength(3)
    await expect(canvas.getAllByText('Waiting on you')).toHaveLength(1)
    await expectNoCap(canvasElement)
  },
}

export const IdleSessions: Story = {
  name: 'Idle sessions',
  args: { sessions: SESSIONS.idleSessions },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('Idle')).toHaveLength(3)
  },
}

export const EndedReleasedTwo: Story = {
  name: 'An ended session that released two tasks',
  args: { sessions: [SESSIONS.thisChat, SESSIONS.endedTwo] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('T-026')).toBeVisible()
    await expect(canvas.getByText('T-027')).toBeVisible()
  },
}

export const Many: Story = {
  name: 'Twelve sessions, folded after eight',
  args: { sessions: SESSIONS.many },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 12' }))
    await expect(canvas.getAllByText('Worker')).toHaveLength(12)
  },
}

export const Empty: Story = {
  name: 'No session',
  args: { sessions: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(strings.nothingLive)).toBeVisible()
  },
}

export const LongNames: Story = {
  name: 'Long names',
  args: { sessions: SESSIONS.long },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const BusyNarrow: Story = {
  ...Busy,
  name: 'This chat holding a step, a worker running, one idle and one ended, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const SeveralWorkersNarrow: Story = {
  ...SeveralWorkers,
  name: 'Several workers running and waiting, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongNamesNarrow: Story = {
  ...LongNames,
  name: 'Long names, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
