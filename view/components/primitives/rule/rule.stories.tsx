// Copied from anachoic inertia/components/primitives/rule/rule.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Rule } from './rule'

const meta = {
  title: 'Primitives/Rule',
  component: Rule,
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', maxWidth: 480 }}>
        <h2 className="text-name">Waiting on user</h2>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Rule>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Plain',
}

export const Accent: Story = {
  name: 'Accent',
  args: { accent: true },
}

export const Inverted: Story = {
  name: 'Plain, inverted',
  parameters: { tone: 'inverse' },
}
