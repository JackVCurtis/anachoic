// Copied from anachoic inertia/components/patterns/flash_message/flash_message.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { MESSAGES } from '../../fixtures/messages'
import { assistive, boardHeader } from '../../helpers/strings'
import { ViewFrame } from '../../testing/view_frame'
import { FlashMessage, type FlashMessageData } from './flash_message'
import { FlashMessages } from './flash_messages'

/**
 * A message region as the board holds it, with a heading that takes focus
 * when a strip is dismissed from the keyboard.
 */
function Region({ initial }: { initial: readonly FlashMessageData[] }) {
  const [messages, setMessages] = useState(initial)
  const title = useRef<HTMLHeadingElement>(null)

  return (
    <>
      <section aria-label={assistive.landmarkMessages}>
        <FlashMessages
          messages={messages}
          focusTarget={title}
          onDismiss={(id) => setMessages((shown) => shown.filter((message) => message.id !== id))}
        />
      </section>
      <h2 ref={title} tabIndex={-1} className="text-title-4" style={{ padding: 'var(--space-6)' }}>
        {boardHeader.title}
      </h2>
    </>
  )
}

const meta = {
  title: 'Patterns/FlashMessage',
  component: FlashMessage,
  args: {
    ...MESSAGES.success,
    onDismiss: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story) => (
      <ViewFrame>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof FlashMessage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Success',
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status')

    await expect(status).toHaveTextContent(`Done ${MESSAGES.success.text}`)
  },
}

export const Refusal: Story = {
  name: 'Error, a refusal',
  args: { ...MESSAGES.error },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('alert')).toHaveTextContent(`Error ${MESSAGES.error.text}`)
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await expect(args.onDismiss).toHaveBeenCalledWith(MESSAGES.error.id)
  },
}

export const Busy: Story = {
  name: 'Error, the board is busy',
  args: { ...MESSAGES.busy },
}

export const BothAtOnce: Story = {
  name: 'An error and a success at once, the error above',
  render: () => <Region initial={[MESSAGES.success, MESSAGES.error]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const alert = canvas.getByRole('alert')
    const status = canvas.getByRole('status')

    await expect(alert.compareDocumentPosition(status)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  },
}

export const LongSuccess: Story = {
  name: 'Success, a message of 200 characters',
  args: { ...MESSAGES.long, kind: 'success' },
}

export const LongError: Story = {
  name: 'Error, a message of 200 characters',
  args: { ...MESSAGES.long },
}
