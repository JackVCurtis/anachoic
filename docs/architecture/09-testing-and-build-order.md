# 09. Testing and build order

## Test suites

| Suite | Runs in | Covers | Command |
|---|---|---|---|
| unit | Vitest, Node environment | `domain/` (rules, invariants, derived facts, queue order), `store/` against a temporary database, `server/text/`, `server/props/` | `pnpm test:unit` |
| ui | Vitest browser mode with Playwright Chromium, plus the Storybook project | Components, helpers, hooks and the bridge, with a fake `App`. Every story passes the axe check. Copied from anachoic's `vitest.config.ts`, with time-zone projects. | `pnpm test:ui` |
| integration | Vitest, Node environment | The built server driven by `@modelcontextprotocol/client` over stdio. Several server processes run against one temporary data directory, standing in for desktop and two workers. | `pnpm test:integration` |
| e2e | Playwright | The built views in the ext-apps reference host, against the built server over `--http` | `pnpm test:e2e` |

### What must have a test

- **Invariants.** They are checked after every operation in the domain's tests, in the generated style of anachoic DOM-08: every transition from every reachable state.
- **Across processes.** Two processes claim the same step, and exactly one wins. Eight processes write at once, and the revision stays contiguous with no `busy` refusal. A process killed mid-transaction leaves no partial write. These are the spike's measurements, kept as tests ([04](04-persistence.md#writing)).
- **Liveness.** A worker process that is killed has its claim released within the dead window, which tests can shorten through `ANACHOIC_DEAD_WINDOW_MS`, with `ANACHOIC_HEARTBEAT_MS` shortened to match. A process that restarts under the same session id keeps the session.
- **`wait_for_answer`.** It returns on an answer. It sends progress at the interval, which tests can shorten, and returns on its own timeout. It returns at once when the task is parked or archived.
- **Identity.** Identity is resolved for each client kind in [05](05-sessions.md#identity), using fake `clientInfo` and environment.
- **Text results.** The board summary stays under its token budget for a board of 100 tasks and 10 sessions.
- **Views.** A view draws from `get_board`, not from the replayed result. It redraws only on a changed revision. Its height is unchanged by a dimensions-only context change. No action sends a message to the host.
- **Queue moves.** Keyboard moves, pointer moves and their announcements, as listed in `anachoic:ui/19-organization-and-testing.md#interactions-that-must-have-a-test`.

### The manual desktop check

The reference host is more permissive than desktop ([08](08-packaging-and-hosts.md#development-loop)). Before a phase is called done, its views are installed from a fresh `.mcpb` and checked by hand in desktop chat:

- they render
- fonts load
- polling shows a worker's change within 5 s
- each action posts its message
- the board survives a turn and an app restart

The steps are kept in `docs/desktop-check.md`, written in todo PKG-01, in the same style as the spike's checklist.

## Lint

- **Copied from anachoic.** ESLint's flat config, with the component layer rules from anachoic `eslint/component_rules.js` and anachoic's bans on importing pages and layouts.
- **Folder rules.** The rules in [02](02-stack-and-structure.md#folders): `view/` imports only `shared/`, `domain/` is pure, and components never import `@modelcontextprotocol/*` or `view/bridge/`.
- **`domain/` stays pure.** It may not import `node:*` or `store/`.
- **No raw stdout.** `console.log` is banned in `server/` and `store/`, because stdout carries the protocol. Logging goes through the logger ([08](08-packaging-and-hosts.md#logs)).

## Phases

Each phase ends with something you can use in desktop chat. The todos are listed in build order in `todos/order.csv`.

### Spike (done)

MCP-01, MCP-02, MCP-03 and UIF-01 showed that the approach works. Their results are in [../spikes/mcp-apps/notes.md](../spikes/mcp-apps/notes.md).

### Phase 0: Foundation

**Ends with** `show_board` drawing an empty board in desktop chat, installed from a `.mcpb` and styled with anachoic's tokens and fonts, with a text fallback in Claude Code.

FND-01 to FND-05, UIF-02 to UIF-05, UIP-01 to UIP-03, MCP-04, MCP-05, UIS-01, PKG-01, PKG-03.

### Phase 1: Tasks, chains and sessions

**Ends with** worker sessions in Claude Code joining the board, adding tasks with chains, claiming steps, reporting progress and completing them, while the dedicated session's board shows all of it, live.

DOM-01 to DOM-06, UIF-06, UIP-04, MCP-06 to MCP-09, UIS-02 to UIS-07, PKG-02.

In phase 1 a worker can already ask a question with `ask_you`, and the board shows it in Your turn. It cannot be answered until phase 2 brings `answer_question` (MCP-10) and `wait_for_answer` (MCP-11). Until then, test workers either do not ask, or have the question parked.

### Phase 2: A board you can work

**Ends with** you acting in the view: adding tasks, answering questions, finishing your steps, reordering the queue, and signing off. The dedicated session is told of each action, and workers receive your answers.

UIP-05, MCP-10 to MCP-12, UIS-08 to UIS-13.

### Phase 3: Task detail

**Ends with** a task view showing the whole chain, with notes, questions and answers, summaries, links and events, inline or in full screen.

MCP-13, UIS-14 to UIS-16.

### Phase 4: Hardening

**Ends with** something to rely on every day: retention and recovery, a release-quality package, end-to-end tests, and a conformance sweep.

DOM-07, PKG-04, MCP-14, UIS-17.
