// Copied from anachoic inertia/components/primitives/tag/tag.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LONG_TEXT } from '../../fixtures/long_text'
import { Tag } from './tag'

const meta = {
  title: 'Primitives/Tag',
  component: Tag,
  args: { variant: 'outline', type: 'label', children: 'Running' },
} satisfies Meta<typeof Tag>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Status badge label: outline, label',
}

export const AccentLabel: Story = {
  name: 'Accent, label',
  args: { variant: 'accent', children: 'Your turn' },
}

export const NeutralLabel: Story = {
  name: 'Neutral, label',
  args: { variant: 'neutral', children: 'Done' },
}

export const OutlineCount: Story = {
  name: 'Outline, count',
  args: { type: 'count', children: '3 links' },
}

export const AccentCount: Story = {
  name: 'Accent, count',
  args: { variant: 'accent', type: 'count', children: '3 links' },
}

export const NeutralCount: Story = {
  name: 'Neutral, count',
  args: { variant: 'neutral', type: 'count', children: '3 links' },
}

export const LongSessionName: Story = {
  name: 'Session name of 40 characters',
  args: { children: LONG_TEXT.name },
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
}
