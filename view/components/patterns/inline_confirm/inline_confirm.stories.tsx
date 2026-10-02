// Copied from anachoic inertia/components/patterns/inline_confirm/inline_confirm.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DONE, YOUR_TURN } from '../../fixtures/board_sections'
import { LONG_TEXT } from '../../fixtures/long_text'
import { done, fillTemplate, yourTurn } from '../../helpers/strings'
import { Button } from '../../primitives/button/button'
import { ViewFrame } from '../../testing/view_frame'
import { InlineConfirm, type InlineConfirmProps } from './inline_confirm'

const PARK = {
  question: fillTemplate(yourTurn.parkQuestion, { title: YOUR_TURN.yourStep.task.title }),
  confirmLabel: yourTurn.park,
  dismissLabel: yourTurn.keepStep,
}

const ARCHIVE = {
  question: fillTemplate(done.archiveQuestion, { title: DONE.flaky.task.title }),
  confirmLabel: done.archive,
  dismissLabel: done.keepTask,
}

const NARROW = { frame: 'narrow' } as const

/**
 * The opener and the question in turn, as a card holds them: the opener
 * hides while the question shows and takes focus back after.
 */
function Opener(props: Omit<InlineConfirmProps, 'onConfirm' | 'onCancel' | 'returnFocusTo'>) {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)

  return open ? (
    <InlineConfirm
      {...props}
      onConfirm={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      returnFocusTo={opener}
    />
  ) : (
    <Button ref={opener} variant="ghost" onPress={() => setOpen(true)}>
      {props.confirmLabel}
    </Button>
  )
}

const meta = {
  title: 'Patterns/InlineConfirm',
  component: InlineConfirm,
  args: {
    ...PARK,
    layout: 'row',
    onConfirm: fn(),
    onCancel: fn(),
  },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof InlineConfirm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Park on a Waiting on user card, on one row',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const dismiss = canvas.getByRole('button', { name: yourTurn.keepStep })

    await expect(dismiss).toHaveFocus()
    await userEvent.click(canvas.getByRole('button', { name: yourTurn.park }))
    await expect(args.onConfirm).toHaveBeenCalledOnce()
  },
}

export const ParkStacked: Story = {
  name: 'Park on a Waiting on user card, stacked, 600px wide',
  args: { layout: 'stack' },
  parameters: NARROW,
}

export const Archive: Story = {
  name: 'Archive on a Done card, on one row',
  args: { ...ARCHIVE },
}

export const ArchiveStacked: Story = {
  name: 'Archive on a Done card, stacked, 600px wide',
  args: { ...ARCHIVE, layout: 'stack' },
  parameters: NARROW,
}

export const ArchiveInverted: Story = {
  name: 'Archive on a Done card, inverted',
  args: { ...ARCHIVE },
  parameters: { tone: 'inverse' },
}

export const Busy: Story = {
  name: 'Busy, the action in flight',
  args: { ...ARCHIVE, busy: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const confirm = canvas.getByRole('button', { name: done.archive })

    await expect(confirm).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('button', { name: done.keepTask })).toBeDisabled()
    await userEvent.click(confirm)
    await expect(args.onConfirm).not.toHaveBeenCalled()
  },
}

export const BusyStacked: Story = {
  name: 'Busy, stacked, 600px wide',
  args: { layout: 'stack', busy: true },
  parameters: NARROW,
}

export const LongTitle: Story = {
  name: 'Park a task with a title of 120 characters, 600px wide',
  args: {
    question: fillTemplate(yourTurn.parkQuestion, { title: LONG_TEXT.title }),
  },
  parameters: NARROW,
}

export const OpenAndDismiss: Story = {
  name: 'Opened from its button, and dismissed',
  args: { ...ARCHIVE },
  render: (args) => <Opener {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: done.archive }))
    await expect(canvas.getByRole('button', { name: done.keepTask })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(canvas.getByRole('button', { name: done.archive })).toHaveFocus()
  },
}
