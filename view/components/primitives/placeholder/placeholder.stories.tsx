import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Placeholder',
  render: () => <p>The component library starts here.</p>,
} satisfies Meta

export default meta

export const Default: StoryObj<typeof meta> = {}
