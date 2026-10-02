// Copied from anachoic inertia/components/completed/pagination/pagination.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Pagination, type PaginationProps } from './pagination'

/**
 * Pagination as it stands once a button has been pressed: busy, and the page
 * never arrives.
 */
function FetchingPagination({ onPageChange, ...args }: PaginationProps) {
  const [busy, setBusy] = useState(false)

  return (
    <Pagination
      {...args}
      busy={busy}
      onPageChange={(page) => {
        onPageChange(page)
        setBusy(true)
      }}
    />
  )
}

const meta = {
  title: 'Board/Pagination',
  component: Pagination,
  args: {
    page: 2,
    pageCount: 3,
    busy: false,
    onPageChange: fn(),
  },
  parameters: {
    a11y: {
      /*
       * The page label shows --color-text-subtle in text-status, below 4.5:1
       * at its size by design (ui/16, "Built as designed"). The contrast of the
       * text roles belongs to the tokens, so only that rule is off here.
       */
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1040, padding: 'var(--space-4)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

export const Middle: Story = {
  name: 'A page in the middle',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('navigation', { name: 'Pages' })).toBeVisible()
    await expect(canvas.getByRole('status')).toHaveTextContent('Page 2 of 3')
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(args.onPageChange).toHaveBeenLastCalledWith(3)
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }))
    await expect(args.onPageChange).toHaveBeenLastCalledWith(1)
    await expect(args.onPageChange).toHaveBeenCalledTimes(2)
  },
}

export const First: Story = {
  name: 'First page',
  args: { page: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled()
  },
}

export const Last: Story = {
  name: 'Last page',
  args: { page: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled()
  },
}

export const Busy: Story = {
  name: 'Busy after "Next →"',
  render: (args) => <FetchingPagination {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const next = canvas.getByRole('button', { name: 'Next' })

    await userEvent.click(next)
    await expect(next).toHaveAttribute('aria-busy', 'true')
    await expect(next).toHaveFocus()
    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeDisabled()
  },
}

export const OnePage: Story = {
  name: 'One page: not drawn',
  args: { page: 1, pageCount: 1 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('navigation')).toBeNull()
  },
}
