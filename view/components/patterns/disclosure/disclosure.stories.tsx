// Copied from anachoic inertia/components/patterns/disclosure/disclosure.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { ActionCard } from '../../primitives/action_card/action_card'
import { Button } from '../../primitives/button/button'
import { Disclosure, type DisclosureProps } from './disclosure'

const TITLES = [
  'Write the release notes for the billing webhooks',
  'Review the schema change for sessions',
  'Upgrade the queue client',
  LONG_TEXT.title,
]

/**
 * The cards of a long section past the eight it shows, as the Done section
 * folds its recently signed-off tasks.
 */
const FOLDED = Array.from({ length: 6 }, (_, index) => TITLES[index % TITLES.length])

const SHOW_ALL = 'Show all 14'
const SHOW_FEWER = 'Show fewer'

function Cards({ titles }: { titles: readonly string[] }) {
  return (
    <ul
      style={{ display: 'grid', gap: 'var(--space-2)', margin: 0, padding: 0, listStyle: 'none' }}
    >
      {titles.map((title, index) => (
        <ActionCard
          key={index}
          element="li"
          headingLevel={null}
          title={title}
          titleClassName="text-title-1"
          onAction={() => {}}
        >
          <p className="text-hint">Done · 3 steps</p>
        </ActionCard>
      ))}
    </ul>
  )
}

/**
 * A disclosure that keeps its own state, as the component that owns it does,
 * and reports each press to the story's `onToggle`.
 */
function Owned({ open: initiallyOpen, onToggle, ...props }: DisclosureProps) {
  const [open, setOpen] = useState(initiallyOpen)

  return (
    <Disclosure
      {...props}
      open={open}
      toggle={open ? SHOW_FEWER : SHOW_ALL}
      onToggle={() => {
        onToggle()
        setOpen(!open)
      }}
    />
  )
}

const meta = {
  title: 'Patterns/Disclosure',
  component: Disclosure,
  args: {
    open: false,
    onToggle: fn(),
    toggle: SHOW_ALL,
    children: <Cards titles={FOLDED} />,
  },
  render: (args) => <Owned {...args} />,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Disclosure>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Show all 14, closed',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: SHOW_ALL })

    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText(TITLES[0])).toBeNull()
    await userEvent.click(toggle)
    await expect(args.onToggle).toHaveBeenCalledOnce()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle).toHaveTextContent(SHOW_FEWER)
    await expect(canvas.getAllByText(TITLES[0])[0]).toBeVisible()
  },
}

export const Open: Story = {
  name: 'Show all 14, open',
  args: { open: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: SHOW_FEWER })
    const panel = canvas.getByRole('list').parentElement!

    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle).toHaveAttribute('aria-controls', panel.id)
    await expect(canvas.getAllByRole('listitem')).toHaveLength(FOLDED.length)
  },
}

export const InHeading: Story = {
  name: 'Toggle inside a heading, open',
  args: { open: true, headingLevel: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = canvas.getByRole('heading', { level: 3, name: SHOW_FEWER })

    await expect(within(heading).getByRole('button', { name: SHOW_FEWER })).toBeVisible()
    await expect(heading).not.toContainElement(canvas.getByRole('list'))
  },
}

export const ButtonInPanel: Story = {
  name: 'A button inside the open panel',
  args: {
    open: true,
    children: (
      <Button variant="utility" size="sm">
        Archive
      </Button>
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Archive' }))
    await expect(args.onToggle).not.toHaveBeenCalled()
    await expect(canvas.getByRole('button', { name: SHOW_FEWER })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  },
}

export const Utility: Story = {
  name: 'A fold drawn with a utility button, open',
  args: { open: true, toggleVariant: 'utility' },
}

export const Inverted: Story = {
  name: 'A fold on the inverted field, closed',
  parameters: { tone: 'inverse' },
}
