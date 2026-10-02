import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DONE, OUTPUTS } from '../../fixtures/board_sections'
import { FOLLOW_UP_DRAFTS } from '../../fixtures/follow_up'
import type { FollowUpDraft } from '../../helpers/follow_up'
import { artifactLinkLabel } from '../../helpers/output_format'
import { assistive, done } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import { FollowUpComposer } from '../follow_up_composer/follow_up_composer'
import { SignOffCard } from './sign_off_card'

const ACTIONS = { onSignOff: fn(), onStartFollowUp: fn(), onArchive: fn() }

/** The composer as DoneSection draws it on a card, with a fixed draft. */
function composer(draft: FollowUpDraft, busy = false) {
  return (
    <FollowUpComposer
      draft={draft}
      chainLength={DONE.flaky.steps.length}
      busy={busy}
      onDraftChange={() => {}}
      onAppend={() => {}}
      onCancel={() => {}}
    />
  )
}

const meta = {
  title: 'Board/SignOffCard',
  component: SignOffCard,
  args: {
    task: DONE.flaky,
    onOpenTask: fn(),
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  parameters: {
    a11y: {
      /*
       * The task id shows --color-text-subtle and the stats line
       * --color-text-muted, below 4.5:1 by design (ui/16, "Built as
       * designed"). The contrast of the text roles belongs to the tokens, so
       * only that rule is off here.
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
} satisfies Meta<typeof SignOffCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Finished earlier today',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Finished today 08:05')).toBeVisible()
    await expect(canvasElement).toHaveTextContent('agent 42m · you 9m · 2 links')
    await userEvent.click(canvas.getByRole('button', { name: DONE.flaky.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(DONE.flaky.task.id)
  },
}

export const NoLinks: Story = {
  name: 'No links, finished yesterday',
  args: { task: DONE.noLinks },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('agent 5m · you — · 0 links')
  },
}

export const LongTitle: Story = {
  name: 'Long title',
  args: { task: DONE.longTitle },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const LongTitleNarrow: Story = {
  ...LongTitle,
  name: 'Long title, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}

export const AllActions: Story = {
  name: 'Sign off, Follow up and Archive',
  args: ACTIONS,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: done.signOff }))
    await expect(args.onSignOff).toHaveBeenCalledWith(DONE.flaky.task.id)
    await userEvent.click(canvas.getByRole('button', { name: done.followUp }))
    await expect(args.onStartFollowUp).toHaveBeenCalledWith(DONE.flaky.task.id)
    await expect(canvas.getByRole('button', { name: done.archive })).toBeVisible()
  },
}

export const Composing: Story = {
  name: 'Composing a follow-up of three steps',
  args: { ...ACTIONS, composer: composer(FOLLOW_UP_DRAFTS.threeSteps) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = DONE.flaky.steps.length + 1
    await expect(canvas.getByRole('form', { name: done.followUpTitle })).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
    await expect(canvas.getByRole('textbox', { name: `Title of step ${first}` })).toHaveValue(
      FOLLOW_UP_DRAFTS.threeSteps.steps[0].title
    )
    await expect(canvas.getByRole('radio', { name: done.placementLast })).toBeChecked()
    await expect(canvas.getByRole('button', { name: done.appendAndQueue })).toBeEnabled()
    await expect(canvas.queryByRole('button', { name: done.signOff })).toBeNull()
  },
}

export const FrontChosen: Story = {
  name: 'Composing, Front chosen',
  args: { ...ACTIONS, composer: composer(FOLLOW_UP_DRAFTS.front) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: done.placementFirst })).toBeChecked()
    await expect(canvas.getByText(done.followUpReady)).toBeVisible()
  },
}

export const ComposingEmpty: Story = {
  name: 'Composing, a step without a title',
  args: { ...ACTIONS, composer: composer(FOLLOW_UP_DRAFTS.empty) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: done.appendAndQueue })).toBeDisabled()
    await expect(canvas.getByText('A step needs a title')).toBeVisible()
  },
}

export const ArchiveConfirming: Story = {
  name: 'Archive, confirming',
  args: ACTIONS,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: done.archive }))
    const group = canvas.getByRole('group')
    await expect(group).toHaveTextContent(
      `Archive “${DONE.flaky.task.title}”? It leaves every list.`
    )
    await expect(within(group).getByRole('button', { name: done.keepTask })).toHaveFocus()
    await expect(args.onArchive).not.toHaveBeenCalled()
  },
}

export const Busy: Story = {
  name: 'Signing off',
  args: { ...ACTIONS, pending: 'signOff' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: done.signOff })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(canvas.getByRole('button', { name: done.followUp })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: done.archive })).toBeDisabled()
  },
}

export const Appending: Story = {
  name: 'Appending a follow-up',
  args: { ...ACTIONS, composer: composer(FOLLOW_UP_DRAFTS.threeSteps, true), pending: 'followUp' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: done.appendAndQueue })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(canvas.getByRole('button', { name: done.cancel })).toBeDisabled()
  },
}

export const ComposingNarrow: Story = {
  ...Composing,
  name: 'Composing, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
  play: async () => {
    const [sideways] = await windowOverflow()
    await expect(sideways).toBe(0)
  },
}

export const WithArtifacts: Story = {
  name: 'With artifact links',
  args: { task: OUTPUTS.finished, onOpenLink: fn() },
  play: async ({ args, canvasElement }) => {
    const [first] = OUTPUTS.finished.artifacts
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
  name: 'With artifact links, narrow',
  globals: { viewport: { value: 'narrow', isRotated: false } },
  parameters: { frame: 'narrow' },
}
