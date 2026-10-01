import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { boardResult, emptyBoardProps } from '../../bridge/testing/board_props'
import { FakeApp } from '../../bridge/testing/fake_app'
import { ViewFrame } from '../../components/testing/view_frame'
import { BoardEntry, loadBoard, type LoadedBoard } from './board_entry'

/**
 * The board entry connected to a fake host whose get_board answers with the
 * empty board.
 */
const meta = {
  title: 'Entries/Board',
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
  globals: { viewport: { value: 'inline', isRotated: false } },
  loaders: [
    async () =>
      loadBoard({
        app: new FakeApp({
          hostContext: { displayMode: 'inline', timeZone: 'UTC' },
          answer: () => boardResult(emptyBoardProps()),
        }),
      }),
  ],
  render: (_args, { loaded }) => {
    const { connection, board } = loaded as LoadedBoard
    return (
      <ViewFrame>
        <BoardEntry connection={connection} board={board!} />
      </ViewFrame>
    )
  },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'The empty board from get_board',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(6)
    await expect(canvas.getByText('Nothing waiting on you')).toBeVisible()
  },
}
