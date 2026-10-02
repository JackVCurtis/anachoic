import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { OUTPUTS, WORKING } from '../../fixtures/board_sections'
import { artifactLinkLabel } from '../../helpers/output_format'
import { assistive } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { WorkingCard } from './working_card'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

async function expectNoSidewaysScroll() {
  const [sideways] = await windowOverflow()
  await expect(sideways).toBe(0)
}

const meta = {
  title: 'Board/WorkingCard',
  component: WorkingCard,
  args: {
    item: WORKING.one,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The elapsed time, the task id and the dimmed note are below 4.5:1 by
       * design (ui/16, "Built as designed"). The contrast of the text roles
       * belongs to the tokens, so only that rule is off here.
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
} satisfies Meta<typeof WorkingCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'A worker running a step',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12m 00s elapsed')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: WORKING.one.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(WORKING.one.task.id)
  },
}

export const ThisChat: Story = {
  name: 'This chat running a step',
  args: { item: WORKING.thisChat },
}

export const NoNote: Story = {
  name: 'No note',
  args: { item: WORKING.noNote },
}

export const LongNote: Story = {
  name: 'A note of 500 characters',
  args: { item: WORKING.longNote },
  play: expectNoSidewaysScroll,
}

export const LongTitle: Story = {
  name: 'Long title and session name',
  args: { item: WORKING.longTitle },
  play: expectNoSidewaysScroll,
}

export const LongNoteNarrow: Story = {
  ...LongNote,
  name: 'A note of 500 characters, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title and session name, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const Assigned: Story = {
  name: 'Assigned to the worker running it',
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('article')).toHaveTextContent(
      'T-014 · Assigned to api-server'
    )
  },
}

export const AssignedNarrow: Story = {
  ...Assigned,
  name: 'Assigned to the worker running it, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const WithArtifacts: Story = {
  name: 'With artifact links, producing a document',
  args: { item: OUTPUTS.working, onOpenLink: fn() },
  play: async ({ args, canvasElement }) => {
    await expect(within(canvasElement).getByText('Produces a document')).toBeVisible()
    const [first] = OUTPUTS.working.artifacts
    const link = within(canvasElement).getByRole('link', {
      name: `${artifactLinkLabel(first.format, first.stepNumber)} ${assistive.opensInBrowser}`,
    })
    await expect(link).toHaveAttribute('title', first.url)
    await userEvent.click(link)
    await expect(args.onOpenLink).toHaveBeenCalledWith(first.url)
    await expect(args.onOpenTask).not.toHaveBeenCalled()
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const WithArtifactsNarrow: Story = {
  ...WithArtifacts,
  name: 'With artifact links, producing a document, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}
