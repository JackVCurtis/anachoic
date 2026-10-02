// Copied from anachoic inertia/components/sign_off/sign_off_view/sign_off_view.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DONE } from '../../fixtures/board_sections'
import { done } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { DoneSection } from './done_section'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

const meta = {
  title: 'Board/DoneSection',
  component: DoneSection,
  args: {
    toSignOff: DONE.two,
    signedOff: DONE.signedOff,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof DoneSection>

export default meta

type Story = StoryObj<typeof meta>

export const TwoToSignOff: Story = {
  name: 'Two tasks to sign off',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('article')).toHaveLength(2)
    const toggle = canvas.getByRole('button', { name: '10 tasks signed off' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  },
}

export const SignedOffOnly: Story = {
  name: 'None to sign off, ten signed off',
  args: { toSignOff: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(done.nothingToSignOff)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '10 tasks signed off' }))
    await expect(canvas.getAllByRole('listitem')).toHaveLength(10)
  },
}

export const WithHistory: Story = {
  name: 'With the link to the history',
  args: { toSignOff: [], onShowHistory: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: done.showHistory }))
    await expect(args.onShowHistory).toHaveBeenCalledOnce()
  },
}

export const Empty: Story = {
  name: 'Nothing at all',
  args: { toSignOff: [], signedOff: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(done.nothingToSignOff)).toBeVisible()
  },
}

export const Many: Story = {
  name: 'Twelve to sign off, folded after eight',
  args: { toSignOff: DONE.twelve, signedOff: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('article')).toHaveLength(8)
    await userEvent.click(canvas.getByRole('button', { name: 'Show all 12' }))
    await expect(canvas.getAllByRole('article')).toHaveLength(12)
  },
}

export const NoLinks: Story = {
  name: 'A task with no links',
  args: { toSignOff: [DONE.noLinks], signedOff: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('0 links')
  },
}

export const LongTitle: Story = {
  name: 'Long title',
  args: { toSignOff: [DONE.longTitle, DONE.flaky] },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const TwoToSignOffNarrow: Story = {
  ...TwoToSignOff,
  name: 'Two tasks to sign off, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const SignedOffOnlyNarrow: Story = {
  ...SignedOffOnly,
  name: 'None to sign off, ten signed off, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const WithHistoryNarrow: Story = {
  ...WithHistory,
  name: 'With the link to the history, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
