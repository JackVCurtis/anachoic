import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { HISTORY } from '../../fixtures/history'
import { LONG_TEXT } from '../../fixtures/long_text'
import { history } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { HistoryView } from './history_view'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

const meta = {
  title: 'Board/HistoryView',
  component: HistoryView,
  args: {
    history: HISTORY.onePage,
    onPageChange: fn(),
    onFilterChange: fn(),
    onOpenTask: fn(),
    onOpenLink: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof HistoryView>

export default meta

type Story = StoryObj<typeof meta>

async function nothingSideways() {
  const [sideways] = await windowOverflow()
  await expect(sideways).toBe(0)
}

export const OnePage: Story = {
  name: 'One page',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('3 completed tasks')).toBeVisible()
    await expect(canvas.getAllByRole('row')).toHaveLength(4)
    await expect(canvas.queryByRole('navigation')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Fix the flaky login test' }))
    await expect(args.onOpenTask).toHaveBeenCalledWith('12')
    await nothingSideways()
  },
}

export const Empty: Story = {
  name: 'No completed tasks yet',
  args: { history: HISTORY.empty },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(history.emptyYet)).toBeVisible()
  },
}

export const ManyPages: Story = {
  name: 'The middle of three pages',
  args: { history: HISTORY.secondOfThree },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('45 completed tasks')).toBeVisible()
    await expect(canvas.getAllByRole('row')).toHaveLength(21)
    await expect(canvas.getByRole('status')).toHaveTextContent('Page 2 of 3')
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(args.onPageChange).toHaveBeenLastCalledWith(3)
    await nothingSideways()
  },
}

export const LongText: Story = {
  name: 'Long titles, worker names and links',
  args: { history: HISTORY.longText },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: LONG_TEXT.title })).toBeVisible()
    await nothingSideways()
  },
}

export const NoMatch: Story = {
  name: 'Filtered, with no match',
  args: { history: HISTORY.noMatch, filter: 'webhooks' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: history.filterLabel })).toHaveValue('webhooks')
    await expect(canvas.getByText(history.emptyMatch)).toBeVisible()
  },
}

export const Loading: Story = {
  name: 'Before the first page arrives',
  args: { history: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading history…')).toBeVisible()
  },
}

export const InsideTheBoard: Story = {
  name: 'Inside the board, with a way back',
  args: { onBackToBoard: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: history.backToBoard }))
    await expect(args.onBackToBoard).toHaveBeenCalledOnce()
  },
}

export const OnePageNarrow: Story = {
  ...OnePage,
  name: 'One page, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const EmptyNarrow: Story = {
  ...Empty,
  name: 'No completed tasks yet, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const ManyPagesNarrow: Story = {
  ...ManyPages,
  name: 'The middle of three pages, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongTextNarrow: Story = {
  ...LongText,
  name: 'Long titles, worker names and links, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const NoMatchNarrow: Story = {
  ...NoMatch,
  name: 'Filtered, with no match, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const InsideTheBoardNarrow: Story = {
  ...InsideTheBoard,
  name: 'Inside the board, with a way back, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}
