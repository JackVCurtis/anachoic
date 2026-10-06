# 07. The UI port

The views reuse anachoic's design system and component library. This document says what is copied, what is adapted, and where this app departs from anachoic's UI documents (`anachoic/docs/architecture/ui/`). Anything not mentioned here follows those documents unchanged. The todos cite them as `anachoic:ui/NN-file.md#heading`.

Each copied file records its source and commit ([02](02-stack-and-structure.md#copied-files)).

## What is copied

| Layer | Copied unchanged | Notes |
|---|---|---|
| CSS (`view/css/`) | `app.css` (layer order), `tokens.css`, `base.css`, `typography.css` | `fonts.css` is rewritten to inline the woff2 files ([fonts](#fonts)). Terminal tokens are dropped. The contrast fixes in [contrast](#contrast) change `tokens.css` and `typography.css`. In `base.css` the rule giving `html`, `body` and `#app` `height: 100%` is removed, so the document grows with its content and auto-resize can report it ([layout](#layout)). The `--layout-min-*` tokens stay but nothing uses them. In `tokens.css` the owner-chip tokens `--tone-chip-human-*` are renamed `--tone-chip-you-*`, matching the `you` owner. |
| Types | `types.ts`, trimmed to `Owner`, `StepStatus`, `TaskStatus`, `Tone` | `Owner` becomes `'agent' \| 'you'` to match [03](03-domain-model.md#step). Slot, pickup, placement and step-action types go. |
| Helpers | `join_classes`, `words`, `time`, `steps`, `announcement`, `messages`, `constants`, the move logic from `board_rail` (`movedOrder`, `moveAnnouncement`, `queuePosition`), and `badgeFor` from `task_drawer` | With their tests. `strings.ts` is replaced ([content](#content)). `repoLabel` goes, because there are no repos. |
| Hooks | `use_now`, `use_escape_layer` | |
| Testing | `testing/` (`render`, `setup`, `tone_frame`, `view_frame`, `clipboard`, `resolved_color`) and the Storybook preview decorators | `view_frame` gains the 735 px host frame |
| Primitives | Frame, Rule, VisuallyHidden, Icon, Button, IconButton, Tag, StatusSquare, TextInput, TextArea, ActionCard, Select, DataTable | Select is used by TaskEntry's Worker field ([11](11-assignment-and-outputs.md#board)) and the chain composer's Output field ([11](11-assignment-and-outputs.md#board-1)). DataTable is used by the History view ([14](14-commands-and-history.md#the-history-view)). RangeSlider and MonoBlock are not needed. |
| Completed | CompletedTable and Pagination, from anachoic's `completed/` | Adapted to History's columns. They live in `board/` because they reuse ArtifactLinks. Only a row's title opens the task, because the row also holds links. |
| Patterns | SectionHeader, PageHeader, EmptyState, MetaLine (without its repo prop), Disclosure, OwnerChip, StatusBadge, StepPips, ChainPreview, InlineConfirm, FlashMessage, BusyIndicator, CopyButton | StepPips and ChainPreview take a session name where anachoic took an agent name. CommandBox, SessionLink, SegmentedControl, StepActions and WorkflowField are not needed. |
| Board | QueueSection, QueueCard, MoveHandle, BacklogSection, BacklogCard, AgentsSection and AgentSlotCard | Adapted. See below. |

The lint rules from anachoic `eslint/component_rules.js` and the relevant parts of `eslint.config.js` are copied ([09](09-testing-and-build-order.md#lint)). One rule is added: an entry's `fixtures.ts` may import the library's fixtures, so the two layers of board fixtures describe the same states.

## What is built here from anachoic's documents

These are specified in anachoic but not yet built there, so they are written here from the documents rather than copied:

| Piece | Source |
|---|---|
| Queue reordering with the keyboard, with announcements | `anachoic:ui/15-interaction-and-state.md#moving-a-queue-card`, `anachoic:ui/16-accessibility.md#a-list-that-can-be-reordered`, `anachoic:ui/10-components-board.md#movehandle` |
| Queue reordering with a pointer, and the held order | The same documents |
| The chain timeline and each timeline step | `anachoic:ui/13-components-task-drawer.md` |

## What is new

[11](11-assignment-and-outputs.md) adds the Worker and Output fields to TaskEntry, the artifact field to YourTurnCard, and artifact links and the assigned worker to the cards.

[12](12-blocked-steps.md#board) adds a third kind of YourTurnCard, a step a worker blocked, whose only action is Stop and Remove ([13](13-ending-sessions.md#stop-and-remove)).

| Component | Layer | Is |
|---|---|---|
| BoardView | `board/` | The one board view. It replaces anachoic's BoardView, SignOffView and CompletedView ([layout](#layout)). |
| BoardHeader | `board/` | The counts (Your turn, Working, Queue, To sign off), a quiet "Updated" cue, and the "Can't reach the board" line ([06](06-tools-and-views.md#polling)) |
| TaskEntry | `board/` | Title and a chain composer: an ordered list of steps, each with a title, an owner (you or an agent) and optional detail. Add, and Add to queue. Adapted from anachoic's TaskEntryForm, without repo, workflow or prompt. |
| YourTurnCard | `board/` | Your step, with Mark done and a note. Or an agent's question, with the asking session's name and a free-text answer field. Park is under InlineConfirm. Adapted from anachoic's three kinds of Your turn card into two. |
| IdleSection, SessionCard | `board/` | Adapted from AgentsSection and AgentSlotCard. A card per live session that holds no step, showing its name and kind and "Idle". A session holding a step is left out, since its step's card in Working or Your turn names it. Recently ended sessions show what was released. There is no cap and no slot bars. |
| StopAndRemove | `board/` | "Stop and Remove" behind an InlineConfirm, on a WorkingCard or blocked YourTurnCard whose step a worker holds ([13](13-ending-sessions.md#stop-and-remove)) |
| WorkingCard | `board/` | An active task with a running step: the pips, the step, the session, its latest note, the elapsed time, and Stop and Remove when a worker holds the step |
| DoneSection, SignOffCard | `board/` | Tasks to sign off, each with its times, link count, Sign off, Follow-up and Archive. Below them, the recently signed-off tasks folded under a Disclosure. Adapted from anachoic's SignOffCard and follow-up composer. |
| TaskView, ChainTimeline, TimelineStep, EventList | `task/` | The task view ([06](06-tools-and-views.md#views)) |

## Layout

Anachoic's layout assumes a window at least 1100 × 700 px (`anachoic:ui/14-layout.md#the-frame`). A view is an iframe in the chat, 735 px wide in desktop chat ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)). It grows to fit its content, and auto-resize reports the height to the host, up to the host's `maxHeight`.

**The board is one column:**
1. BoardHeader
2. Message region
3. TaskEntry, collapsed to an "Add task" button until opened
4. Your turn
5. Idle
6. Working
7. Queue
8. Backlog
9. Done

Each section is a SectionHeader with a count, followed by its cards.

**Rules for the views:**

- **No inner scroll regions.** The view grows and the chat scrolls. Anachoic's scrolling rules for regions (`anachoic:ui/14-layout.md#every-scrolling-region`) do not apply.
- **Long sections fold.** A section with more than 8 cards shows the first 8 and a Disclosure, "Show all 14". The queue never folds, because cards are moved within it.
- **Narrow widths.** Under 600 px, which is the minimum the views are tested at, a card's meta line wraps below its title.
- **No minimum window and no small-window message.** Anachoic's `anachoic:ui/14-layout.md#small-windows` is dropped.
- **Height changes come from content only.** A context change that carries only dimensions never changes the height ([06](06-tools-and-views.md#polling)).
- **Spacing.** Padding is `--space-6` on the sides and `--space-4` top and bottom. The host's `safeAreaInsets` are respected when they are larger.

**The task view:**
- It is one column inside the host's fullscreen frame, or inline at 735 px when fullscreen is not available.
- **Display buttons.** Small secondary buttons at the end of the header, in this order: "Back to board", when the view is the board's task panel; "Open in full screen", when it is inline and the host offers fullscreen; "Back to inline", when it is in fullscreen. With none of these, nothing is drawn.
- Park and Archive sit at the end of the meta line, each confirmed in place.
- **Clone task** comes before them, in the board's task panel only, whether the task was opened from a card or from the History panel. It asks nothing: it swaps back to the top of the board with TaskEntry open, holding a copy of the task (its title, its worker and every step, follow-ups included) and focus on the title. A draft already there is replaced. The `open_task` and `show_history` views have no TaskEntry, so they offer no Clone task.

**Settled while building:**
- **The follow-up composer** appends steps to a task to sign off, written as in TaskEntry (title, owner, detail, and Output for an agent step), and places the task at the Back or the Front of the queue. Its note reads "Extends the chain · re-enters the queue" once every step has a title.
- **The Park questions** say what Park does where it is asked. On a Waiting on user card: "Park “{title}”? It moves to the backlog and its step is released." In the task view: "Park “{title}”? Its claim is cleared and it moves to the backlog." They are confirmations, so they end with a full stop.

There is no AppShell, TopBar, ViewTabs, WorkflowsNavLink, PauseControl or CapControl. There are no routes. Opening a task from the board calls `get_task` and swaps the board view to its task panel inside the same iframe. "Open in full screen" then asks for fullscreen. The model's `open_task` renders the task view directly.

## Fonts

Barlow (400, 500, 700) and Barlow Condensed (400, 600) are inlined into each view as `data:` woff2, latin subset only. The spike showed that desktop chat loads them ([notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)). That adds about 110 kB per view. Monospace is the system `ui-monospace` stack, as in anachoic. The host's own fonts are not applied.

## Theme

**The views are light only.**
- **Background.** The board sets its own background, `--color-bg`, so it reads as a light card inside a dark chat when the user's app is dark. The host context reports `theme: "dark"` in that case.
- **Border.** `prefersBorder: true` asks the host to draw its border.
- **Host styles.** The host's style variables are not applied.
- **Inverse surfaces.** Tone scopes (`data-tone="inverse"`) work as in anachoic. The inverse surface is used for the Your turn section header, as anachoic uses it for the Your turn band.

Dark mode is revisited after phase 2 ([10](10-open-questions.md#open-questions)).

### Contrast

Every text in the views reaches 4.5:1, and axe's `color-contrast` rule runs on every story with no exception. Anachoic built some text below 4.5:1 by design and listed a one-token fix for each (`anachoic:ui/16-accessibility.md#what-is-decided-and-what-is-not`). This app takes all three:

- **Secondary text.** `--color-text-subtle`, `--color-text-faint`, `--color-text-meta` and `--color-text-column` point at neutral-700, 5.87:1 on the ground.
- **Dimmed text.** Text that is already neutral-700 is not dimmed with `opacity`: a step's number, status and labels in the timeline, its "Unclaimed", and an event's time.
- **The accent fill.** The primary button and a selected segment (the owner and placement fields) fill with accent-700, so white text on them is 6.3:1. Hover is accent-800 and pressed accent-900.

**Text on the inverted field.** Two tone tokens are added, with `--inverse-fg-subtle` behind the first: `--tone-fg-subtle` (the subtle text role on light, the ground at 75% on the inverted field) and `--tone-fg-accent` (accent text on light, accent-300 on the inverted field). The text classes `text-section` and `text-control` take `--tone-fg`, and `text-label` and `text-status` take `--tone-fg-subtle`, so a label inside an inverted Frame is light without an override. On light they resolve to the same colours as anachoic's. A Frame with the tint fill sets the light tone inside it, so an InlineConfirm on a Waiting on user card keeps dark text and an accent focus ring.

**Characters that are not words.** `SymbolText` (a primitive) draws a string with each of `↗ → ← · — × ⇧` in an `aria-hidden` span, and the dash of an empty value followed by hidden "none", as `anachoic:ui/16-accessibility.md#characters-that-are-not-words` asks. MetaLine, section notes, step lines, counters, step statuses and link labels draw through it.

**Lint.** `eslint/css_rules.js` checks the CSS modules under `view/components/`: no raw or named colour, no `color-mix()`, fonts only through `--font-*`, durations only through `--motion-*`, no terminal token, and gaps and margins wider than 4 px only through `--space-*`, `--gap-stack` or `--gap-rows`. Pixel values stay allowed for control padding, type sizes and fixed dimensions (`anachoic:ui/02-tokens.md#rules-for-using-tokens`).

**Target size.** "Move", "Dismiss", "Park", "Archive", "Back to board", "Back to inline" and "Open in full screen" are each at least 24 px tall, from the small button's `min-height`; the conformance tests measure them.

## The host bridge

`view/bridge/` is the only code that knows about MCP Apps. Components never import it.

| Module | Does |
|---|---|
| `connect.ts` | Creates `App` with `autoResize`, connects, merges partial `onhostcontextchanged` updates into one host context, and ignores updates that carry only `containerDimensions` |
| `host_context.tsx` | A React context with the parts the views use: `displayMode`, `availableDisplayModes`, `safeAreaInsets`, `locale`, `timeZone` |
| `tools.ts` | One typed function per app-only tool. Each returns the parsed props or a refusal. |
| `board_source.ts` | Fetch on connect, poll, back off, and swap in fresh props after a write ([06](06-tools-and-views.md#polling)) |
| `wake.ts` | Your actions' typed callers, which the entries use. It sends no message ([06](06-tools-and-views.md#waking-the-dedicated-session)). |

The clock (`use_now`) takes `timeZone` from the host context, so times are shown in the user's zone.

## Content

[Anachoic's content rules](../../../anachoic/docs/architecture/ui/17-content-rules.md) apply as they stand (`anachoic:ui/17-content-rules.md#rules`):
- sentence case in the source
- exact symbols
- no full stops except in confirmations and announcements
- plurals that agree with their number
- the person using the board is "the user", never "you" (changed on 2026-10-02, [11](11-assignment-and-outputs.md#words-on-screen-and-for-claude)), and never "human"
- buttons that are verbs
- "Cancel" only for closing something

`view/components/helpers/strings.ts` is a new catalogue for this app's screens: board header, task entry, Your turn, Idle, Working, Queue, Backlog, Done, task view, messages, times, and strings for assistive technology. It uses anachoic's `fillTemplate` and `Placeholders` types.

**New words:**
- "Session", for any session, and "This chat", for the dedicated session
- "Claimed by", "Unclaimed" and "Idle"
- "Asks", for an agent's question, and "Answer", for the button
- "Released", for work a session left behind when it ended
- "Blocked", for a step its worker cannot complete until you act with it in its session

The refusal sentences in [03](03-domain-model.md#refusals) follow the same rules.
