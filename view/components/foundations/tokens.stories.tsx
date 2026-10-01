// Copied from anachoic inertia/components/foundations/tokens.stories.tsx at fd99e0d
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import type { Tone } from '../types'
import { resolvedColor } from '../testing/resolved_color'
import tokensCss from '../../css/tokens.css?raw'

const COLOR_TOKEN = /^--(?:color|tint|inverse|tone)-/

const GROUPS = [
  { title: 'Colors', prefix: '--color-' },
  { title: 'Ink tints', prefix: '--tint-' },
  { title: 'Inverted surface', prefix: '--inverse-' },
  { title: 'Tone', prefix: '--tone-' },
]

/**
 * The custom properties each rule of tokens.css declares, by selector, in
 * source order.
 */
function declarations(css: string): Record<string, Map<string, string>> {
  const blocks: Record<string, Map<string, string>> = {}
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const declared = new Map<string, string>()
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      declared.set(name, value.trim())
    }
    blocks[selector.trim()] = declared
  }
  return blocks
}

const DECLARED = declarations(tokensCss)
const ROOT = DECLARED[':root']
const INVERSE = DECLARED["[data-tone='inverse']"]
const COLOR_TOKENS = [...ROOT.keys()].filter((name) => COLOR_TOKEN.test(name))

function declaredValue(name: string, tone: Tone) {
  return (tone === 'inverse' ? INVERSE.get(name) : undefined) ?? ROOT.get(name)
}

function Swatches({ tone }: { tone: Tone }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      {GROUPS.map((group) => (
        <section key={group.title} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <h2 className="text-title-3">{group.title}</h2>
          <ul
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 'var(--space-2) var(--space-6)',
              padding: 0,
              listStyle: 'none',
            }}
          >
            {COLOR_TOKENS.filter((name) => name.startsWith(group.prefix)).map((name) => (
              <li
                key={name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px minmax(0, 1fr)',
                  gap: 'var(--space-3)',
                  alignItems: 'center',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    height: 'var(--size-control)',
                    background: `var(${name})`,
                    border: 'var(--border-hairline) solid var(--tone-rule)',
                  }}
                />
                <span style={{ display: 'grid' }}>
                  <code className="text-mono-sm">{name}</code>
                  <code className="text-mono-xs">{declaredValue(name, tone)}</code>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const meta = {
  title: 'Foundations/Tokens',
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Light: Story = {
  render: () => <Swatches tone="light" />,
}

export const Inverted: Story = {
  parameters: { tone: 'inverse' },
  render: () => <Swatches tone="inverse" />,
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector<HTMLElement>("[data-tone='inverse']")
    expect(frame).not.toBeNull()

    const style = getComputedStyle(frame!)
    expect(style.color).toBe(resolvedColor('--tone-fg', frame!))
    expect(style.color).toBe(resolvedColor('--color-bg'))
    expect(style.backgroundColor).toBe(resolvedColor('--inverse-bg'))
  },
}
