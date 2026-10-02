// Copied from anachoic inertia/components/patterns/meta_line/meta_line.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { MetaLine } from './meta_line'

/** A Working card's facts: its step, the session that holds it and the time. */
const WORKING_FACTS = ['Step 2/3', 'This chat', '14m 03s']

/** A Queue card's facts. */
const QUEUE_FACTS = ['3 steps', '1 for the user']

/** A Done card's facts. */
const DONE_FACTS = ['3 steps', 'Finished 08:05', '3 links']

const meta = {
  title: 'Patterns/MetaLine',
  component: MetaLine,
  args: { tone: 'meta', facts: WORKING_FACTS },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MetaLine>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Meta, a Working card',
  play: async ({ canvasElement }) => {
    const step = within(canvasElement).getByText('Step 2/3')
    await expect(step.parentElement?.textContent).toBe('Step 2/3 · This chat · 14m 03s')
    await expect(step.nextElementSibling?.getAttribute('aria-hidden')).toBe('true')
  },
}

export const Queue: Story = {
  name: 'Meta, a Queue card',
  args: { facts: QUEUE_FACTS },
}

export const LongSessionName: Story = {
  name: 'Meta, a session name of 40 characters',
  args: { facts: ['Step 2/3', LONG_TEXT.name, '14m 03s'] },
}

export const Detail: Story = {
  name: 'Detail, a Done card',
  args: { tone: 'detail', facts: DONE_FACTS },
}

export const DetailOneFact: Story = {
  name: 'Detail, one fact',
  args: { tone: 'detail', facts: ['Idle'] },
}

export const DetailLongSessionName: Story = {
  name: 'Detail, a session name of 40 characters',
  args: { tone: 'detail', facts: [LONG_TEXT.name, 'Released'] },
}
