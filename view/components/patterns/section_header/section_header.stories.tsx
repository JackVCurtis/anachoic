// Copied from anachoic inertia/components/patterns/section_header/section_header.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import {
  SectionHeader,
  type LabelLevelProps,
  type SectionHeaderProps,
  type SectionLevelProps,
} from './section_header'

/**
 * A stand-in for a trailing control, which has a component of its own.
 */
function SmallButton({ children }: { children: string }) {
  return (
    <button type="button" className="text-body-sm" style={{ padding: '3px 10px' }}>
      {children}
    </button>
  )
}

/**
 * Storybook cannot narrow a union of props, so the stories take the options of
 * both levels side by side and hand them to the component as the union.
 */
type SectionHeaderArgs = Omit<SectionLevelProps, 'level'> &
  Omit<LabelLevelProps, 'level' | 'title'> & { level?: 'section' | 'label' }

function renderHeader(args: SectionHeaderArgs) {
  return <SectionHeader {...(args as SectionHeaderProps)} />
}

const meta = {
  title: 'Patterns/SectionHeader',
  component: SectionHeader,
  render: renderHeader,
  args: {
    title: 'Queue',
    headingLevel: 2,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<SectionHeaderArgs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Queue, with a count',
  args: { title: 'Queue', summary: 3 },
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole('heading', { level: 2, name: 'Queue' })
    await expect(heading.tabIndex).toBe(-1)
  },
}

export const YourTurn: Story = {
  name: 'Waiting on user, roomy, with a count, inverted',
  args: { title: 'Waiting on user', spacing: 'roomy', summary: 2 },
  parameters: { tone: 'inverse' },
}

export const YourTurnClear: Story = {
  name: 'Waiting on user, roomy, with nothing waiting, inverted',
  args: { title: 'Waiting on user', spacing: 'roomy', summary: 0 },
  parameters: { tone: 'inverse' },
}

export const Sessions: Story = {
  name: 'Sessions, with a count',
  args: { title: 'Sessions', summary: 3 },
}

export const Working: Story = {
  name: 'Working, with a count',
  args: { title: 'Working', summary: 2 },
}

export const QueueEmpty: Story = {
  name: 'Queue, empty',
  args: { title: 'Queue', summary: 0 },
}

export const Backlog: Story = {
  name: 'Backlog, with a count of a long section',
  args: { title: 'Backlog', summary: 14 },
}

export const Done: Story = {
  name: 'Done, with a count and a trailing button',
  args: { title: 'Done', summary: 4, trailing: <SmallButton>Show all 14</SmallButton> },
}

export const TaskView: Story = {
  name: 'Task view, small, with a status note',
  args: { title: 'Chain', headingLevel: 3, size: 'sm', note: 'Step 2/3', noteType: 'status' },
}

export const LongTitle: Story = {
  name: 'Long title and summary',
  args: {
    title: LONG_TEXT.title,
    summary: LONG_TEXT.name,
    trailing: <SmallButton>Add task</SmallButton>,
  },
}

export const Label: Story = {
  name: 'Label, with a rule',
  args: { level: 'label', title: 'Steps' },
}

export const LabelAccent: Story = {
  name: 'Label, accent, as the follow-up composer',
  args: { level: 'label', accent: true, title: 'Follow-up' },
}

export const Legend: Story = {
  name: 'Label as the legend of a field group',
  args: { level: 'label', accent: true, element: 'legend', title: 'Add task' },
  render: (args) => (
    <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
      {renderHeader(args)}
      <label className="text-label" htmlFor="task-title">
        Title
      </label>
      <input id="task-title" placeholder="What needs doing?" />
    </fieldset>
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Add task' })
    await expect(within(canvasElement).queryByRole('heading')).toBeNull()
    await expect(group.firstElementChild?.tagName).toBe('LEGEND')
  },
}
