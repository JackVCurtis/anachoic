// Copied from anachoic inertia/components/foundations/base.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { resolvedColor } from '../testing/resolved_color'

function Links() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)', maxWidth: 480 }}>
      <p className="text-body">
        The agent opened a <a href="#pull-request">pull request</a> and wrote the{' '}
        <a href="#plan">plan</a> to the repo.
      </p>
      <p className="text-body-sm">
        Links take the accent, and the brighter accent under the pointer. They do not appear on the
        inverted field.
      </p>
    </div>
  )
}

function FocusRing() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
      <button type="button">Focused by the keyboard</button>
      <button type="button">Next in order</button>
    </div>
  )
}

const LINES = Array.from({ length: 40 }, (_, index) => `Line ${index + 1} of the step log`)

function ScrollingBox() {
  return (
    <div
      role="region"
      aria-label="Step log"
      tabIndex={0}
      style={{
        height: 160,
        width: 360,
        overflow: 'auto',
        padding: 'var(--space-3)',
        border: 'var(--border-hairline) solid var(--tone-border)',
      }}
    >
      <div style={{ width: 520 }}>
        {LINES.map((line) => (
          <p key={line} className="text-mono-sm">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

const BLINKS = [
  { label: 'Attention, every 1.6s', duration: 'var(--motion-blink-attention)' },
  { label: 'Busy, every 1s', duration: 'var(--motion-blink-busy)' },
]

function Blink() {
  return (
    <ul style={{ display: 'grid', gap: 'var(--space-3)', padding: 0, listStyle: 'none' }}>
      {BLINKS.map((blink) => (
        <li
          key={blink.label}
          style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}
        >
          <span
            aria-hidden="true"
            data-blink=""
            style={{
              display: 'block',
              width: 'var(--size-status-square)',
              height: 'var(--size-status-square)',
              background: 'var(--tone-fg)',
              animation: `blink ${blink.duration} infinite`,
            }}
          />
          <span className="text-body-sm">{blink.label}</span>
        </li>
      ))}
    </ul>
  )
}

const meta = {
  title: 'Foundations/Base',
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const LinksInText: Story = {
  name: 'Links in text',
  render: () => <Links />,
}

export const FocusRingLight: Story = {
  name: 'Focus ring',
  render: () => <FocusRing />,
  play: async ({ canvasElement }) => {
    const [first] = within(canvasElement).getAllByRole('button')
    await userEvent.tab()

    expect(document.activeElement).toBe(first)
    const style = getComputedStyle(first)
    expect(style.outlineStyle).toBe('solid')
    expect(style.outlineWidth).toBe('2px')
    expect(style.outlineColor).toBe(resolvedColor('--tone-focus', first))
  },
}

export const FocusRingInverted: Story = {
  ...FocusRingLight,
  name: 'Focus ring, inverted',
  parameters: { tone: 'inverse' },
}

export const ScrollingBoxLight: Story = {
  name: 'Scrolling box',
  render: () => <ScrollingBox />,
}

export const ScrollingBoxInverted: Story = {
  name: 'Scrolling box, inverted',
  parameters: { tone: 'inverse' },
  render: () => <ScrollingBox />,
}

export const BlinkLight: Story = {
  name: 'Blink',
  render: () => <Blink />,
}

export const BlinkInverted: Story = {
  name: 'Blink, inverted',
  parameters: { tone: 'inverse' },
  render: () => <Blink />,
}
