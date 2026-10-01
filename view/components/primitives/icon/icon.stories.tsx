// Copied from anachoic inertia/components/primitives/icon/icon.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Icon, ICON_NAMES, ICON_SIZES } from './icon'

function EveryIcon() {
  return (
    <table className="text-body-sm">
      <caption className="text-name">Every icon at every size</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          {ICON_SIZES.map((size) => (
            <th key={size} scope="col">
              {size}px
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ICON_NAMES.map((name) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            {ICON_SIZES.map((size) => (
              <td key={size} style={{ padding: 'var(--space-2) var(--space-3)' }}>
                <Icon name={name} size={size} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const meta = {
  title: 'Primitives/Icon',
  component: Icon,
  args: { name: 'plus', size: 14 },
  render: (args) => (
    <span
      className="text-control"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
    >
      <Icon {...args} />
      Add task
    </span>
  ),
} satisfies Meta<typeof Icon>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Plus, 14px, before its label',
}

export const Terminal: Story = {
  name: 'Terminal, 14px',
  args: { name: 'terminal', size: 14 },
}

export const TerminalSmall: Story = {
  name: 'Terminal, 13px',
  args: { name: 'terminal', size: 13 },
}

export const Workflow: Story = {
  name: 'Workflow, 15px',
  args: { name: 'workflow', size: 15 },
}

export const Lock: Story = {
  name: 'Lock, 12px',
  args: { name: 'lock', size: 12 },
}

export const ChevronDown: Story = {
  name: 'Chevron down, 14px',
  args: { name: 'chevron-down', size: 14 },
}

export const EveryNameAndSize: Story = {
  name: 'Every name at every size',
  render: () => <EveryIcon />,
}

export const EveryNameAndSizeInverted: Story = {
  name: 'Every name at every size, inverted',
  parameters: { tone: 'inverse' },
  render: () => <EveryIcon />,
}
