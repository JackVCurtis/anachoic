# 01. Overview

The Anachoic MCP App puts Anachoic's board inside Claude. It is one MCP server. Its tools return views, which are HTML pages that Claude desktop chat draws inline in the conversation. Through those views you see and steer the work of every Claude session that uses the server.

It replaces the tmux harness in the sibling `anachoic/` repo. Anachoic's design (its tokens, its components, and its board of tasks with handoff chains) carries over. Its orchestrator does not.

## The two kinds of session

| Session | Where it runs | What it sees | What it is for |
|---|---|---|---|
| **The dedicated session** | One Claude desktop chat that you open for Anachoic and keep | Views, drawn inline | You talk to Anachoic here. You see the board, act on it, and ask Claude to plan or coordinate. |
| **Worker sessions** | Claude Code sessions, any number at once | Text results only, because Claude Code does not draw views | They do the work. A worker claims an agent step, reports progress, asks you questions, and completes the step. |

Every session runs the same server, and all of them share one board, stored in one SQLite database. The board in the dedicated session therefore shows what every worker is doing.

```text
 Dedicated session (desktop chat)               Worker sessions (Claude Code)
 views drawn inline                             text results only
        │ stdio, one process for every chat            │ stdio, one process per session
        ▼                                              ▼
   server process ─────────── board.sqlite (WAL) ──── server process  (×N)
```

The two kinds of session are told apart by their client, as [05](05-sessions.md) describes. Neither the model nor you has to say which is which.

## Vocabulary

These words mean what they mean in anachoic, except where the third column says otherwise.

| Word | Meaning | Compared with anachoic |
|---|---|---|
| Task | A unit of work with an id like T-012, a title and a handoff chain. It has no priority. | No repo, branch, workflow or custom prompt |
| Step | One link in a task's chain | Steps have no model, timeout, retries or declared output |
| Owner | Who does a step: an agent or you. The interface calls the human "you". | The same |
| Session | A Claude session known to the board: the dedicated session or a worker | New. It replaces anachoic's slots. |
| Claim | A worker takes an agent step and becomes its session | New. It replaces the scheduler. |
| Task status | backlog, queue, active, done | The same |
| Step status | pending, running, waiting, done | The same. An agent step waits only because it asked you a question. |
| Question | The free text an agent step asks you when it waits. You answer in free text. | Replaces anachoic's six wait reasons, approval, deny and the Unblock command |
| Your turn | Active tasks whose current step is waiting on you | The same |
| Queue | First in, first out. You reorder it by dragging. Workers claim from the front. | The same |
| Sign off | You confirm that a done task is finished | The same, shown in the board's Done section rather than on its own screen |
| Follow-up | Steps appended to a done, unsigned task, which sends it back to the queue | The same, without workflows |
| Board | The single view of every list | Board, Sign off and Completed become one view |

### What is dropped

Anachoic features with no counterpart here:

- the scheduler and the cap
- slots
- tmux and the terminal bridge
- runs and transcripts
- workflows and the workflow agent
- repos and branches
- the CLI
- the HTTP API
- the AdonisJS application

Claude Code itself now runs the agent, and the board only records what each session reports.

## The seam between server and view

This keeps anachoic's seam. The server computes domain facts, and the view computes presentation.

- **The server owns the facts.** It decides which list a task is in, its current step, which session claimed it, whether that session is live, the counts, and whether an action is allowed. It sends these as the view's props, in a tool result's `structuredContent` or a `get_board` result.
- **The view owns presentation.** It formats plurals, durations and labels with small pure helpers copied from anachoic ([07](07-ui-port.md)).
- **Components are presentational.** They receive data and callbacks. They never call a tool and never know the host. Each view entry connects to the host, fetches the board, and turns component callbacks into app-only tool calls ([06](06-tools-and-views.md)).
- **The view keeps nothing that must survive.** The host rebuilds every view after every turn and replays its original tool result ([06](06-tools-and-views.md#how-long-a-view-lives)). The board on screen always comes from a fresh `get_board`.

## Reading order

| File | Holds |
|---|---|
| [02-stack-and-structure.md](02-stack-and-structure.md) | Versions, folders, the two builds, and the rule for copied files |
| [03-domain-model.md](03-domain-model.md) | Board, task, step and session. The state machines, derived facts and refusals. |
| [04-persistence.md](04-persistence.md) | The data directory, SQLite across processes, migrations and retention |
| [05-sessions.md](05-sessions.md) | How a session is identified, liveness, claiming, and waiting for your answer |
| [06-tools-and-views.md](06-tools-and-views.md) | Every tool, the views, results, polling and waking |
| [07-ui-port.md](07-ui-port.md) | What is copied from anachoic's UI, and where this app departs from it |
| [08-packaging-and-hosts.md](08-packaging-and-hosts.md) | The `.mcpb`, installing for worker sessions, and the development loop |
| [09-testing-and-build-order.md](09-testing-and-build-order.md) | Test suites and the phases |
| [10-open-questions.md](10-open-questions.md) | Decisions, open questions, and what the spikes verified |
| [11-assignment-and-outputs.md](11-assignment-and-outputs.md) | Assigning a task to a worker, and output formats with artifact links on your steps |
| [12-blocked-steps.md](12-blocked-steps.md) | A worker declaring a step blocked, shown on the board and unblocked in the worker's session |

The evidence behind the host behaviour these documents rely on is in [../spikes/mcp-apps/notes.md](../spikes/mcp-apps/notes.md).
