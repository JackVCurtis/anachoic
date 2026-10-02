# MCP Apps spike: notes

These notes cover spikes MCP-01 (hello view), MCP-02 (view lifecycle), MCP-03 (multiple sessions) and UIF-01 (fonts). Each claim records where it was observed. The desktop observations followed [desktop-checklist.md](desktop-checklist.md). Steps B2, B6 and D were skipped.

## Where and with what

| Item | Value |
|---|---|
| Date | 2026-10-01 |
| Machine | macOS 26.6 (Darwin 25.6.0), arm64 |
| Node | 24.21.0 (asdf) |
| SDK | `@modelcontextprotocol/ext-apps` 2.0.3, `@modelcontextprotocol/server` 2.2.0, zod 4.6.5 |
| Claude Code | 2.1.285, run headless from the desktop app's Code tab |
| Claude desktop | 2.16120.0 |
| Reference host | ext-apps `examples/basic-host` at 82221c0, built on its own against the published 2.0.3 package |

## The probes

| File | What it does |
|---|---|
| [probes/server.ts](probes/server.ts) | The probe server. stdio by default, or Streamable HTTP with `--http`, which the reference host needs. Every start, initialize, tool call, view report, poll and exit is appended to `probes/.data/calls.jsonl`. |
| [probes/src/view.ts](probes/src/view.ts) | The probe view. It loads Barlow three ways and records any security-policy violation. It polls every 5 s with its visibility, focus and intersection state. It has a button for each host request, and it reports everything back through the app-only tool `probe_view_event`. |
| [probes/sqlite_probe.ts](probes/sqlite_probe.ts), [probes/sqlite_stress.ts](probes/sqlite_stress.ts) | A shared revision counter in SQLite with WAL, bumped by many processes at once |
| [probes/pack.sh](probes/pack.sh), [probes/mcpb/manifest.json](probes/mcpb/manifest.json) | Builds `anachoic-probe.mcpb` |
| [probes/smoke.mjs](probes/smoke.mjs) | A scripted MCP client that lists the tools and calls each one |

Rebuild with `pnpm install && ./pack.sh` in `probes/`.

## Summary

| # | Question | Result |
|---|---|---|
| 1 | Does a view render in desktop chat from a `.mcpb`? | **Confirmed.** It renders inline and connects within about 1 s. |
| 2 | Does a view render from a desktop config stdio entry? | **Not needed**, because 1 passed. Not tested. |
| 3 | Does the SDK, view and build pipeline work? | **Confirmed** in the reference host and in desktop chat |
| 4 | Do `data:` fonts load? | **Confirmed** in desktop chat. All three Barlow loads succeeded under the default CSP, with no violations. |
| 5 | How long do views live, and do they keep polling? | **Confirmed, with a catch.** Views poll steadily between turns, even off screen and unfocused. While Claude takes a turn they go quiet, and every view in the chat is rebuilt when the turn ends. See below. |
| 6 | Are `visibility: ["app"]` tools hidden from the model? | **Confirmed** in desktop chat and in the Code tab. The view can still call them. |
| 7 | Do `sendMessage` and `updateModelContext` work? | **`sendMessage` is confirmed:** it posts a user turn and Claude replies. **`updateModelContext` never reaches the model in desktop chat**, although it returns success. |
| 8 | Which display modes are available? | Desktop offers `inline` and `fullscreen`, with no `pip`. `requestDisplayMode` was exercised only in the reference host. |
| 9 | Is `node:sqlite` available in the server? | **Confirmed** in desktop's bundled runtime, which reports Node 24.21.0 |
| 10 | Is SQLite with WAL safe across processes? | **Confirmed**, with conditions (below) |
| 11 | Can a worker session identify itself without the model's help? | **Confirmed** for Claude Code: `CLAUDE_CODE_SESSION_ID` is set per session. Desktop chat passes no environment and no conversation id. |
| 12 | How long can a tool call block in Claude Code? | **Documented.** The wall clock is about 28 h by default. The idle limit for stdio servers is 30 min with no response and no progress. |
| 13 | How long can a tool call block in desktop chat? | **Documented** as 240 s for claude.ai and Desktop connectors. Whether that covers local `.mcpb` servers is not stated. |
| 14 | Does Claude Code render views? | **No.** It does not advertise the `io.modelcontextprotocol/ui` extension. |
| 15 | Does one server process serve several desktop chats? | **Confirmed.** Two chats were served by the same pid. |
| 16 | Do views survive a restart of the desktop app? | **Confirmed.** They reappear, the host replays the original tool result from the chat history, and they are live again. |

## 3. SDK, view and build pipeline

- The tool list carries `_meta.ui.resourceUri` and also the legacy key `_meta["ui/resourceUri"]`, which `registerAppTool` writes for older hosts.
- App-only tools carry `_meta.ui.visibility: ["app"]`.
- The resource is served as `text/html;profile=mcp-app`, and `_meta.ui` on the content item carries `prefersBorder` and `csp`.
- Vite with vite-plugin-singlefile produces one HTML file. It is 299 kB with Barlow 400 latin inlined twice (once in CSS, once as `?inline`). The bundled server is 1.3 MB, built by esbuild into one ESM file.
  - The esbuild CLI shim failed under pnpm 11. The build calls esbuild's JavaScript API instead ([probes/build_server.mjs](probes/build_server.mjs)).
  - pnpm 11 needs `allowBuilds: { esbuild: true }` in `pnpm-workspace.yaml`.
- In the reference host:
  - The view connected and received its host context.
  - `sendMessage` returned `{}`.
  - `updateModelContext` returned `{}`.
  - `requestDisplayMode` with fullscreen returned `{mode: "fullscreen"}`, followed by a `displayMode` context change.
  - Calling the model-visible tool `probe_whoami` from the view worked.
- **Hazard: a resize loop.** The view writes its event log into the page, so every `onhostcontextchanged` grew the page. Auto-resize then reported a new size, and the host answered with another `containerDimensions` change, about 40 times in 20 s. The real views must not change their height in response to a context change that only carries dimensions.

## 10. SQLite with WAL across processes

Each run forked N processes, and each process made M writes. A write is `BEGIN IMMEDIATE`, then read the revision, bump it, insert a row and commit. The pragmas were `journal_mode=WAL`, `busy_timeout=5000` and `synchronous=NORMAL`, using `node:sqlite` `DatabaseSync`.

| Processes × writes | Lock held per write | Time | Failed | Revisions contiguous |
|---|---|---|---|---|
| 8 × 500 | 0 | 0.3 s | 0 | yes, 1 to 4000 |
| 8 × 60 | 5 ms | 3.6 s | 0 | yes |
| 8 × 60 | 50 ms | 25.9 s | 14 ("database is locked") | yes. Failed writes rolled back. |

- **Run schema creation once, behind a version check.** In the first version, every process ran `CREATE TABLE IF NOT EXISTS` when it opened the database, and that contended for the lock. The probe now checks `PRAGMA user_version` and creates the schema once, inside `BEGIN IMMEDIATE`.
- **Keep writes short, and treat lock failures as retryable.** A write that waits longer than `busy_timeout` fails cleanly, and the revision stays contiguous. Real board writes take well under a millisecond, so this happens only if a write holds the lock across slow work. The rule for DOM-04: never hold a transaction across I/O or an await, and turn `SQLITE_BUSY` into a retryable refusal.
- `node:sqlite` prints an ExperimentalWarning on stderr under Node 24. That is harmless for stdio, which keeps stdout for the protocol.

## 11 and 14. What Claude Code tells the server

These come from a headless `claude -p` run with `--mcp-config`, logged by the probe.

- **`initialize`:**
  - `clientInfo` is `{name: "claude-code", title: "Claude Code", version: "2.1.285"}`.
  - `capabilities` is `{elicitation: {form, url}, roots: {listChanged: true}}`. There is no `extensions` entry for `io.modelcontextprotocol/ui`, so Claude Code does not render views, which matches claude-code#95149. Tools must therefore always return a complete text result.
- **Each `tools/call`:**
  - `_meta` carries `progressToken` and `claudecode/toolUseId`.
  - There is no conversation or session id in the request.
- **Process environment:**
  - The stdio server inherits `CLAUDE_CODE_SESSION_ID`. It is a fresh id for that session (`e261…`), not the parent's.
  - It also inherits `CLAUDE_PROJECT_DIR`, `CLAUDE_CODE_ENTRYPOINT` and `CLAUDE_PID`.
  - So a worker's server process can name its own session without the model passing an id.
  - Still to check: whether the id survives `/clear` and `--resume`, and what a non-Claude-Code client sets (B8, C1).
- **The environment carries account and organisation UUIDs,** such as `CLAUDE_CODE_ACCOUNT_UUID`. The probe log records them, which is why `.data/` is ignored by git. The real server must not log the environment.

## 12 and 13. Tool call timeouts, from the documentation

These were not measured. The blocking test was stopped in favour of the documentation.

- **Claude Code** ([code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)):
  - **Wall clock.** About 28 h when `MCP_TOOL_TIMEOUT` is unset. A per-server `"timeout"` in milliseconds in `.mcp.json` overrides it. The wall clock is hard: progress notifications "don't extend it".
  - **Idle.** A call that sends "no response and no progress notification for the idle window" is aborted. The window is 30 min for stdio servers and 5 min for HTTP, SSE and WebSocket servers. It can be changed with `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`, and `0` disables it.
- **claude.ai and Desktop** ([claude.com/docs/connectors/building](https://claude.com/docs/connectors/building/index.md), "Design within the size and timeout limits"):
  - "240 seconds per tool call", stated for connectors. That page covers remote servers, and the docs don't say whether the limit also applies to local `.mcpb` servers.
  - The maximum tool result is about 150,000 characters there, against 25,000 tokens in Claude Code (`MAX_MCP_OUTPUT_TOKENS`).
- **The MCP spec** defines no timeout values. Timeouts are left to each implementation.

**What this means for the design:**
- **`wait_for_answer` (workers in Claude Code).**
  - Send a progress notification every minute, so the idle limit never trips.
  - Return after at most 20 min with a result that tells the model to call again.
  - A worker can therefore wait for you indefinitely, in 20-minute calls.
  - The ~28 h wall clock never comes into play.
- **The dedicated session (desktop).** Nothing should block there. The 240 s limit is another reason the dedicated session is woken by `sendMessage` rather than by a waiting tool.
- **Result size.** Board results should stay well under 25,000 tokens, because worker sessions in Claude Code read the text result. So the text summary must be compact and must not include the whole board.

## 1, 4–9, 15 and 16. Claude desktop chat

The extension was installed from `anachoic-probe.mcpb`, and a new chat was opened. Everything below comes from the probe log unless it says "seen on screen" or "Claude replied".

**Processes.**
- Installing or starting the app launches the server several times:
  - a short-lived `Anachoic probe-era-probe` 1.0.0, which initializes and exits at once and looks like a capability check
  - a long-lived `local-agent-mode-Anachoic probe` 1.0.0, which made no calls during the test. Its role is unknown.
  - `claude-ai` 0.1.0, which is the chat client
- **The runtime.** All of them run under desktop's bundled runtime, `/Applications/Claude.app/Contents/Frameworks/Claude Helper (Plugin).app`, which reports Node v24.21.0. The working directory is `/`, and the environment is empty, so even `HOME` is missing from what the probe captured. The manifest's `env` was applied, because `PROBE_DATA_DIR` took effect.
- **One process for every chat.** Two chats were served by one pid, and quitting the app stopped it. After a restart a new pid served the same chats.
- **Support is advertised.** The `claude-ai` and `local-agent-mode` clients both declare `extensions["io.modelcontextprotocol/ui"]` with `mimeTypes: ["text/html;profile=mcp-app"]`.
- **The Code tab.** The same extension's tools appeared in a desktop Code-tab session as `mcp__Anachoic_probe__*`, without the two app-only tools. Which process served that session was not established.
- **Tool names.** Chat's model sees them as `mcp__claude-device__lcl-Anachoic_probe-<tool>`.

**Host context**, sent on connect:
- `theme: "dark"`, because the user's app is in dark mode
- 76 style variables, and `css.fonts` with Anthropic Sans loaded from `assets.claude.ai`
- `displayMode: "inline"`, with `availableDisplayModes: ["inline", "fullscreen"]`
- `containerDimensions: {width: 735, maxHeight: 5000}`
- `platform: "desktop"`, `locale: "en-US"`, a `timeZone`, and `safeAreaInsets` of 12 on every side
- `toolInfo` with the tool-call id (for example `cblk_017U…`) and the tool definition
- Host capabilities: `openLinks`, `downloadFile`, `serverTools`, `serverResources`, `logging`, `sandbox`, `updateModelContext` (text and image) and `message` (text)

**Resources.** The `ui://` resource was read only once per server process, so the host caches the HTML. A later observation corrected this: on 2026-10-02, after the Anachoic extension was reinstalled, the new server process served `show_board` but its board resource was never read. Desktop drew the cached HTML of the previous build. The cache is keyed by the resource's address and outlives the server process. That is why the app's view addresses carry a hash of their HTML ([06](../../architecture/06-tools-and-views.md#views)).

**Fonts.** All three probes loaded under the default CSP: a CSS `@font-face` with a `data:` URL, `FontFace` with a `data:` URL, and `FontFace` with an `ArrayBuffer`. No `securitypolicyviolation` fired. So the CSP desktop applies is not the spec's suggested default with no `font-src`. Barlow can be inlined.

**`sendMessage`** returned `{}`. On screen, the text appeared as a user turn, and Claude replied to it without the user typing.

**`updateModelContext`.**
- It returned `{}` each time (13:00:06 and 13:01:08).
- It was followed by a `sendMessage` user turn at 13:01:11, and then by a typed question.
- Claude replied that it had never been given a secret word.
- So in desktop chat, model context sent from a view does not reach the model, at least not on the next turns.

**`visibility: ["app"]`.** Asked to list the probe's tools, Claude named five. `probe_poll` and `probe_view_event` were missing, yet the views called both throughout the test.

**View lifetime and polling.** Each view polled `probe_poll` every 5 s with an instance id it generated itself.

| Window | What happened |
|---|---|
| Quiet periods between turns | Every view instance polled at a steady 5 s, including views scrolled out of the viewport (`intersecting: false`) and views without focus. After the restart, two instances polled for 55 s without a break, one of them off screen. |
| While Claude takes a turn | Polling stopped in every view within about 15 s of the turn starting. For example, `sendMessage` posted a turn at 12:58:39, and the last poll came at 12:58:53. `onteardown` never fired, and no instance resumed. |
| When a turn ends | Every view in the chat was rebuilt as a new instance. It was sent the same `toolInfo.id` and a replay of its **original** tool result, and the tool was not called again. This happened after every turn: 12:59:25, 13:00:02, 13:01:05, 13:02:08 and 13:02:37. |
| After an app restart | Views reappeared, connected to the new server process, received the original tool result again, and polled normally. |

**What this means for the design:**
- **A view's state lives on the server, never in the iframe.** Each view instance lasts one gap between turns. On connect it must fetch the current board through an app-only `get_board`, because the replayed tool result can be days old.
- **The board is live between turns, and that is enough,** because you act on the board between turns. Polling every few seconds while connected is fine. Nothing needs to detect older views: every view in the chat is rebuilt at once, and each fetches the current board.
- **Don't rely on `onteardown`.** Writes from the view go through tools straight away. Nothing is buffered in the view.
- **Use `sendMessage` to tell the dedicated session about your actions.** Do not use `updateModelContext`.
- **Fonts.** Barlow can be inlined. The plan's font fallback work is not needed.
- **Theme.** The host is dark when the user's app is dark. A light-only view shows as a light card with the host's border.
- **No conversation id.** One desktop process serves every chat and is told nothing about which chat a call comes from. So the dedicated session is identified by its role, not by an id. Tools the dedicated session calls are treated as coming from "the dedicated session", whichever chat that is.
