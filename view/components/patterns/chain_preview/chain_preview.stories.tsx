// Copied from anachoic inertia/components/patterns/chain_preview/chain_preview.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import {
  AGENT_ASKS,
  HELD_BY_THIS_CHAT,
  ONE_STEP,
  QUEUED_CHAIN,
  TWELVE_STEPS,
  YOUR_STEP_WAITING,
  type PipStepSample,
} from '../../fixtures/pip_steps'
import type { ChainPreviewRow } from '../../helpers/steps'
import { Frame } from '../../primitives/frame/frame'
import { ChainPreview } from './chain_preview'

const INVERSE = { tone: 'inverse' } as const

/**
 * The rows of a chain, numbered after the steps the task already has.
 * `withSessions: false` drops the session names, as a new task has none.
 */
function rowsOf(
  steps: readonly PipStepSample[],
  { existingCount = 0, withSessions = true } = {}
): ChainPreviewRow[] {
  return steps.map(({ owner, title, sessionName }, index) => ({
    number: existingCount + index + 1,
    owner,
    title,
    sessionName: withSessions ? sessionName : null,
  }))
}

function numbers(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .getAllByRole('listitem')
    .map((item) => item.firstElementChild?.textContent ?? '')
}

const meta = {
  title: 'Patterns/ChainPreview',
  component: ChainPreview,
  args: {
    variant: 'framed',
    steps: rowsOf(QUEUED_CHAIN, { withSessions: false }),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 308 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChainPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Framed, task entry',
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Chain preview' })
    await expect(list.getAttribute('start')).toBe('1')
    await expect(numbers(canvasElement)[0]).toBe('01')
  },
}

export const DefaultInverted: Story = {
  name: 'Framed, task entry, inverted',
  parameters: INVERSE,
}

export const Queued: Story = {
  name: 'Framed, a queued chain with the sessions that did its steps',
  args: { steps: rowsOf(QUEUED_CHAIN) },
}

export const AgentAsks: Story = {
  name: 'Framed, an agent step that asked you a question',
  args: { steps: rowsOf(AGENT_ASKS) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('api-server')).toHaveLength(2)
  },
}

export const YourStepWaiting: Story = {
  name: 'Framed, waiting on your step',
  args: { steps: rowsOf(YOUR_STEP_WAITING) },
}

export const HeldByThisChat: Story = {
  name: 'Framed, a step held by This chat',
  args: { steps: rowsOf(HELD_BY_THIS_CHAT) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('This chat')).toBeVisible()
  },
}

export const HeldByThisChatInverted: Story = {
  name: 'Framed, a step held by This chat, inverted',
  args: HeldByThisChat.args,
  parameters: INVERSE,
}

export const Bare: Story = {
  name: 'Bare, follow-up composer',
  args: { variant: 'bare', steps: rowsOf(YOUR_STEP_WAITING, { withSessions: false }) },
}

export const ContinuingAtFive: Story = {
  name: 'Bare, continuing at 05 after four steps',
  args: {
    variant: 'bare',
    steps: rowsOf(YOUR_STEP_WAITING, { existingCount: 4, withSessions: false }),
  },
  decorators: [
    (Story) => (
      <Frame fill="tint" emphasis="selected">
        <div style={{ padding: 'var(--space-3)' }}>
          <Story />
        </div>
      </Frame>
    ),
  ],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list')
    await expect(list.getAttribute('start')).toBe('5')
    await expect(numbers(canvasElement).slice(0, 2)).toEqual(['05', '06'])
  },
}

export const OneStep: Story = {
  name: 'Framed, one step',
  args: { steps: rowsOf(ONE_STEP) },
}

export const TwelveSteps: Story = {
  name: 'Framed, twelve steps',
  args: { steps: rowsOf(TWELVE_STEPS) },
  play: async ({ canvasElement }) => {
    await expect(numbers(canvasElement).at(-1)).toBe('12')
  },
}

export const TwelveStepsBare: Story = {
  name: 'Bare, twelve steps',
  args: { variant: 'bare', steps: rowsOf(TWELVE_STEPS) },
}

export const TwelveStepsInverted: Story = {
  name: 'Framed, twelve steps, inverted',
  args: TwelveSteps.args,
  parameters: INVERSE,
}

export const LongTitles: Story = {
  name: 'Step titles of 120 characters and a session name of 40',
  args: {
    steps: [
      { number: 1, owner: 'agent', title: LONG_TEXT.title, sessionName: LONG_TEXT.name },
      { number: 2, owner: 'you', title: LONG_TEXT.title },
    ],
  },
}

export const LongTitlesBare: Story = {
  name: 'Bare, step titles of 120 characters',
  args: { ...LongTitles.args, variant: 'bare' },
}
