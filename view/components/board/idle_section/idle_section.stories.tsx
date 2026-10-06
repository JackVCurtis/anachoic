// Copied from anachoic inertia/components/board/agents_section/agents_section.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SESSIONS } from '../../fixtures/board_sections'
import { sessions as strings } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { IdleSection } from './idle_section'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

async function expectNoCap(canvasElement: HTMLElement) {
  await expect(canvasElement.textContent).not.toMatch(/Cancel step|Capped|\bcap\b/i)
}

const meta = {
  title: 'Board/IdleSection',
  component: IdleSection,
  args: {
    sessions: SESSIONS.busy,
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
} satisfies Meta<typeof IdleSection>

export default meta

type Story = StoryObj<typeof meta>

export const Busy: Story = {
  name: 'Two sessions holding a step left out, one idle and one ended',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Ended 4m ago')).toBeVisible()
    await expect(canvas.queryByText('Running')).toBeNull()
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
  name: 'Twelve idle sessions, folded after eight',
  args: { sessions: SESSIONS.manyIdle },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 12' }))
    await expect(canvas.getAllByText('Worker')).toHaveLength(12)
  },
}

export const Empty: Story = {
  name: 'Every session holding a step',
  args: { sessions: SESSIONS.severalWorkers },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(strings.nothingIdle)).toBeVisible()
  },
}

export const LongNames: Story = {
  name: 'Long names',
  args: { sessions: SESSIONS.long.map((session) => ({ ...session, holding: null })) },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const BusyNarrow: Story = {
  ...Busy,
  name: 'Two sessions holding a step left out, one idle and one ended, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongNamesNarrow: Story = {
  ...LongNames,
  name: 'Long names, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
