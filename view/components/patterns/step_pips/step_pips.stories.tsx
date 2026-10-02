// Copied from anachoic inertia/components/patterns/step_pips/step_pips.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import {
  AGENT_ASKS,
  EACH_APPEARANCE,
  HELD_BY_THIS_CHAT,
  ONE_STEP,
  QUEUED_CHAIN,
  TWELVE_STEPS,
  YOUR_STEP_WAITING,
} from '../../fixtures/pip_steps'
import { resolvedColor } from '../../testing/resolved_color'
import { StepPips } from './step_pips'

const INVERSE = { tone: 'inverse' } as const

function bars(canvasElement: HTMLElement): HTMLElement[] {
  return [...within(canvasElement).getByRole('img').children] as HTMLElement[]
}

/**
 * Each bar's fill and border resolve to the tone tokens of its look.
 */
async function expectToneColors(canvasElement: HTMLElement) {
  for (const bar of bars(canvasElement)) {
    const appearance = bar.dataset.appearance
    const style = getComputedStyle(bar)
    const fill =
      appearance === 'pending' ? 'rgba(0, 0, 0, 0)' : resolvedColor(`--tone-pip-${appearance}`, bar)
    const border = resolvedColor(
      appearance === 'pending' ? '--tone-pip-border-pending' : '--tone-pip-border',
      bar
    )
    await expect(style.backgroundColor).toBe(fill)
    await expect(style.borderTopColor).toBe(border)
    await expect(style.height).toBe('5px')
    await expect(style.borderTopWidth).toBe('1px')
  }
}

const meta = {
  title: 'Patterns/StepPips',
  component: StepPips,
  args: {
    steps: HELD_BY_THIS_CHAT,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 310 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StepPips>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'A step running in This chat',
  play: async ({ canvasElement }) => {
    await expect(bars(canvasElement)[0].title).toBe('This chat · Write the release notes')
  },
}

export const DefaultInverted: Story = {
  name: 'A step running in This chat, inverted',
  parameters: INVERSE,
}

export const EachAppearance: Story = {
  name: 'Each appearance: done, running, waiting, pending',
  args: { steps: EACH_APPEARANCE },
  play: async ({ canvasElement }) => {
    await expectToneColors(canvasElement)
    await expect(bars(canvasElement).map((bar) => bar.dataset.appearance)).toEqual([
      'done',
      'running',
      'waiting',
      'pending',
    ])
  },
}

export const EachAppearanceInverted: Story = {
  name: 'Each appearance, inverted',
  args: { steps: EACH_APPEARANCE },
  parameters: INVERSE,
  play: async ({ canvasElement }) => {
    await expectToneColors(canvasElement)
  },
}

export const Queued: Story = {
  name: 'Queued, partway through its chain',
  args: { steps: QUEUED_CHAIN },
  play: async ({ canvasElement }) => {
    const looks = bars(canvasElement).map((bar) => bar.dataset.appearance)
    await expect(looks).not.toContain('running')
    await expect(looks).not.toContain('waiting')
  },
}

export const QueuedInverted: Story = {
  name: 'Queued, inverted',
  args: { steps: QUEUED_CHAIN },
  parameters: INVERSE,
}

export const AgentAsks: Story = {
  name: 'An agent step that asked you a question',
  args: { steps: AGENT_ASKS },
  play: async ({ canvasElement }) => {
    const waiting = bars(canvasElement).find((bar) => bar.dataset.appearance === 'waiting')
    await expect(waiting).toBeDefined()
    await expect(waiting!.title).toBe('api-server · Add a cache in front of the query')
    await expect(getComputedStyle(waiting!).backgroundColor).toBe(
      resolvedColor('--color-accent-900', waiting)
    )
  },
}

export const AgentAsksInverted: Story = {
  name: 'An agent step that asked you a question, inverted',
  args: { steps: AGENT_ASKS },
  parameters: INVERSE,
}

export const YourStepWaiting: Story = {
  name: 'Waiting on your step',
  args: { steps: YOUR_STEP_WAITING },
}

export const YourStepWaitingInverted: Story = {
  name: 'Waiting on your step, inverted',
  args: { steps: YOUR_STEP_WAITING },
  parameters: INVERSE,
}

export const Loose: Story = {
  name: 'Loose spacing, sign-off card',
  args: {
    steps: QUEUED_CHAIN.map((step) => ({ ...step, status: 'done' as const })),
    spacing: 'loose',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(within(canvasElement).getByRole('img')).columnGap).toBe('4px')
  },
}

export const LooseInverted: Story = {
  name: 'Loose spacing, inverted',
  args: Loose.args,
  parameters: INVERSE,
}

export const OneStep: Story = {
  name: 'One step',
  args: { steps: ONE_STEP },
}

export const OneStepInverted: Story = {
  name: 'One step, inverted',
  args: { steps: ONE_STEP },
  parameters: INVERSE,
}

export const TwelveSteps: Story = {
  name: 'Twelve steps',
  args: { steps: TWELVE_STEPS },
  play: async ({ canvasElement }) => {
    const widths = bars(canvasElement).map((bar) => bar.getBoundingClientRect().width)
    await expect(widths).toHaveLength(12)
    for (const width of widths) {
      await expect(width).toBeCloseTo(widths[0], 1)
    }
  },
}

export const TwelveStepsInverted: Story = {
  name: 'Twelve steps, inverted',
  args: { steps: TWELVE_STEPS },
  parameters: INVERSE,
}
