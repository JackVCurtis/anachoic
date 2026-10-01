# Plan for todos/

> **Superseded.** This was the planning draft. The authority is now [docs/architecture/](docs/architecture/01-overview.md), whose phases are in [09](docs/architecture/09-testing-and-build-order.md#phases), and the todos in [todos/](todos/order.csv). The draft's ids and titles differ from the final ones.

This plans the `todos/` directory of the Anachoic MCP App. The app is an MCP server whose tools render Anachoic's board as inline views in one dedicated Claude desktop chat. The board tracks tasks and their handoff chains, and it shows the work of every Claude session that uses the same server, not only the dedicated one.

## Topology

```
 Dedicated session (Claude desktop chat, .mcpb)         Worker sessions (Claude Code, other chats)
 ── renders views, you talk to Anachoic here ──         ── text results only, do the work ──
        │ stdio                                                │ stdio            │ stdio
   server process A                                      server process B    server process C
        └──────────────────────── SQLite (WAL) in the data directory ──────────┘
                                   one board, every session
```

- **Server processes.** Claude Code starts one stdio server process per session. Claude desktop starts one process that serves every chat (spike MCP-03).
- Every server process shares one SQLite database, so there is one board for all sessions.
- Each view polls the board to show writes made by other sessions.

## Decisions taken

| Decision | Choice |
|---|---|
| Host | The dedicated session is Claude desktop chat, with the server installed as a `.mcpb` desktop extension (local stdio). The spike confirmed views render this way, so no fallback is needed. |
| Sessions | You open one dedicated session for talking to Anachoic. Worker sessions run alongside it, and the board shows their work. Workers usually see text results only. |
| Reuse | Copy the anachoic subset you need: CSS, helpers, primitives and patterns. Each copied file records its source path and commit. After that the two repos change independently. |
| Model | Anachoic-style tasks. A task has a chain of steps, and each step is owned by an agent or by you. An agent step belongs to no session until a worker session claims it, and the claiming session is then recorded on it. Task statuses are backlog, queue, active and done. Step statuses are pending, running, waiting and done. |
| Waking Claude | When you act in the view, the view calls `sendMessage` straight away, which wakes the dedicated session. Worker sessions get your answers through `wait_for_answer`, which blocks in calls of up to 20 minutes. `updateModelContext` is not used, because it never reaches the model in desktop chat. |
| Theme | Light only to begin with, inside the host's border. Desktop sends `theme: "dark"` when the app is dark, so a light board sits in a dark chat until dark mode is revisited after phase 2. |
| Sign-off | Sign-off stays a visible state and an action you take. It sits in the board's Done section, with no tab of its own. |
| Claiming | Worker sessions claim agent steps with `claim_step`. Neither the dedicated session nor you assign a step to a session. A claim is atomic, and a stale session's claimed step goes back to unclaimed. |
| Creating tasks | Any session may create tasks, including when the dedicated session is not open. The board shows them the next time it is opened. |
| What wakes the dedicated session | Only actions you take in its view. Workers' events, questions included, appear on the live board but never post a message. |
| Agent waiting on you | The agent asks a free-text question, and you write a free-text answer. Anachoic's wait reasons are dropped. |
| Docs | A lean `docs/architecture/` set is written after the spikes and before the todos. The todos cite it. |

## Facts that shape the plan

These were verified in the spikes on 2026-10-01. The evidence is in [docs/spikes/mcp-apps/notes.md](docs/spikes/mcp-apps/notes.md).

- **SDK.** `@modelcontextprotocol/ext-apps` 2.0.3 pairs with the split SDK, `@modelcontextprotocol/server` 2.x, and zod 4. Vite with vite-plugin-singlefile and esbuild's JavaScript API produce one HTML file per view and one server file.
- **Desktop chat renders views from a `.mcpb`.**
  - It advertises `io.modelcontextprotocol/ui`.
  - It offers the `inline` and `fullscreen` display modes, with no `pip`.
  - Views are 735 px wide, with a height limit of 5000 px.
  - The server runs on desktop's bundled Node 24.21, which has `node:sqlite`, so the `.mcpb` needs no native modules.
- **Claude Code shows text only.** It does not advertise the extension, so every tool result needs a complete, compact text form. Claude Code reads up to 25,000 tokens per result.
- **Identity.**
  - **Workers.** A Claude Code server process inherits `CLAUDE_CODE_SESSION_ID` and `CLAUDE_PROJECT_DIR`. A worker is therefore identified without the model passing an id. `join_board` only sets a display name.
  - **The dedicated session.** One desktop process serves every chat, with an empty environment and no conversation id. The dedicated session is identified by its client, `claude-ai`, which advertises the UI extension, rather than by an id.
  - **Fallback.** A client that offers neither falls back to a session id minted by `join_board`, which the model passes back.
- **SQLite with WAL is safe across processes,** provided three rules hold:
  - create the schema once, behind `user_version`
  - never hold a write transaction across I/O or an `await`
  - treat `SQLITE_BUSY` as a retryable refusal

  Under those rules, 8 processes made 4,000 concurrent writes in 0.3 s, and the revision counter stayed contiguous.
- **Views live between turns.**
  - While you are reading or acting, a view polls steadily, even off screen.
  - When Claude takes a turn, every view goes quiet, without `onteardown`.
  - When the turn ends, every view in the chat is rebuilt and sent a replay of its **original** tool result. Views are also rebuilt after an app restart.
  - So a view keeps no state of its own. On connect it fetches the current board through an app-only `get_board`, then polls every few seconds. Nothing needs to detect stale views.
- **App-only tools are hidden from the model.** `visibility: ["app"]` was honored in desktop chat and in the Code tab, and the view can still call those tools.
- **Waking.** The view's `sendMessage` posts a user turn, and Claude replies. `updateModelContext` returns success but never reaches the model in desktop chat.
- **Timeouts** (from the docs):
  - **Claude Code:** about 28 h on the wall clock. It aborts a call after 30 min with no response and no progress.
  - **Desktop and claude.ai:** 240 s per tool call.

  So `wait_for_answer` sends progress every minute and returns within 20 min, and nothing blocks in the dedicated session.
- **Fonts.** Barlow inlined as `data:` loads in desktop chat. There were no CSP violations.
- **Resize loop.** A view that grows whenever a host context change arrives triggers an endless resize loop. Views ignore changes that carry only dimensions.
- **Task detail becomes its own view.** TaskDrawer is a modal `<dialog>`, which fits poorly in an inline iframe. Task detail is an `open_task` view that requests fullscreen.
- **Some pieces have not been built in anachoic yet.** Queue reordering (UIS-14/15), the chain timeline (UIS-08) and the task and step state machine (DOM-05) are built here from anachoic's docs.
- **Some pieces are worth copying.** Anachoic has already built AgentsSection and AgentSlotCard (UIS-17), and they suit the new Sessions section.

## Directory format (same as anachoic)

- The directory is `todos/`. Each todo is a file named `<AREA>-<NN>-<slug>.yaml`, with these fields:
  - `id`, `title` and `area`
  - `phase`, written as a quoted string
  - `summary`, written as a folded scalar
  - `requirements` and `acceptance_criteria`
  - `depends_on` and `external_dependencies`
  - `docs`
- `todos/order.csv` lists the todos in build order, with the columns `order,id,title,area,phase,depends_on,file`. Within `depends_on`, ids are separated by `;`.
- A `docs:` entry takes one of two forms:
  - `NN-file.md#slug` refers to this repo's `docs/architecture/`.
  - `anachoic:ui/NN-file.md#slug` refers to the sibling repo, and is used for anything copied unchanged.
- Commit messages start with `[ID]`.

## Docs set (docs/architecture/)

| File | Holds |
|---|---|
| 01-overview.md | What the app is. The dedicated session and worker sessions. The vocabulary, with what carries over from anachoic and what is dropped: scheduler, cap, tmux, terminals, workflows and the CLI. The seam between server and view. |
| 02-stack-and-structure.md | Pinned versions. Folders: `server/`, `view/components/`, `view/entries/`, `shared/` and `tests/`. The single-file view build. The rule for recording where copied files came from. |
| 03-domain-model.md | Board, task, step and session. State machines and derived facts: current step, your turn, list membership, and what each session is doing. Queue order. Refusals. |
| 04-persistence.md | The data directory, the SQLite schema and migrations, WAL across processes, the revision counter, and retention |
| 05-sessions.md | Identity per client (environment, client name, or a minted id as fallback), roles, heartbeat and staleness, claiming agent steps, and `wait_for_answer` |
| 06-tools-and-views.md | The tool catalogue for both roles, with each tool's visibility. Input schemas. `structuredContent`, which carries the view props. Text fallbacks. Views that last only between turns: fetch on connect, then poll. `sendMessage`. |
| 07-ui-port.md | What is copied from anachoic `ui/`, and where it departs: inlined fonts, light only in a host that may be dark, iframe sizing instead of a minimum window, no routes, sign-off inside the board, task detail as its own view |
| 08-packaging-and-hosts.md | The `.mcpb` manifest and desktop's bundled runtime. Adding the server to worker sessions with `claude mcp add`, using the same data directory. The development loop with basic-host and MCPJam. |
| 09-testing-and-build-order.md | Test suites, multi-process tests, and the phase table below |
| 10-open-questions.md | Decisions, open questions and spike results |

## Areas

| Area | Covers |
|---|---|
| FND | Foundation: the repo, toolchain, lint, test harness, view build and CI |
| MCP | The server, tools, resources, results, model context, sessions on the wire, and end-to-end tests |
| DOM | Domain types, state machines, queue order, the SQLite store and services |
| UIF | UI foundation: the CSS port, library structure, helpers, strings, the host bridge and fixtures |
| UIP | Primitives and patterns, copied from anachoic |
| UIS | Views and screen components |
| PKG | Packaging as `.mcpb`, and installation for both roles |

## Phases and todos

There are about 55 todos.

### spike (done)

The spikes are kept as todos so the order stays complete. Their results are in [notes.md](docs/spikes/mcp-apps/notes.md), and the probe is in `docs/spikes/mcp-apps/probes/`.

| ID | Title | Depends on |
|---|---|---|
| MCP-01 | Hello-view spike: render a `ui://` view in desktop chat from a `.mcpb` | |
| MCP-02 | View lifecycle spike: iframes per call and per turn, polling, display modes, host context, `visibility`, `sendMessage` and `updateModelContext` | MCP-01 |
| MCP-03 | Multi-session spike: SQLite with WAL across processes, session identity per client, processes per chat, and tool timeouts | MCP-01 |
| UIF-01 | Fonts and CSP spike: Barlow inlined as `data:` loads in desktop chat | MCP-01 |

### 0: Foundation

This phase ends with `show_board` rendering an empty BoardView in the dedicated session, with a text fallback.

| ID | Title | Depends on |
|---|---|---|
| FND-01 | Scaffold the repo: git, pnpm, Node 24, TypeScript 6, ESM, the folder skeleton, prettier and editorconfig | |
| FND-02 | Lint and typecheck, with the component layer rules copied from anachoic and ext-apps imports banned inside components | FND-01 |
| FND-03 | Single-file view build: Vite with vite-plugin-singlefile, producing one HTML file per view entry | FND-01 |
| FND-04 | Vitest browser mode and Storybook with the a11y addon set to error, copied from anachoic | FND-02, FND-03 |
| FND-05 | CI that typechecks, lints, tests and builds | FND-04 |
| UIF-02 | Copy the global CSS: layers, tokens, base and typography. Barlow and Barlow Condensed are inlined as `data:` fonts. The surface is light only. | UIF-01, FND-03 |
| UIF-03 | Copy the library structure: `types.ts`, `join_classes`, the testing harness, `use_now` and `use_escape_layer` | FND-04, UIF-02 |
| UIF-04 | Copy the helpers `words`, `time` and `steps`, and write a strings catalogue for this app's screens | UIF-03 |
| UIF-05 | Host bridge: `useApp` in each entry, a store for the host context, auto-resize without the resize loop, and layout rules for a 735 px inline iframe | MCP-02, UIF-03 |
| UIP-01 | Copy Frame, Rule, VisuallyHidden, Icon, Button and IconButton | UIF-03 |
| UIP-02 | Copy Tag, StatusSquare, TextInput, TextArea and ActionCard | UIP-01 |
| UIP-03 | Copy SectionHeader, PageHeader, EmptyState, MetaLine and Disclosure | UIP-01 |
| MCP-04 | Server skeleton: McpServer on stdio, logs on stderr (never the environment), `registerAppResource` for each view, `prefersBorder`, and the data directory from the manifest's `env` | MCP-01, FND-03 |
| UIS-01 | BoardView scaffold with empty regions for Your turn, Sessions, Active, Queue, Backlog and Done | UIF-05, UIP-03 |
| MCP-05 | `show_board` renders the empty BoardView with a text fallback. An app-only `get_board`, which the view calls on connect and then polls, so a replayed result is never shown. | MCP-04, UIS-01 |

### 1: Tasks, chains and sessions

This phase ends with any number of sessions joining the board, creating tasks with chains and reporting their own steps. The dedicated session's board shows all of it.

| ID | Title | Depends on |
|---|---|---|
| DOM-01 | Domain types and ids: task ids in the form T-n, and session ids | FND-01 |
| DOM-02 | Task and step state machine with derived facts, built from anachoic app/04 rather than copied | DOM-01 |
| DOM-03 | Queue order rules, copied from anachoic's pure functions | DOM-01 |
| DOM-04 | SQLite store with `node:sqlite`: data directory, migrations behind `user_version`, WAL, the revision counter, short `BEGIN IMMEDIATE` writes, and `SQLITE_BUSY` as a retryable refusal | DOM-01, MCP-03 |
| DOM-05 | Sessions: join, role, name, last heard from, stale, and which agent steps each session has claimed | DOM-04 |
| DOM-06 | Board services: create a task, start, claim a step (atomic, and released when the session goes stale), advance, ask you, answer, complete, sign off, follow up and archive. Each refuses with a reason when it cannot act. | DOM-02, DOM-03, DOM-05 |
| UIP-04 | Copy OwnerChip, StatusBadge, StepPips and ChainPreview | UIP-02 |
| UIF-06 | Board fixtures with several sessions, for stories and tests | UIF-04, DOM-02 |
| MCP-06 | Session identity: a worker is identified by `CLAUDE_CODE_SESSION_ID` and `CLAUDE_PROJECT_DIR`, and the dedicated session by the `claude-ai` client. `join_board` sets a display name. A minted id that the model passes back covers other clients. | DOM-05, MCP-05 |
| MCP-07 | Model tools: `show_board`, `add_task`, `start_task`, `claim_step` (claims the next unclaimed agent step, or a named one), `update_step`, `ask_you` (a free-text question) and `add_follow_up` | DOM-06, MCP-06 |
| MCP-08 | Board props builder, in which the server computes the facts. `structuredContent`, `outputSchema`, and a compact text formatter for every result, kept well under Claude Code's 25,000-token limit. | MCP-07 |
| MCP-09 | Server instructions and tool descriptions for each role. The dedicated session coordinates. Workers report progress and ask you questions. | MCP-07 |
| UIS-02 | Your turn section: your steps, and agent questions with the session that asked each one | UIS-01, UIP-04, UIF-06 |
| UIS-03 | Sessions section: each session's name, its role, its current step and when it was last heard from. Adapted from anachoic's AgentsSection and AgentSlotCard. | UIS-01, UIP-04, UIF-06 |
| UIS-04 | Active section: chain pips, the current step, the session that claimed it (or "unclaimed") and the elapsed time | UIS-01, UIP-04, UIF-06 |
| UIS-05 | Queue and Backlog sections and cards | UIS-01, UIP-04, UIF-06 |
| UIS-06 | Done section: tasks awaiting sign-off, shown with their state, and signed-off tasks folded away | UIS-01, UIP-04, UIF-06 |

### 2: A board you can work

This phase ends with you acting in the view. The dedicated session is woken, and workers receive your answers.

| ID | Title | Depends on |
|---|---|---|
| UIP-05 | Copy InlineConfirm, FlashMessage and BusyIndicator | UIP-02 |
| MCP-10 | App-only tools: `get_board(sinceRevision)` (extending MCP-05), `complete_my_step`, `answer_question`, `reorder_queue`, `move_task`, `sign_off`, `archive_task` and `add_task_from_view` | MCP-08 |
| MCP-11 | `wait_for_answer` for workers: it sends progress every minute, returns when you answer or after 20 min, and on timeout tells the model to call again | MCP-10, MCP-03 |
| MCP-12 | Waking the dedicated session: after each action in the view, `sendMessage` with a fixed sentence naming the task and the action | MCP-10, MCP-02 |
| UIS-07 | Live board: fetch on connect, poll every few seconds with `sinceRevision`, and show a quiet "updated" cue when the board changes | MCP-10, UIF-05 |
| UIS-08 | Task entry form with a simple chain composer, where each step's owner is either you or an agent | UIS-05, MCP-10 |
| UIS-09 | Your-turn actions: mark your step done with an optional note, and answer an agent's question in free text | UIS-02, UIP-05, MCP-12 |
| UIS-10 | Queue keyboard move and its announcements, built from anachoic ui/15 and ui/16 | UIS-05, MCP-10 |
| UIS-11 | Queue pointer drag and the held order | UIS-10 |
| UIS-12 | Sign off and follow-up from the Done section, using InlineConfirm | UIS-06, UIP-05, MCP-12 |
| UIS-13 | Message region: refusals from app-only tools, shown with FlashMessage | UIP-05, MCP-10 |

### 3: Task detail

| ID | Title | Depends on |
|---|---|---|
| DOM-07 | Step notes, links (URL, file or pull request), the questions and answers, and the event log | DOM-06 |
| UIS-14 | Chain timeline and timeline step, built from anachoic ui/13 | UIP-04, DOM-07 |
| MCP-13 | `open_task` view: request fullscreen where the host allows it, and open links through `openLink` | MCP-08, UIS-14 |
| UIS-15 | Task detail actions: archive a task, and cancel a step, both with InlineConfirm | UIS-14, UIP-05 |

### 4: Hardening and distribution

| ID | Title | Depends on |
|---|---|---|
| FND-06 | Logging and error mapping: domain refusals become `isError` results with plain text | MCP-10 |
| DOM-08 | Retention and recovery: prune signed-off tasks and stale sessions, survive restarts and a locked or corrupt database | DOM-04 |
| PKG-01 | `.mcpb` package: manifest and icon, the bundled server, the view HTML, and `mcpb pack` | MCP-13 |
| PKG-02 | Install for worker sessions: `claude mcp add` pointing at the same data directory, and a README | PKG-01 |
| PKG-03 | Development scripts for basic-host and MCPJam | MCP-05 |
| MCP-14 | End-to-end tests. Two MCP clients in separate processes drive both roles, and Playwright runs the views in basic-host, including live updates and waking. | MCP-13, MCP-11 |
| UIS-16 | Conformance sweep across views at chat widths: a11y, content rules and token use | UIS-15 |

## Open questions for the docs

None. New questions from the spikes go into `docs/architecture/10-open-questions.md`.
