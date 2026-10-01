// Copied from anachoic inertia/components/primitives/frame/frame.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { resolvedColor } from '../../testing/resolved_color'
import { Frame } from './frame'

function Sample({ text = 'Write the release notes for the billing webhooks' }: { text?: string }) {
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <p className="text-body">{text}</p>
    </div>
  )
}

const meta = {
  title: 'Primitives/Frame',
  component: Frame,
  args: {
    children: <Sample />,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Frame>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Inverse: Story = {
  name: 'Inverse tone, with text',
  args: {
    tone: 'inverse',
    children: <Sample text="Your turn: review the migration plan" />,
  },
  play: async ({ canvasElement }) => {
    const text = within(canvasElement).getByText('Your turn: review the migration plan')
    const frame = text.closest('[data-tone]') as HTMLElement

    expect(frame.dataset.tone).toBe('inverse')
    expect(resolvedColor('--tone-fg', text)).toBe(resolvedColor('--inverse-fg'))
    expect(getComputedStyle(text).color).toBe(resolvedColor('--inverse-fg'))
    expect(getComputedStyle(frame).backgroundColor).toBe(resolvedColor('--inverse-bg'))
  },
}

export const Dashed: Story = {
  name: 'Dashed line',
  args: { line: 'dashed' },
}

export const Muted: Story = {
  name: 'Muted emphasis',
  args: { emphasis: 'muted' },
}

export const Selected: Story = {
  name: 'Selected emphasis',
  args: { emphasis: 'selected' },
}

export const DashedSelected: Story = {
  name: 'Dashed line, selected emphasis',
  args: { line: 'dashed', emphasis: 'selected' },
}

export const Tint: Story = {
  name: 'Tint fill, selected emphasis',
  args: { fill: 'tint', emphasis: 'selected' },
}

export const TintOnly: Story = {
  name: 'Tint fill',
  args: { fill: 'tint' },
}

export const Hatch: Story = {
  name: 'Hatch fill, as an idle session',
  args: {
    line: 'dashed',
    fill: 'hatch',
    children: (
      <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
        <p className="text-note">Idle</p>
      </div>
    ),
  },
}

export const HatchSolid: Story = {
  name: 'Hatch fill, solid line',
  args: { fill: 'hatch' },
}

export const ElementDiv: Story = {
  name: 'Rendered as a div',
  args: { element: 'div' },
}

export const ElementArticle: Story = {
  name: 'Rendered as an article',
  args: { element: 'article' },
}

export const ElementSection: Story = {
  name: 'Rendered as a section',
  args: { 'element': 'section', 'aria-label': 'Step detail' },
}

export const ElementListItem: Story = {
  name: 'Rendered as list items',
  render: (args) => (
    <ul style={{ display: 'grid', gap: 'var(--space-3)', padding: 0, listStyle: 'none' }}>
      <Frame {...args} element="li">
        <Sample text="Write the migration" />
      </Frame>
      <Frame {...args} element="li">
        <Sample text="Review the schema change" />
      </Frame>
    </ul>
  ),
}

export const LightInsideInverted: Story = {
  name: 'Default frame on the inverted field',
  parameters: { tone: 'inverse' },
}
