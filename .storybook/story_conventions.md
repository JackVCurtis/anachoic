<!-- Copied from anachoic .storybook/story_conventions.md at fd99e0d -->
# Story conventions

Every component in `view/components/` follows these. The full rules are in
anachoic's `docs/architecture/ui/19-organization-and-testing.md`, and this
app's departures from them in `docs/architecture/07-ui-port.md`.

## Files and names

- A component's stories sit beside it: `step_pips/step_pips.stories.tsx`.
- The meta `title` is the folder and the component: `Patterns/StepPips`.
- A story's name describes the state it shows, in a sentence: "Waiting on
  you", not "Variant 3". Set `name` when the export name cannot say it.

## Stories every component needs

| Story              | When                                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| Default            | Always. The common case.                                                     |
| One per variant    | Every value of every option.                                                 |
| Inverted           | When the component can sit on the inverted field.                            |
| One per data state | Every row of the component's States table.                                   |
| Disabled, Busy     | For controls.                                                                |
| Long text          | A title of 120 characters, a session name of 40, a message of 200.           |
| Empty              | For lists.                                                                   |
| Many               | For lists: 12 steps, 20 cards.                                               |
| Narrow             | For anything that can sit in a card or a view: drawn at the 600 px width.    |

Hover, pressed and focus are not stories. An interaction test covers them.

## What the preview gives every story

- **The global CSS.** `preview.tsx` imports `view/css/app.css`.
- **A fixed clock.** Every story sits under `NowProvider` with `FIXED_NOW`,
  Thursday 12 March 2026 at 09:41 UTC. Build time labels from `INSTANTS` in
  `fixtures/clock.ts`. A story that needs another moment sets
  `parameters: { now: '…' }`.
- **The tone.** `parameters: { tone: 'inverse' }` renders the story inside an
  element with `data-tone="inverse"` that paints the inverted field. The
  toolbar's Tone switch does the same for any story that does not set the
  parameter.
- **The host frame.** A view is an iframe in the chat, 735 px wide in desktop
  chat, and it grows with its content: there is no minimum window and no
  inner scroll region. A view story draws inside `ViewFrame` from
  `testing/view_frame.tsx`, and picks a viewport through its globals:
  `globals: { viewport: { value: 'inline' } }` is the host frame at 735 px,
  and `narrow` is the narrow width of 600 px, the narrowest the views are
  tested at. A component story that can be squeezed draws inside
  `<ViewFrame width="narrow">` too. `windowOverflow()` checks that nothing
  scrolls sideways at either width.
- **The accessibility check.** axe runs on every story, and a violation fails
  `pnpm test:ui`. Turn a rule off only for a reason the design documents,
  in the story's `parameters.a11y`, with a comment saying why.

## Imports

- Stories never import from `view/entries/` or `view/bridge/`.
- Sample data comes only from `view/components/fixtures/`.
- `view/components/testing/` is the shared setup for stories and tests:
  `renderComponent` and `renderInTone` (Testing Library under the fixed clock,
  with a user-event instance), `ToneFrame`, `ViewFrame` and `resolvedColor`.
  Only stories, tests and the preview import it.

## Tests

- A behavior is tested in a play function on a story, using `storybook/test`,
  or in a `.test.tsx` file beside the component, using `renderComponent`.
- Tests run in Chromium with the time zone fixed to UTC and the locale to
  `en-GB`, so clock times read the same on every machine.
