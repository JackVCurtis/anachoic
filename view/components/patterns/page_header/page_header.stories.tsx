// Copied from anachoic inertia/components/patterns/page_header/page_header.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { PageHeader } from './page_header'

const meta = {
  title: 'Patterns/PageHeader',
  component: PageHeader,
  args: {
    title: 'Write the release notes for the billing webhooks',
    summary: 'Step 2/3 · This chat',
  },
} satisfies Meta<typeof PageHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Task view, a task with a running step',
  play: async ({ canvasElement }) => {
    const title = within(canvasElement).getByRole('heading', {
      level: 1,
      name: 'Write the release notes for the billing webhooks',
    })
    await expect(title.tabIndex).toBe(-1)
  },
}

export const Done: Story = {
  name: 'Task view, a task to sign off',
  args: { summary: 'Done · 3 links' },
}

export const LongTitle: Story = {
  name: 'Task view, a title of 120 characters and a long summary',
  args: { title: LONG_TEXT.title, summary: `Step 2/3 · ${LONG_TEXT.name}` },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
}
