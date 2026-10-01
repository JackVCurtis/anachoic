// Copied from anachoic inertia/components/primitives/visually_hidden/visually_hidden.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VisuallyHidden } from './visually_hidden'

const meta = {
  title: 'Primitives/VisuallyHidden',
  component: VisuallyHidden,
  args: {
    children: ', opens in a new tab',
  },
  render: (args) => (
    <p className="text-body">
      <a href="#task">
        Open task
        <VisuallyHidden {...args} />
      </a>{' '}
      The link reads “opens in a new tab” to a screen reader and shows nothing extra.
    </p>
  ),
} satisfies Meta<typeof VisuallyHidden>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Heading: Story = {
  name: 'A level 1 heading, heard and not seen',
  args: { element: 'h1', children: 'Board' },
  render: (args) => (
    <div>
      <VisuallyHidden {...args} />
      <p className="text-body">The page’s title is read to a screen reader and drawn nowhere.</p>
    </div>
  ),
}
