# 06. Tools and views

## Kinds of tool

| Kind | Visible to | Declared with | Used by |
|---|---|---|---|
| **View tools** | The model and the view | `registerAppTool` with `_meta.ui.resourceUri` | The dedicated session, to show the board or a task. Workers get the same tool with a text result only. |
| **Model tools** | The model and the view | `registerAppTool` with no `resourceUri`, or `registerTool` | Every session, to change the board |
| **App-only tools** | The view only | `_meta.ui.visibility: ["app"]` | The view, for your actions and for polling. The model never sees them; desktop chat and the Code tab both honour this ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)). |

Every tool takes zod schemas for input and, where it returns structured content, for output.

## View tools

| Tool | Input | Text result | `structuredContent` |
|---|---|---|---|
| `show_board` | none | The board summary ([text results](#text-results)) | Board props |
| `open_task` | `task` (`T-012` or 12) | The task in full: every step with its status, session, question, answer, note, summary and links, and the last 10 events | Task props |

`show_board` is the dedicated session's usual first call. A worker that calls it gets the same text, which is enough to choose work.

## Model tools

### Every session

| Tool | Input | Does | Text result |
|---|---|---|---|
| `join_board` | `name` (optional, 1–40 characters) | Sets the calling session's display name | The session's id, kind and name, and for a minted id an instruction to pass it as `session` |
| `add_task` | `title`, `steps`: 1–20 of `{title, owner: "agent" \| "you", detail?}`, `queue` (default true) | Add, or Add to queue ([03](03-domain-model.md#the-task-state-machine)) | "Added T-012 to the queue at position 4" |
| `queue_task` | `task` | Queue a backlog task | "T-012 is in the queue at position 4" |
| `add_follow_up` | `task`, `steps` as above, `placement`: `first` or `last` | Follow-up | "T-012 is back in the queue at position 1 with 2 new steps" |

### Worker tools

The dedicated session can call these too. Each acts only on a step that the calling session claimed.

| Tool | Input | Does | Text result |
|---|---|---|---|
| `claim_step` | `task` (optional) | Claim ([05](05-sessions.md#claiming)) | The task, the step's number, title and detail, the chain so far with each completed step's summary, and what to call next |
| `update_step` | `task`, `note` (1–500 characters), `links` (optional) | Records a progress note, which shows on the board | "Noted on T-012 step 2" |
| `ask_you` | `task`, `question` (1–2,000 characters) | The step waits on you | For a worker: "Asked. Call wait_for_answer with task T-012 next." For the dedicated session: "Asked. Your answer will arrive as a message from the board." ([05](05-sessions.md#waiting-for-your-answer)) |
| `wait_for_answer` | `task` | Waits, as [05](05-sessions.md#waiting-for-your-answer) describes | Your answer, or "No answer yet…", or that the claim ended |
| `complete_step` | `task`, `summary` (1–2,000 characters), `links` (optional) | Complete the current step | What happened next: done, waiting on you, or back in the queue at position 1. When the next step is an agent's, it adds "Call claim_step with task T-012 to continue it." |

A worker's call on a step it no longer holds is refused with `not_yours`, `archived` or `wrong_status`. The refusal's sentence says why, so the model can stop.

## App-only tools

These are your actions, together with the view's reads. Each write returns the fresh board props, so the view redraws from the result without polling again.

| Tool | Input | Does |
|---|---|---|
| `get_board` | `sinceRevision` (optional) | Returns `{changed: false, revision}` when nothing changed since `sinceRevision`, else the board props |
| `get_task` | `task`, `sinceRevision` (optional) | Returns `{changed: false, revision}` when the board has not changed since `sinceRevision`, else the task props. The task view polls it as the board view polls `get_board`. |
| `add_task_from_view` | as `add_task` | Add or Add to queue, with `createdBy` set to `you` |
| `queue_task_from_view` | `task` | Queue |
| `reorder_queue` | `task`, `position` | Reorder |
| `move_to_backlog` | `task` | Park, for an active task. For a queued task, it moves the task back to the backlog. |
| `complete_my_step` | `task`, `note` (optional) | Mark your step done |
| `answer_question` | `task`, `answer` (1–4,000 characters) | Answer an agent's question |
| `sign_off` | `task` | Sign off |
| `add_follow_up_from_view` | as `add_follow_up` | Follow-up |
| `archive_task` | `task` | Archive |

## Results

Every tool result has:

- `content`: one text block, always. Claude Code reads only this, and so does desktop's model.
- `structuredContent`: the view's props, for view tools and app-only tools. Model tools that change the board return none, because the dedicated session calls `show_board` when it wants to see the board.
- `isError: true` and the refusal's sentence as the text, when the service refused.

### Text results

The text is for the model to read, so it is compact and plain. Claude Code reads up to 25,000 tokens per result. The board summary stays under 2,000 tokens with 100 tasks. For example:

```text
Board, revision 214
Your turn (2): T-012 step 2 "Choose the cache key" asks: "Redis or in-process?" (api-server) · T-009 step 3 "Review the PR" is yours
Working (3): T-014 step 1 "Draft the migration" (api-server, 12m) · …
Queue (4): 1. T-015 "Add retries" next: agent · 2. …
Backlog (6): T-003, T-004, T-007, T-008, T-010, T-011
To sign off (1): T-006 "Fix flaky login test"
Sessions: This chat · api-server (live) · web-client (live, idle) · docs (ended 4m ago, released T-013)
```

Every list line is present, with its count, even when it is empty: "Queue (0)". The Sessions line reads "Sessions: none" when no session is live and none ended in the last 10 minutes.

`open_task` returns the whole task. It is the one result that can be long, and it is still capped at 8,000 tokens by truncating the oldest events first.

### Errors

| Situation | Result |
|---|---|
| A domain refusal | `isError: true`, with text set to the refusal's sentence. In the view, a FlashMessage of the error kind ([07](07-ui-port.md#what-is-copied)). |
| Input that fails its schema | The SDK's validation error, which names the field |
| An unexpected exception | `isError: true` with "Something went wrong. Details are in the server log.", and the stack in the log ([08](08-packaging-and-hosts.md#logs)) |

## Props

The server computes every fact, and the view only formats. The prop types live in `shared/props.ts` and are imported by `server/props/` and by the view entries. The components declare their own prop types, and each entry maps between the two, as anachoic's pages do.

### Board props

```text
revision, now
yourTurn:   [{task, step (number, title, owner, question?, waitingSince), session?, steps (pips), canAct: {complete?, answer?, park}}]
working:    [{task, step (number, title, note?, runningSince), session, steps (pips)}]
queue:      [{task, position, nextOwner, steps (pips), canAct: {reorder, backlog}}]
backlog:    [{task, steps (pips), canAct: {queue, archive}}]
toSignOff:  [{task, finishedAt, agentSeconds, yourSeconds, linkCount, steps (pips), canAct: {signOff, followUp, archive}}]
signedOff:  the 10 most recent [{task, signedOffAt}]
sessions:   [{id, kind, name, live, holding?: {task, step, status}, endedAt?, released?: [task]}]
counts:     {yourTurn, working, queue, toSignOff}
```

`task` is always `{id, displayId, title}`. `steps (pips)` is anachoic's StepPips input: `{id, owner, status, title, sessionName}`.

### Task props

The task with every step in full, its events, its derived times, and `canAct` for each action that the task view offers ([views](#views)).

## Views

| View | Resource | Entry | Shows |
|---|---|---|---|
| Board | `ui://anachoic/board.html` | `view/entries/board/` | Your turn, Sessions, Working, Queue, Backlog and Done, in one column inside 735 px ([07](07-ui-port.md#layout)) |
| Task | `ui://anachoic/task.html` | `view/entries/task/` | One task's chain as a timeline, with each step's notes, question and answer, summary and links, and the event log. It asks for fullscreen when the host offers it, and offers to return inline. |

Each resource is served as `text/html;profile=mcp-app` with `_meta.ui.prefersBorder: true`. It declares no CSP domains, because everything is inline, fonts included ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)).

### How a view connects

1. The entry creates the `App` with `autoResize`, calls `connect()`, and reads the host context ([07](07-ui-port.md#the-host-bridge)).
2. It **ignores the tool result's props for drawing**. The host replays a view's original result whenever it rebuilds the view, and that result may be old. The entry draws nothing from it except the task id, in the task view.
3. It calls `get_board` (or `get_task`) and draws the result.
4. It starts polling ([polling](#polling)).

### How long a view lives

This was observed in desktop chat ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)):

| When | The view |
|---|---|
| Between turns, while you read and act | Is live. Its timers run, even off screen and without focus. |
| While Claude takes a turn | Goes quiet within about 15 s, without `onteardown` |
| When the turn ends | Is rebuilt as a new instance, with its original tool result replayed. Every view in the chat is rebuilt. |
| After the app restarts | Is rebuilt the same way, against a new server process |

Therefore:

- **Nothing that must survive is kept in the view.** Drafts in a form, such as an unsent answer, may be lost when a turn ends. Anything you submit is written by a tool at once.
- **No view needs to know it is old.** Every view in the chat is rebuilt together, and each one fetches the current board.
- **Don't rely on `onteardown`.**

### Polling

- **While connected.** The view calls `get_board(sinceRevision)` every 3 s, which is a read only. It redraws only when the result has changed.
- **Errors.** After an error it waits 10 s, then 30 s, and so on, and shows a quiet "Can't reach the board" line until a poll succeeds.
- **After your actions.** After a write the view draws from the write's result and resets the poll timer.
- **The resize loop.** A context change that carries only `containerDimensions` must not cause a redraw that changes the view's height. In the spike this fed an endless resize loop ([notes](../spikes/mcp-apps/notes.md#3-sdk-view-and-build-pipeline)).

### Waking the dedicated session

After each successful action you take in the view, the view calls `sendMessage` with one fixed sentence. This posts a user turn, and Claude replies ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)).

| Action | Sentence |
|---|---|
| Mark your step done | "I finished step 2 of T-012, “Review the PR”." with " Note: …" added when you wrote one |
| Answer a question | "I answered step 2 of T-012: “…”" |
| Add a task | "I added T-015, “Add retries”, to the queue." or "…to the backlog." |
| Reorder | "I moved T-015 to position 1 in the queue." |
| Queue | "I queued T-015 at position 4." |
| Move to backlog | "I moved T-015 to the backlog." For an active task, "I parked T-015 and moved it to the backlog." |
| Park your step or a question | "I parked T-012 and moved it to the backlog." |
| Sign off | "I signed off T-006." |
| Follow-up | "I added 2 follow-up steps to T-006." |
| Archive | "I archived T-008." |

The model's instructions say how to respond. For an action that needs nothing from Claude, it replies in one line. For an action that concerns work it holds or coordinates, it carries on.

Only your own actions post a message. Events from workers, including their questions, appear on the live board and never post one ([10](10-open-questions.md#decisions)).

`updateModelContext` is not used. In desktop chat it returns success but never reaches the model ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)).

## Server instructions

The server's `instructions` and each tool's description teach the model its role. The kind of client decides which text applies, using the same rule as [05](05-sessions.md#identity):

- **The dedicated session.** It shows the board when you ask about work. It plans work as tasks with chains, and gives each step an owner: you or an agent. It replies briefly to the view's messages. It never waits in a tool.
- **A worker.** It joins with a name that fits its project. It claims one step at a time, and reports progress with `update_step`. It asks you through `ask_you` and then `wait_for_answer`, never in its own chat. It completes the step with a summary and links, and continues the chain when `complete_step` says it can.

The full text of both is written in todo MCP-09 and kept in `server/instructions.ts`.

**Choosing the text.** The `initialize` request carries `clientInfo`, and the server answers it with `instructions`. The SDK takes one `instructions` text per server and has no public setter, so the server is built only once the client is known. On stdio, a wrapper around the transport (using the public `Transport` interface) reads the `initialize` request before any server sees it, then builds the server for that kind of client: its `instructions` are passed to the constructor, and each model-visible tool gets that kind's description through `RegisteredTool.update()` before connecting, so no `list_changed` is sent. With `--http`, the request body decides the same way. `tools/list` therefore differs between the two kinds (`server/client_texts.ts`, checked by integration tests). A connection that never sends `initialize`, such as a stateless `--http` request, gets the worker text.
