import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { EVENTS } from '../../fixtures/task'
import { ViewFrame } from '../../testing/view_frame'
import { EventList } from './event_list'

const meta = {
  title: 'Task/EventList',
  component: EventList,
  args: { events: EVENTS },
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story) => (
      <ViewFrame>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof EventList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Events with a day word',
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Yesterday 16:20')).toBeVisible()
  },
}

export const Inverted: Story = {
  name: 'On the inverted field',
  parameters: { tone: 'inverse' },
}
