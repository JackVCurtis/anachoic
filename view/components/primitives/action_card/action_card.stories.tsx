// Copied from anachoic inertia/components/primitives/action_card/action_card.stories.tsx at fd99e0d
import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { resolvedColor } from '../../testing/resolved_color'
import { ViewFrame, type ViewWidth } from '../../testing/view_frame'
import { Button } from '../button/button'
import { ActionCard } from './action_card'
import sample from './action_card_sample.module.css'

const LONG_TITLE = LONG_TEXT.title

const LIGHT_TITLE = 'Write the release notes for the billing webhooks'
const INVERSE_TITLE = 'Review the migration plan for the billing webhooks'

/**
 * The width of a card in a story that is not drawn in the host frame.
 */
const CARD_WIDTH = [
  (Story: () => ReactNode) => (
    <div style={{ maxWidth: 360 }}>
      <Story />
    </div>
  ),
]

/**
 * A card alone in the host frame, the full width of a section, at 735 px or
 * at the narrow width.
 */
function inViewFrame(width: ViewWidth) {
  return [
    (Story: () => ReactNode) => (
      <ViewFrame width={width}>
        <Story />
      </ViewFrame>
    ),
  ]
}

function cardOf(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByRole('article')
}

const meta = {
  title: 'Primitives/ActionCard',
  component: ActionCard,
  args: {
    'title': LIGHT_TITLE,
    'titleClassName': 'text-title-1',
    'className': sample.card,
    'aria-haspopup': 'dialog',
    'onAction': fn(),
    'children': <p className="text-note">Step 2/3 · Release notes</p>,
  },
} satisfies Meta<typeof ActionCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Light',
  decorators: CARD_WIDTH,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const action = canvas.getByRole('button', { name: args.title })

    await expect(action).toHaveAttribute('aria-haspopup', 'dialog')
    await expect(canvas.getByRole('heading', { level: 3, name: args.title })).toContainElement(
      action
    )
    await userEvent.click(action)
    await expect(args.onAction).toHaveBeenCalledTimes(1)
  },
}

export const Inverse: Story = {
  name: 'Inverse',
  decorators: CARD_WIDTH,
  args: {
    tone: 'inverse',
    title: INVERSE_TITLE,
    children: <p className="text-note">Waiting on user · waiting 4m</p>,
  },
  play: async ({ canvasElement }) => {
    const card = cardOf(canvasElement)

    await expect(card.dataset.tone).toBe('inverse')
    await expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--inverse-bg'))
  },
}

export const Selected: Story = {
  name: 'Selected, its task is open',
  decorators: CARD_WIDTH,
  args: { selected: true },
  play: async ({ canvasElement }) => {
    const card = cardOf(canvasElement)

    await expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--color-accent-100'))
    await expect(getComputedStyle(card).borderTopColor).toBe(resolvedColor('--color-divider'))
  },
}

export const Lifted: Story = {
  name: 'Lifted, being moved in its list',
  decorators: CARD_WIDTH,
  args: { lifted: true },
  play: async ({ canvasElement }) => {
    const card = cardOf(canvasElement)

    await expect(getComputedStyle(card).backgroundColor).toBe(resolvedColor('--color-accent-100'))
    await expect(getComputedStyle(card).borderTopColor).toBe(resolvedColor('--color-accent-300'))
  },
}

export const NestedControls: Story = {
  name: 'With a nested link and button',
  decorators: CARD_WIDTH,
  args: {
    children: (
      <>
        <p className="text-note">Step 2/3 · Release notes</p>
        <div className={sample.actions}>
          <a href="#task" className={sample.link}>
            Open task
          </a>
          <Button variant="secondary" size="sm">
            Queue →
          </Button>
        </div>
      </>
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Queue →' }))
    await expect(args.onAction).not.toHaveBeenCalled()
  },
}

export const InverseNestedControls: Story = {
  name: 'Inverse, with a nested link and button',
  decorators: CARD_WIDTH,
  args: {
    ...NestedControls.args,
    tone: 'inverse',
    title: INVERSE_TITLE,
    children: (
      <>
        <p className="text-note">Waiting on user · waiting 4m</p>
        <div className={sample.actions}>
          <a href="#task" className={sample.link}>
            Open task
          </a>
          <Button variant="inverse-solid">Mark done</Button>
        </div>
      </>
    ),
  },
}

export const LongTitle: Story = {
  name: 'A title of 120 characters',
  decorators: CARD_WIDTH,
  args: { title: LONG_TITLE },
  play: async ({ canvasElement }) => {
    const action = within(canvasElement).getByRole('button', { name: LONG_TITLE })

    await expect(action.textContent).toHaveLength(120)
    await expect(action.getBoundingClientRect().width).toBeLessThanOrEqual(360)
  },
}

export const NoHeading: Story = {
  name: 'Title without a heading, rendered as a list item',
  args: { headingLevel: null, element: 'li' },
  decorators: [
    (Story) => (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        <Story />
      </ul>
    ),
    ...CARD_WIDTH,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByRole('heading')).toBeNull()
    await expect(canvas.getByRole('listitem')).toContainElement(canvas.getByRole('button'))
  },
}

export const HostFrame: Story = {
  name: 'Light, in the host frame at 735 px',
  decorators: inViewFrame('inline'),
}

export const HostFrameInverse: Story = {
  name: 'Inverse, in the host frame at 735 px',
  decorators: inViewFrame('inline'),
  args: InverseNestedControls.args,
}

export const Narrow: Story = {
  name: 'Light, at the narrow width',
  decorators: inViewFrame('narrow'),
  args: { title: LONG_TITLE },
}

export const NarrowInverse: Story = {
  name: 'Inverse, at the narrow width',
  decorators: inViewFrame('narrow'),
  args: { ...InverseNestedControls.args, title: LONG_TITLE },
}
