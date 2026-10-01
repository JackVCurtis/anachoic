# 05. Sessions

A session is a Claude conversation that uses the server. The board records each one so that it can show who is doing what, release work that a dead session left behind, and refuse a session that acts on another session's step.

## Identity

The server learns who it is talking to from its process and its client. It never relies on the model to say. These facts were observed in the spike ([notes](../spikes/mcp-apps/notes.md#11-and-14-what-claude-code-tells-the-server)):

| Client | What the server process sees | Session |
|---|---|---|
| Claude Code (`clientInfo.name` is `claude-code`) | One process per session. The environment carries `CLAUDE_CODE_SESSION_ID` and `CLAUDE_PROJECT_DIR`. | A **worker**, with that session id as its id. Its name defaults to the last segment of the project directory. |
| Claude desktop chat (`clientInfo.name` is `claude-ai`, which advertises `io.modelcontextprotocol/ui`) | One process for every chat, with an empty environment and no conversation id | The **dedicated session**, with id `dedicated` |
| Any other client, or Claude Code without the variable | No usable id | A worker identified by a minted id. `join_board` returns it, and the model passes it as `session` on every later call. |

**Consequences.**
- **Every desktop chat is the dedicated session.** One desktop process serves every chat, and nothing in a call says which chat it came from. So every desktop chat that uses the server counts as the dedicated session. You are expected to keep one chat for Anachoic ([01](01-overview.md#the-two-kinds-of-session)). A second chat that calls the tools acts as the same session.
- **The dedicated session can also do work.** It can claim an agent step like a worker. The board shows its claims under "This chat".
- **Desktop's other processes are ignored.** Desktop also starts a short-lived capability check and a `local-agent-mode` client ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)). Neither calls tools, and neither is recorded as a session until it does.

A session row is created, or touched, on the first tool call from that identity. `join_board(name)` only sets the display name, and returns the session's id and kind.

## Liveness

A session is **live** while its server process is alive. A Claude Code session keeps its process for exactly as long as the session runs, so the process's own heartbeat measures the session.

- **Heartbeat.** Every server process updates `last_seen_at` and `pid` on the session rows it serves, every 30 s, in one short transaction. The desktop process does this for `dedicated`. A worker's process does it for its one session.
- **Dead.** A session is dead when `last_seen_at` is more than 2 minutes old.
- **Release.** Any process that writes checks for dead sessions in the same transaction. For each dead session it:
  - sets `ended_at`
  - releases every step the session had claimed ([03](03-domain-model.md#the-task-state-machine), Release): the step returns to `pending`, and the task goes to the front of the queue
  - records a `released` event
- **A session id that comes back.** If `claude --resume` brings back a dead session's id, the next tool call clears `ended_at`. The released claims stay released.
- **Exit.** A process that exits cleanly, on SIGINT, SIGTERM or the end of stdin, stops its heartbeat but does not end its session. Claude Code may restart a server within a session, and the 2-minute window covers that.

The board shows each live session, with its name, kind and current step. It also lists recently ended sessions for 10 minutes, so you can see that work was released.

## Claiming

Only the claiming session may report on, ask about, or complete an agent step.

- **`claim_step()`** claims the current agent step of the task at queue position 1. It is the usual call.
- **`claim_step(task)`** claims that queued task's current agent step, wherever it sits in the queue. A worker uses it to continue a chain it has just advanced ([03](03-domain-model.md#the-task-state-machine)), or when you or the dedicated session tell it which task to take.
- **One transaction.** A claim is one transaction, so two workers can never claim the same step. The loser gets `nothing_to_claim`, or `wrong_status` when it named a task.
- **More than one claim.** A session may hold several claims at once. The tool descriptions ask a worker to hold one at a time ([06](06-tools-and-views.md#server-instructions)).

## Waiting for your answer

The server cannot push to a worker. A worker that asks a question therefore waits for the answer inside a tool call. The limits come from Claude Code's documentation ([spike notes](../spikes/mcp-apps/notes.md#12-and-13-tool-call-timeouts-from-the-documentation)): a call is aborted after 30 minutes with no response and no progress, and after about 28 hours on the wall clock.

1. The worker calls **`ask_you(task, question)`**. The step becomes `waiting`, the question is stored, and the task appears in Your turn on the board. The tool returns at once and tells the model to call `wait_for_answer` next.
2. The worker calls **`wait_for_answer(task)`**. The call:
   - polls the database every 2 s, with a read only
   - sends a progress notification every 60 s, using the request's `progressToken`, which keeps the idle timeout from tripping
   - returns as soon as `answer` is set
   - otherwise returns after 20 minutes with "No answer yet. Call wait_for_answer again to keep waiting."
3. **You answer** in the view. In the same transaction the step becomes `running`, `answer` is stored, and an `answered` event is recorded. The worker's next poll returns the answer.
4. **Collecting the answer clears it.** The next `ask_you` replaces the question.

**What else ends the wait:**
- **Park.** If you park the task while the worker waits, `wait_for_answer` returns "T-012 was parked. Stop work on it." The same happens with any other end to the claim.
- **Cancellation.** If the worker's call is cancelled, the server stops polling. The question stays, and the worker can call `wait_for_answer` again later.

**The dedicated session never waits like this.** Desktop allows 240 s per tool call. The dedicated session needs no waiting tool anyway. When it asks you a question on a step it claimed, `ask_you` tells it that the answer will arrive as a message. When you answer in the view, the view posts the answer to it ([06](06-tools-and-views.md#waking-the-dedicated-session)). Its own next call that touches the step then sees the step `running`, with the answer recorded. A call to `wait_for_answer` from the dedicated session is refused with `invalid`, with the sentence "The answer arrives as a message in this chat".
