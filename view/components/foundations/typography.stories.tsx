// Copied from anachoic inertia/components/foundations/typography.stories.tsx at fd99e0d
type Sample = { name: string; text: string; extra?: string }

const GROUPS: { title: string; samples: Sample[] }[] = [
  {
    title: 'Titles',
    samples: [
      { name: 'text-title-page', text: 'Sign off' },
      { name: 'text-title-panel', text: 'Add rate limiting to the public API' },
      { name: 'text-title-5', text: 'Migrate the billing webhooks to the new queue' },
      { name: 'text-title-4', text: 'Review the schema change for sessions' },
      { name: 'text-title-3', text: 'Fix flaky login test' },
      { name: 'text-title-2', text: 'Write the migration' },
      { name: 'text-title-1', text: 'Update the onboarding copy' },
    ],
  },
  {
    title: 'Labels',
    samples: [
      { name: 'text-section', text: 'Waiting on user' },
      { name: 'text-label', text: 'Chain preview' },
      { name: 'text-note', text: 'Then the reviewer signs off' },
      { name: 'text-status', text: 'Step 3/5 · 14m' },
      { name: 'text-name', text: 'Agent 2' },
      { name: 'text-control', text: 'Board' },
    ],
  },
  {
    title: 'Plain text',
    samples: [
      { name: 'text-count', text: '2 agents · 1 for the user' },
      { name: 'text-body', text: 'The default body text of the dashboard.' },
      {
        name: 'text-body-sm',
        text: 'Tasks that finished and wait for the user to read the result and sign it off before they move to Completed.',
      },
      { name: 'text-detail', text: 'Plan, then build, then review' },
      { name: 'text-hint', text: '⇧ Enter adds a line' },
    ],
  },
  {
    title: 'Monospace',
    samples: [
      { name: 'text-mono', text: 'claude --resume 3f2a9c' },
      { name: 'text-mono-sm', text: 'docs/plan.md' },
      { name: 'text-mono-xs', text: 'T-0142 · 09:41' },
    ],
  },
  {
    title: 'Figures',
    samples: [
      { name: 'text-status', text: 'Elapsed 11m 11s', extra: 'proportional' },
      { name: 'text-status text-tabular', text: 'Elapsed 11m 11s', extra: 'tabular' },
      { name: 'text-status', text: 'Elapsed 40m 08s', extra: 'proportional' },
      { name: 'text-status text-tabular', text: 'Elapsed 40m 08s', extra: 'tabular' },
    ],
  },
]

function TypeScale() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)', padding: 'var(--space-6)' }}>
      {GROUPS.map((group) => (
        <section key={group.title} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <h2 className="text-section">{group.title}</h2>
          {group.samples.map((sample) => (
            <div
              key={`${sample.name} ${sample.text}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '220px minmax(0, 480px)',
                gap: 'var(--space-4)',
                alignItems: 'baseline',
              }}
            >
              <code className="text-mono-xs">
                {sample.name}
                {sample.extra ? ` (${sample.extra})` : ''}
              </code>
              <span className={sample.name}>{sample.text}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

export default {
  title: 'Foundations/Typography',
  parameters: {
    a11y: {
      /*
       * The labels show --color-text-subtle, which is below 4.5:1 by design
       * (ui/16, "Built as designed"). The contrast of the text roles belongs
       * to the tokens, not to this scale, so only that rule is off here.
       */
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
}

export const NamedScale = {
  render: () => <TypeScale />,
}

/**
 * Styles that name their own color keep it here. A component on the inverted
 * field sets the tone's colors itself.
 */
export const NamedScaleInverted = {
  name: 'Named scale, inverted',
  parameters: { tone: 'inverse' },
  render: () => <TypeScale />,
}
