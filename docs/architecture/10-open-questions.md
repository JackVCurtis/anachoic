# 10. Decisions and open questions

## Decisions

The product owner made these decisions while planning, on 2026-10-01.

| Decision | Choice | Where it applies |
|---|---|---|
| Host | Claude desktop chat, with the server installed as a `.mcpb` | [08](08-packaging-and-hosts.md) |
| Sessions | You open one dedicated session for Anachoic. Worker sessions run alongside it, and the board shows their work. | [01](01-overview.md#the-two-kinds-of-session), [05](05-sessions.md) |
| Reuse | Copy anachoic's UI subset rather than share a package | [02](02-stack-and-structure.md#copied-files), [07](07-ui-port.md) |
| Model | Anachoic-style tasks with chains of steps owned by an agent or by you | [03](03-domain-model.md) |
| Waking | ~~The view posts a message to the dedicated session after each of your actions.~~ **Changed on 2026-10-02:** the view posts no messages. They were noise in the chat and caused desktop's suggestion chips. | [06](06-tools-and-views.md#waking-the-dedicated-session) |
| Theme | Light only to begin with | [07](07-ui-port.md#theme) |
| Sign-off | A visible state and an action you take, placed in the board's Done section with no tab of its own | [07](07-ui-port.md#layout) |
| Agent waiting on you | A free-text question and a free-text answer | [03](03-domain-model.md#what-you-can-do-with-a-waiting-step) |
| Claiming | Workers claim agent steps. Neither you nor the dedicated session assigns them. **Changed on 2026-10-02:** a task may be assigned to one worker when it is created, and only that worker may then claim it. | [05](05-sessions.md#claiming), [11](11-assignment-and-outputs.md#assigning-a-task-to-a-worker) |
| Blocked steps | A worker may declare a step blocked. The board shows the worker, the step and the reason, and offers no action on it. You unblock it in the worker's session. | [12](12-blocked-steps.md) |
| Removing workers | A SessionEnd hook removes a worker at once. Liveness remains the safety net. Remove on the board and `leave_board` deregister by hand. | [13](13-ending-sessions.md) |
| Commands and history | A `board` prompt and a `history` prompt, and a History view of signed-off tasks. Signed-off tasks are no longer pruned. | [14](14-commands-and-history.md) |
| Output formats | An agent step may declare a pull request, ticket, document or link. Completing it requires an http(s) URL, which is passed to the next step: shown on its card if the step is the user's, or given as context if it is an agent's. User steps cannot declare one. This reverses the first version, which put formats on user steps. | [11](11-assignment-and-outputs.md#output-formats-on-agent-steps) |
| Wording | No second person. The board and Claude's texts say "user", and the section is called "Waiting on user". | [11](11-assignment-and-outputs.md#words-on-screen-and-for-claude) |
| Suggestion chips | Asked to remove them. Desktop drew them under the replies to the view's posted messages, so they go away with those messages. | [11](11-assignment-and-outputs.md#suggestion-chips) |
| Creating tasks | Any session may create tasks, even when the dedicated session is not open | [06](06-tools-and-views.md#every-session) |
| Fonts | Keep Barlow if it loads, and choose another if needed. It loads. | [07](07-ui-port.md#fonts) |
| Timeouts | Taken from the documentation, not measured | [05](05-sessions.md#waiting-for-your-answer) |

## Choices these documents make

These choices are made in these documents, without a decision from the product owner. Each holds until it is overturned.

| Choice | Why | Alternative |
|---|---|---|
| A completed agent step sends its task to the **front** of the queue ([03](03-domain-model.md#the-task-state-machine)) | Finishes work under way first, and lets the same worker continue with its context | Anachoic's rule: the back of the queue |
| A released task goes to the front of the queue | The same | The backlog, as anachoic's Cancel |
| Every desktop chat counts as the dedicated session ([05](05-sessions.md#identity)) | One desktop process serves every chat, with no way to tell them apart | None that the host allows |
| A session is dead 2 minutes after its last heartbeat ([05](05-sessions.md#liveness)) | It covers a restart of a server process, and is short enough that you rarely see stale work | A longer window |
| An agent step that is waiting cannot be marked done by you, only answered or parked ([03](03-domain-model.md#what-you-can-do-with-a-waiting-step)) | The worker is still in a `wait_for_answer` call and expects an answer | Anachoic's Mark done on an agent's step |
| The board shows the 10 most recently signed-off tasks | There is no Completed screen and no pagination | A Completed section with pages |

## Open questions

| Question | Holds until answered |
|---|---|
| Should the views follow the host's dark theme? | Light only. Revisit after phase 2. |
| Does the 240 s tool limit apply to local `.mcpb` servers? | Nothing in the dedicated session blocks, so it does not matter yet |
| Does `CLAUDE_CODE_SESSION_ID` survive `/clear` and `--resume`? | [05](05-sessions.md#liveness) handles a returning id. A changed id after `/clear` shows up as a new session, and the old one is released. Todo MCP-06 checks this. |
| What is desktop's `local-agent-mode` client? | It draws views, so it counts as the dedicated session. On 2026-10-02, before desktop was restarted after its update to 2.19675.0, the chat's calls came through it and no view was drawn. It most likely serves desktop's Code tab. A Code-tab session that uses the extension's tools therefore acts as "This chat"; Code-tab workers should use the `anachoic-worker` plugin's tools. |
| Can a view render in a desktop Code-tab session? | Not relied on. The Code tab is treated as text only. |
| Which client name and environment does a desktop Code-tab session give the server? | It is treated as any other client: a worker with a minted id, unless it reports `claude-code` with `CLAUDE_CODE_SESSION_ID`. The server logs each client's name and version, and the names (never the values) of the `CLAUDE`, `ANTHROPIC` and `MCP` variables it was given, on `initialized`, so the answer can be read from its log. |

## Verified by the spikes

The full record is in [../spikes/mcp-apps/notes.md](../spikes/mcp-apps/notes.md). In brief:

- **Desktop chat:**
  - Views render from a `.mcpb`.
  - Desktop offers inline and fullscreen display modes.
  - The view is 735 px wide.
  - Fonts load from `data:`.
  - `visibility: ["app"]` is honoured.
  - `sendMessage` works, and `updateModelContext` does not reach the model.
  - Views are rebuilt after every turn and after a restart, with their original result replayed.
- **The desktop process:**
  - One process serves every chat.
  - It runs on Node 24.21 with `node:sqlite`.
  - Its environment is empty.
- **Claude Code:**
  - It shows text only.
  - It passes `CLAUDE_CODE_SESSION_ID` and `CLAUDE_PROJECT_DIR` to the server process.
- **The installed extension:**
  - Desktop unpacks it into `~/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic/` ([08](08-packaging-and-hosts.md#worker-sessions)).
  - A worker added with `claude mcp add` can run `server/server.js` from there, and Claude Code reports it connected.
- **SQLite with WAL** is safe across processes, under the rules in [04](04-persistence.md#writing).
