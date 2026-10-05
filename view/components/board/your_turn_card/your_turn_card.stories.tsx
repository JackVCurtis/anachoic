import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { OUTPUTS, REJECTABLE, YOUR_TURN } from '../../fixtures/board_sections'
import { assistive, reject, yourTurn } from '../../helpers/strings'
import { ViewFrame, windowOverflow } from '../../testing/view_frame'
import type { YourTurnTask } from '../board_data'
import { YourTurnCard } from './your_turn_card'
import { fullText } from '../../testing/text'

const NARROW = { viewport: { value: 'narrow', isRotated: false } }

async function expectNoSidewaysScroll() {
  const [sideways] = await windowOverflow()
  await expect(sideways).toBe(0)
}

const meta = {
  title: 'Board/YourTurnCard',
  component: YourTurnCard,
  args: {
    item: YOUR_TURN.yourStep,
    onOpenTask: fn(),
    onCompleteStep: fn(),
    onAnswer: fn(),
    onPark: fn(),
    onReject: fn(),
    onOpenLink: fn(),
    busy: null,
  },
  globals: { viewport: { value: 'inline', isRotated: false } },
  decorators: [
    (Story, { parameters }) => (
      <ViewFrame width={parameters.frame}>
        <Story />
      </ViewFrame>
    ),
  ],
} satisfies Meta<typeof YourTurnCard>

export default meta

type Story = StoryObj<typeof meta>

export const YourStep: Story = {
  name: 'User step',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('User step')).toBeVisible()
    await expect(canvas.getByText(fullText('Step 3/4 · 14m'))).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: YOUR_TURN.yourStep.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(YOUR_TURN.yourStep.task.id)
  },
}

export const Question: Story = {
  name: "An agent's question",
  args: { item: YOUR_TURN.question },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('This chat asks')).toBeVisible()
    await expect(canvas.getByText('Redis or in-process?')).toBeVisible()
  },
}

export const LongQuestion: Story = {
  name: 'A question of 2,000 characters',
  args: { item: YOUR_TURN.longQuestion },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const LongTitle: Story = {
  name: 'Long title and session name',
  args: { item: YOUR_TURN.longTitle },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const YourStepNarrow: Story = {
  name: 'User step, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const LongQuestionNarrow: Story = {
  name: 'A question of 2,000 characters, narrow',
  args: { item: YOUR_TURN.longQuestion },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const LongTitleNarrow: Story = {
  name: 'Long title and session name, narrow',
  args: { item: YOUR_TURN.longTitle },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async () => {
    await expectNoSidewaysScroll()
  },
}

export const YourStepWithNote: Story = {
  name: 'User step, with a note typed',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole('textbox', { name: yourTurn.noteLabel }),
      'Merged after one nit'
    )
    await userEvent.click(canvas.getByRole('button', { name: yourTurn.markDone }))
    await expect(args.onCompleteStep).toHaveBeenCalledWith(
      YOUR_TURN.yourStep.task.id,
      'Merged after one nit'
    )
    await expect(args.onOpenTask).not.toHaveBeenCalled()
  },
}

export const QuestionAnswered: Story = {
  name: "An agent's question, with an answer typed",
  args: { item: YOUR_TURN.question },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: yourTurn.answerLabel }), 'Redis')
    await userEvent.click(canvas.getByRole('button', { name: yourTurn.answer }))
    await expect(args.onAnswer).toHaveBeenCalledWith(YOUR_TURN.question.task.id, 'Redis')
  },
}

export const ParkConfirming: Story = {
  name: 'Park, confirming',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: yourTurn.park }))
    await expect(canvas.getByRole('button', { name: yourTurn.keepStep })).toHaveFocus()
    await expect(args.onPark).not.toHaveBeenCalled()
  },
}

export const ParkConfirmingNarrow: Story = {
  ...ParkConfirming,
  name: 'Park, confirming, narrow',
  args: { item: YOUR_TURN.longTitle },
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const YourStepBusy: Story = {
  name: 'User step, marking done',
  args: { busy: 'complete' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: yourTurn.markDone })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(canvas.getByRole('button', { name: yourTurn.park })).toBeDisabled()
  },
}

export const QuestionBusy: Story = {
  name: "An agent's question, answering",
  args: { item: YOUR_TURN.question, busy: 'answer' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: yourTurn.answer })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(canvas.getByRole('textbox', { name: yourTurn.answerLabel })).toBeEnabled()
  },
}

export const ParkBusy: Story = {
  name: 'Parking',
  args: { item: YOUR_TURN.question, busy: 'park' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: yourTurn.park })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: yourTurn.answer })).toBeDisabled()
  },
}

export const NoActions: Story = {
  name: 'Nothing it can act on',
  args: { item: { ...YOUR_TURN.yourStep, canAct: { complete: false, park: false } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: yourTurn.park })).toBeNull()
  },
}

const HANDED_PR = OUTPUTS.handedPullRequest

export const HandedPullRequest: Story = {
  name: 'User step handed a pull request',
  args: { item: HANDED_PR },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const link = canvas.getByRole('link', {
      name: `Pull request from step 1 ${assistive.opensInBrowser}`,
    })
    const markDone = canvas.getByRole('button', { name: yourTurn.markDone })
    await expect(link).toBeVisible()
    await expect(link.compareDocumentPosition(markDone)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1)

    await userEvent.click(link)
    await expect(args.onOpenLink).toHaveBeenCalledWith(HANDED_PR.input!.url)
    await expect(args.onOpenTask).not.toHaveBeenCalled()

    await expect(markDone).toBeEnabled()
    await userEvent.click(markDone)
    await expect(args.onCompleteStep).toHaveBeenCalledWith(HANDED_PR.task.id, undefined)
  },
}

export const HandedPullRequestNarrow: Story = {
  ...HandedPullRequest,
  name: 'User step handed a pull request, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const HandedLongDocument: Story = {
  name: 'User step handed a link of 2,000 characters, narrow',
  args: { item: OUTPUTS.handedLongDocument },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Document from step 1')).toBeVisible()
    await expectNoSidewaysScroll()
  },
}

export const HandedWithoutHost: Story = {
  name: 'User step handed a link, with no way to open it',
  args: { item: HANDED_PR, onOpenLink: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('link')).toBeNull()
  },
}

async function expectBlockedCard(canvasElement: HTMLElement, item: YourTurnTask) {
  const canvas = within(canvasElement)
  await expect(canvas.getByText(yourTurn.kindBlocked)).toBeVisible()
  await expect(canvas.getByText(item.blocked!.reason)).toBeVisible()
  await expect(canvas.getAllByRole('button')).toHaveLength(1)
  await expect(canvas.queryByRole('textbox')).toBeNull()
  await expectNoSidewaysScroll()
}

export const Blocked: Story = {
  name: 'Blocked by its worker',
  args: { item: YOUR_TURN.blocked },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expectBlockedCard(canvasElement, YOUR_TURN.blocked)
    await expect(canvas.getByText('api-server')).toBeVisible()
    await expect(canvas.getByText(fullText('Step 2 · Deploy'))).toBeVisible()
    await expect(canvas.getByText('Blocked 20m')).toBeVisible()
    await expect(canvas.getByText('Unblock it in api-server’s session')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: YOUR_TURN.blocked.task.title }))
    await expect(args.onOpenTask).toHaveBeenCalledWith(YOUR_TURN.blocked.task.id)
  },
}

export const BlockedNarrow: Story = {
  name: 'Blocked by its worker, narrow',
  args: { item: YOUR_TURN.blocked },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async ({ canvasElement }) => {
    await expectBlockedCard(canvasElement, YOUR_TURN.blocked)
  },
}

export const BlockedLong: Story = {
  name: 'Blocked, with a reason of 2,000 characters, a long title and worker name',
  args: { item: YOUR_TURN.longBlocked },
  play: async ({ canvasElement }) => {
    await expectBlockedCard(canvasElement, YOUR_TURN.longBlocked)
  },
}

export const BlockedLongNarrow: Story = {
  ...BlockedLong,
  name: 'Blocked, with a reason of 2,000 characters, a long title and worker name, narrow',
  globals: NARROW,
  parameters: { frame: 'narrow' },
}

export const Rejectable: Story = {
  name: 'User step whose agent step can be rejected',
  args: { item: REJECTABLE.yourStep },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const buttons = canvas.getAllByRole('button').map((button) => button.textContent)
    await expect(buttons.slice(-3)).toEqual([yourTurn.markDone, reject.reject, yourTurn.park])
    await userEvent.click(canvas.getByRole('button', { name: reject.reject }))
    await expect(canvas.getByRole('textbox', { name: reject.label })).toHaveFocus()
    await expect(canvas.queryByRole('button', { name: yourTurn.markDone })).toBeNull()
    await userEvent.type(
      canvas.getByRole('textbox', { name: reject.label }),
      'The PR targets the wrong branch'
    )
    await userEvent.click(canvas.getByRole('button', { name: reject.sendBack }))
    await expect(args.onReject).toHaveBeenCalledWith(
      REJECTABLE.yourStep.task.id,
      'The PR targets the wrong branch'
    )
    await expect(args.onOpenTask).not.toHaveBeenCalled()
  },
}

export const RejectingNarrow: Story = {
  name: 'Rejecting, narrow',
  args: { item: REJECTABLE.yourStep },
  globals: NARROW,
  parameters: { frame: 'narrow' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: reject.reject }))
    await expectNoSidewaysScroll()
  },
}

export const RejectBusy: Story = {
  name: 'User step, rejecting',
  args: { item: REJECTABLE.yourStep, busy: 'reject' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: reject.reject })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: yourTurn.markDone })).toBeDisabled()
  },
}
