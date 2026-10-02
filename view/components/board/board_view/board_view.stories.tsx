import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { BUSY_BOARD, LONG_TEXT_BOARD, MANY_BOARD } from '../../fixtures/board'
import { EMPTY_BOARD_VIEW, numberedTasks } from '../../fixtures/empty_views'
import { MESSAGES } from '../../fixtures/messages'
import { assistive, done, yourTurn } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { BoardView } from './board_view'

const INLINE = { viewport: { value: 'inline', isRotated: false } }
const NARROW = { viewport: { value: 'narrow', isRotated: false } }

async function expectEmptyBoard(canvasElement: HTMLElement, width: number) {
  const canvas = within(canvasElement)
  const headings = canvas.getAllByRole('heading', { level: 1 })

  await expect(window.innerWidth).toBe(width)
  await expect(headings).toHaveLength(1)
  await expect(headings[0]).toHaveTextContent(assistive.boardTitle)
  await expect(headings[0].getBoundingClientRect().height).toBeLessThanOrEqual(1)
  const [sideways] = await windowOverflow()
  await expect(sideways).toBe(0)
  await expect(canvas.getByText(yourTurn.nothingWaiting)).toBeVisible()
  await expect(canvas.getByText(done.nothingToSignOff)).toBeVisible()
}

const meta = {
  title: 'Board/BoardView',
  component: BoardView,
  args: EMPTY_BOARD_VIEW,
  globals: INLINE,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      /*
       * The counts and the empty states show --color-text-subtle, which is
       * below 4.5:1 by design (ui/16, "Built as designed"). The contrast of
       * the text roles belongs to the tokens, so only that rule is off here.
       */
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof BoardView>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'Empty, inline in desktop chat',
  play: async ({ canvasElement }) => {
    await expectEmptyBoard(canvasElement, 735)
  },
}

export const EmptyNarrow: Story = {
  name: 'Empty, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async ({ canvasElement }) => {
    await expectEmptyBoard(canvasElement, 600)
  },
}

export const SafeArea: Story = {
  name: 'Empty, with safe-area insets larger than the padding',
  args: { safeAreaInsets: { top: 40, right: 32, bottom: 40, left: 32 } },
}

export const Unreachable: Story = {
  name: "Empty, can't reach the board",
  args: { unreachable: true },
}

export const LongSections: Story = {
  name: 'A long backlog folds and a long queue does not',
  args: {
    queue: numberedTasks(14).map((task, index) => ({
      task,
      position: index + 1,
      nextOwner: 'agent' as const,
      steps: [],
      canAct: { reorder: true, backlog: true },
    })),
    backlog: numberedTasks(14).map((task) => ({
      task: { ...task, id: `backlog-${task.id}` },
      steps: [],
      canAct: { queue: true, archive: true },
    })),
    counts: { yourTurn: 0, working: 0, queue: 14, toSignOff: 0 },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Show all 14' })).toBeVisible()
  },
}

async function expectNoSidewaysScroll() {
  const [sideways] = await windowOverflow()
  await expect(sideways).toBe(0)
}

export const Busy: Story = {
  name: 'Every section filled',
  args: BUSY_BOARD,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('This chat asks')).toBeVisible()
    await expect(canvas.getByText('12m 00s elapsed')).toBeVisible()
    await expect(canvas.getByText('Ended 4m ago')).toBeVisible()
    await expectNoSidewaysScroll()
  },
}

export const BusyNarrow: Story = {
  ...Busy,
  name: 'Every section filled, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const Many: Story = {
  name: 'Twenty in the queue and fourteen in the backlog',
  args: MANY_BOARD,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Show all 14' })).toBeVisible()
  },
}

export const LongText: Story = {
  name: 'Long titles and names in every section',
  args: LONG_TEXT_BOARD,
  play: expectNoSidewaysScroll,
}

export const LongTextNarrow: Story = {
  ...LongText,
  name: 'Long titles and names in every section, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const WithError: Story = {
  name: 'With an error strip',
  args: { messages: [MESSAGES.error] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const region = canvas.getByRole('region', { name: assistive.landmarkMessages })
    const strip = within(region).getByRole('alert')
    await expect(strip).toHaveTextContent(MESSAGES.error.text)
    const header = canvas.getByRole('list', { name: 'Counts' })
    await expect(strip.getBoundingClientRect().top).toBeGreaterThan(
      header.getBoundingClientRect().bottom
    )
    await expect(
      canvas.getByText(yourTurn.nothingWaiting).getBoundingClientRect().top
    ).toBeGreaterThan(strip.getBoundingClientRect().bottom)
  },
}

export const WithLongErrorNarrow: Story = {
  name: 'With a long refusal that wraps, narrow',
  args: { messages: [MESSAGES.long] },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement).getByRole('alert')
    await expect(strip.getBoundingClientRect().height).toBeGreaterThan(40)
    await expectNoSidewaysScroll()
  },
}
