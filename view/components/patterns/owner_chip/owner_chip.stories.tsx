// Copied from anachoic inertia/components/patterns/owner_chip/owner_chip.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AGENT_ASKS, HELD_BY_THIS_CHAT } from '../../fixtures/pip_steps'
import { LONG_TEXT } from '../../fixtures/long_text'
import { taskEntry } from '../../helpers/strings'
import { OwnerChip } from './owner_chip'

const INVERSE = { tone: 'inverse' } as const

const WAITING_AGENT_STEP = AGENT_ASKS[1]

const meta = {
  title: 'Patterns/OwnerChip',
  component: OwnerChip,
  args: { owner: 'agent', size: 'sm' },
} satisfies Meta<typeof OwnerChip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Agent, sm, chain preview',
}

export const YouSmall: Story = {
  name: 'You, sm',
  args: { owner: 'you' },
}

export const AgentMedium: Story = {
  name: 'Agent, md, named by its session',
  args: { size: 'md', form: 'named', sessionName: 'api-server' },
}

export const YouMedium: Story = {
  name: 'You, md',
  args: { owner: 'you', size: 'md', form: 'named' },
}

export const ThisChat: Story = {
  name: 'Agent, md, held by This chat',
  args: { size: 'md', form: 'named', sessionName: HELD_BY_THIS_CHAT[0].sessionName },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('This chat')).toBeVisible()
  },
}

export const AgentUnclaimed: Story = {
  name: 'Agent, md, no session holds it',
  args: { size: 'md', form: 'named', sessionName: null },
}

export const LongSessionName: Story = {
  name: 'Agent, md, a session name of 40 characters',
  args: { size: 'md', form: 'named', sessionName: LONG_TEXT.name },
}

export const AgentWaitingOnYou: Story = {
  name: 'Agent step that asked you keeps the agent chip',
  args: {
    owner: WAITING_AGENT_STEP.owner,
    size: 'md',
    form: 'named',
    sessionName: WAITING_AGENT_STEP.sessionName,
  },
  parameters: INVERSE,
  play: async ({ canvasElement }) => {
    await expect(WAITING_AGENT_STEP.status).toBe('waiting')
    await expect(within(canvasElement).queryByText(taskEntry.youChip)).toBeNull()
    await expect(within(canvasElement).getByText('api-server')).toBeVisible()
  },
}

export const AgentSmallInverted: Story = {
  name: 'Agent, sm, inverted',
  parameters: INVERSE,
}

export const YouSmallInverted: Story = {
  name: 'You, sm, inverted',
  args: YouSmall.args,
  parameters: INVERSE,
}

export const AgentMediumInverted: Story = {
  name: 'Agent, md, inverted',
  args: AgentMedium.args,
  parameters: INVERSE,
}

export const YouMediumInverted: Story = {
  name: 'You, md, inverted',
  args: YouMedium.args,
  parameters: INVERSE,
}
