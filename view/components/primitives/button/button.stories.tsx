// Copied from anachoic inertia/components/primitives/button/button.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LONG_TEXT } from '../../fixtures/long_text'
import { ViewFrame } from '../../testing/view_frame'
import { Frame } from '../frame/frame'
import {
  Button,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  type ButtonSize,
  type ButtonVariant,
} from './button'

/*
 * White text on the accent fill is 3.71:1, below 4.5:1 by design (ui/16,
 * "Built as designed"). Stories that show the primary button turn only that
 * rule off; the fix is one token, not this component.
 */
const ACCENT_FILL_CONTRAST = {
  a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } },
}

const LONG_LABEL = LONG_TEXT.title

function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
      {children}
    </div>
  )
}

function InverseField({ children }: { children: ReactNode }) {
  return (
    <Frame tone="inverse">
      <div style={{ padding: 'var(--space-6)' }}>{children}</div>
    </Frame>
  )
}

function sizedButton(variant: ButtonVariant, size: ButtonSize, disabled = false) {
  // The union of props is narrowed by BUTTON_SIZES, which the compiler cannot follow.
  const look = { variant, size } as { variant: 'primary'; size: ButtonSize }
  return (
    <Button {...look} disabled={disabled}>
      {disabled ? 'Disabled' : `${variant} ${size}`}
    </Button>
  )
}

function EveryLook({ surface }: { surface: 'light' | 'inverse' }) {
  const variants = BUTTON_VARIANTS.filter((variant) =>
    surface === 'light'
      ? !variant.startsWith('inverse')
      : variant.startsWith('inverse') || variant === 'utility'
  )
  const grid = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {variants.map((variant) => (
        <Row key={variant}>
          {BUTTON_SIZES[variant].map((size) => (
            <span key={size}>{sizedButton(variant, size)}</span>
          ))}
          {BUTTON_SIZES[variant].map((size) => (
            <span key={`disabled-${size}`}>{sizedButton(variant, size, true)}</span>
          ))}
        </Row>
      ))}
    </div>
  )
  return surface === 'inverse' ? <InverseField>{grid}</InverseField> : grid
}

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: {
    children: 'Add to queue',
    onPress: fn(),
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Primary, medium',
  parameters: ACCENT_FILL_CONTRAST,
}

export const PrimarySmall: Story = {
  name: 'Primary, small',
  parameters: ACCENT_FILL_CONTRAST,
  args: { size: 'sm', children: 'Add task' },
}

export const Secondary: Story = {
  name: 'Secondary, medium',
  args: { variant: 'secondary', children: 'Follow up' },
}

export const SecondarySmall: Story = {
  name: 'Secondary, small',
  args: { variant: 'secondary', size: 'sm', children: 'Queue →' },
}

export const Ghost: Story = {
  name: 'Ghost, medium',
  args: { variant: 'ghost', children: 'Open task' },
}

export const GhostSmall: Story = {
  name: 'Ghost, small',
  args: { variant: 'ghost', size: 'sm', children: 'Archive' },
}

export const Utility: Story = {
  name: 'Utility, medium',
  args: { variant: 'utility', children: 'Show all 14' },
}

export const UtilitySmall: Story = {
  name: 'Utility, small',
  args: { variant: 'utility', size: 'sm', children: 'Move' },
}

export const InverseSolid: Story = {
  name: 'Inverse solid, inside an inverse Frame',
  args: { variant: 'inverse-solid', children: 'Mark done' },
  decorators: [
    (Story) => (
      <InverseField>
        <Story />
      </InverseField>
    ),
  ],
}

export const InverseOutline: Story = {
  name: 'Inverse outline, inside an inverse Frame',
  args: { variant: 'inverse-outline', children: 'Park' },
  decorators: [
    (Story) => (
      <InverseField>
        <Story />
      </InverseField>
    ),
  ],
}

export const UtilityInverse: Story = {
  name: 'Utility, small, inside an inverse Frame',
  args: { variant: 'utility', size: 'sm', children: 'Copy' },
  decorators: [
    (Story) => (
      <InverseField>
        <Story />
      </InverseField>
    ),
  ],
}

export const UtilityInverseMedium: Story = {
  name: 'Utility, medium, inside an inverse Frame',
  args: { variant: 'utility', children: 'Show fewer' },
  decorators: [
    (Story) => (
      <InverseField>
        <Story />
      </InverseField>
    ),
  ],
}

export const WithIcon: Story = {
  name: 'Secondary with a leading icon',
  args: { variant: 'secondary', icon: 'plus', children: 'Add task' },
}

export const WithIconSmall: Story = {
  name: 'Secondary, small, with a leading icon',
  args: { variant: 'secondary', size: 'sm', icon: 'plus', children: 'Add step' },
}

export const Block: Story = {
  name: 'Block, the full width of its parent',
  args: { variant: 'secondary', block: true, icon: 'plus', children: 'Add task' },
  decorators: [
    (Story) => (
      <div style={{ width: 260 }}>
        <Story />
      </div>
    ),
  ],
}

export const Stretch: Story = {
  name: 'Stretch, taking the free space in a row',
  args: { variant: 'inverse-solid', stretch: true, children: 'Answer' },
  render: (args) => (
    <InverseField>
      <div style={{ display: 'flex', gap: 'var(--space-2)', width: 320 }}>
        <Button {...args} />
        <Button variant="inverse-outline">Cancel</Button>
      </div>
    </InverseField>
  ),
}

export const Submit: Story = {
  name: 'Submit type, inside a form',
  parameters: ACCENT_FILL_CONTRAST,
  args: { type: 'submit', children: 'Add task', size: 'sm' },
  render: (args) => (
    <form onSubmit={(event) => event.preventDefault()}>
      <Button {...args} />
    </form>
  ),
}

export const Disabled: Story = {
  name: 'Disabled',
  parameters: ACCENT_FILL_CONTRAST,
  args: { disabled: true, children: 'Sign off' },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Sign off' })

    await userEvent.click(button)
    button.focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onPress).not.toHaveBeenCalled()
  },
}

export const Busy: Story = {
  name: 'Busy, keeping its label',
  parameters: ACCENT_FILL_CONTRAST,
  args: { busy: true, children: 'Sign off' },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Sign off' })

    await expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    await userEvent.keyboard('{Enter}')
    await expect(args.onPress).not.toHaveBeenCalled()
  },
}

export const BusyInverse: Story = {
  name: 'Busy, inverse solid, inside an inverse Frame',
  args: { variant: 'inverse-solid', busy: true, children: 'Mark done' },
  decorators: [
    (Story) => (
      <InverseField>
        <Story />
      </InverseField>
    ),
  ],
}

export const DisabledInverse: Story = {
  name: 'Disabled, inverse outline, inside an inverse Frame',
  args: { variant: 'inverse-outline', disabled: true, children: 'Park' },
  decorators: [
    (Story) => (
      <InverseField>
        <Story />
      </InverseField>
    ),
  ],
}

export const LongLabel: Story = {
  name: 'Long label, primary, in a narrow parent',
  parameters: ACCENT_FILL_CONTRAST,
  args: { children: LONG_LABEL },
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
}

export const LongLabelOthers: Story = {
  name: 'Long label, secondary, ghost and utility, in a narrow parent',
  args: { variant: 'secondary', size: 'sm', children: LONG_LABEL },
  render: (args) => (
    <div style={{ display: 'grid', gap: 'var(--space-3)', width: 240 }}>
      <Button {...args} />
      <Button variant="ghost">{LONG_LABEL}</Button>
      <Button variant="utility" size="sm">
        {LONG_LABEL}
      </Button>
    </div>
  ),
}

export const LongLabelInverse: Story = {
  name: 'Long label, inverted, in a narrow parent',
  args: { variant: 'inverse-solid', children: LONG_LABEL },
  render: (args) => (
    <InverseField>
      <div style={{ display: 'grid', gap: 'var(--space-3)', width: 240 }}>
        <Button {...args} />
        <Button variant="inverse-outline">{LONG_LABEL}</Button>
      </div>
    </InverseField>
  ),
}

export const EveryLightLook: Story = {
  name: 'Every light variant at every size, enabled and disabled',
  parameters: ACCENT_FILL_CONTRAST,
  render: () => <EveryLook surface="light" />,
}

export const EveryInverseLook: Story = {
  name: 'Every inverted variant at every size, enabled and disabled',
  render: () => <EveryLook surface="inverse" />,
}

export const Narrow: Story = {
  name: 'Every light variant at the narrow width',
  parameters: ACCENT_FILL_CONTRAST,
  render: () => (
    <ViewFrame width="narrow">
      <EveryLook surface="light" />
    </ViewFrame>
  ),
}

export const NarrowInverse: Story = {
  name: 'Every inverted variant at the narrow width',
  render: () => (
    <ViewFrame width="narrow">
      <EveryLook surface="inverse" />
    </ViewFrame>
  ),
}

export const NarrowLongLabel: Story = {
  name: 'Long label at the narrow width',
  parameters: ACCENT_FILL_CONTRAST,
  args: { children: LONG_LABEL },
  decorators: [
    (Story) => (
      <ViewFrame width="narrow">
        <Story />
      </ViewFrame>
    ),
  ],
}
