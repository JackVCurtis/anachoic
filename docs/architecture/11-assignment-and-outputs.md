# 11. Assignment and outputs

Two features added after phase 2, at the product owner's request on 2026-10-02:

- **Assigning a task to a worker** when the task is created.
- **An output format** on a step you own, with a link to the artifact required when you complete it.

This document is the authority for both. The other documents point here where the features touch them.

## Assigning a task to a worker

### The rule

**A task may be assigned to one worker when it is created.**
- **Exclusive.** While the task is assigned, only that worker may claim its agent steps. No other session may, and that includes the dedicated session.
- **Unassigned is the default.** An unassigned task works as before: any session may claim it.

### Who can be assigned

- **Live workers only.** A task can be assigned only to a worker session that is live ([05](05-sessions.md#liveness)). Assigning it to the dedicated session, to an ended session or to an unknown one is refused.
- **Fixed once created.** Like everything else about a task, the assignment cannot be changed after the task is added ([03](03-domain-model.md#task)). It ends in only two ways: the worker's session ends, or the task is archived.
- **Follow-ups.** A follow-up keeps the task's assignment, if it still has one.

### Domain

| Field | On | Type | Meaning |
|---|---|---|---|
| assignedTo | Task | Session id, or empty | The worker that alone may claim the task's agent steps |

**Transitions:**

| Transition | Rule |
|---|---|
| **Add, Add to queue** | Takes an optional worker. Refused with `invalid` when that session is not a live worker: "api-server is not a live worker". An `assigned` event is recorded. |
| **Claim** | Refused with `not_yours` when the task is assigned to another session: "T-012 is assigned to api-server". |
| **`claim_step()` with no task** | Takes the first queued task whose current step is an agent's and that is assigned to the caller. Failing that, it takes the first such task that is unassigned. It never takes a task assigned to someone else. When nothing qualifies, it refuses with `nothing_to_claim`. |
| **Release** (the worker's session has ended) | As before, every step the session had claimed is released ([05](05-sessions.md#liveness)). In the same transaction, `assignedTo` is cleared on every task assigned to it, and an `unassigned` event is recorded for each. |
| **Archive** | Clears `assignedTo` |

**New event kinds:** `assigned` and `unassigned`.

**A new invariant:** a task's `assignedTo` names a worker session whose `endedAt` is empty.

### Waiting for work

A worker can't be woken ([05](05-sessions.md#waiting-for-your-answer)). An idle worker therefore waits for work inside a tool, the same way it waits for your answers.

- **`wait_for_work()`** returns as soon as the queue holds a task the caller may claim: one assigned to it, or one that is unassigned. It names the task, and assigned tasks come first. For example: "T-012 is assigned to you. Call claim_step with task T-012."
- **The wait itself:**
  - It polls with reads every 2 s.
  - It sends a progress notification every 60 s.
  - It returns after 20 minutes with "No work yet. Call wait_for_work again to keep waiting."

  These are the same timings as `wait_for_answer`, and tests can shorten them in the same way.
- **The dedicated session never waits.** Its call is refused with `invalid`.

The worker instructions add a rule: a worker with nothing to do calls `wait_for_work`, and keeps calling it until it returns work.

### Tools

| Tool | Change |
|---|---|
| `add_task` | New optional `assign_to`: a session's id or its name, as the board shows it |
| `add_task_from_view` | New optional `assignTo`: a session id |
| `wait_for_work` | New worker tool, as above |
| `claim_step` | Follows the rules above |

### Board

| Where | What |
|---|---|
| Props | A task carries `assignedTo: {id, name} \| null` wherever the board lists it. The board props gain `workers: [{id, name}]`, the live workers you can assign to. |
| TaskEntry | A field "Worker", a native select with "Any worker" first and then every live worker by name. It is shown only when at least one worker is live. |
| Queue, Backlog and Working cards | "Assigned to api-server" in the meta line, when the task is assigned |
| Text summary | "→ api-server" after an assigned task |

## Handing work back to the worker

Added on 2026-10-02, at the product owner's request: "I also want the agent to receive a message when I mark my steps complete."

### The problem

When a worker completes an agent step and the next step is yours, the worker's turn ends. When you later mark your step done, the task goes to the front of the queue, and the dedicated chat is told. The worker that handed the task to you is told nothing, because the server cannot push to it ([05](05-sessions.md#waiting-for-your-answer)).

### The rule

**The worker waits for the hand-back in `wait_for_work`.**
- **When the next step is yours,** `complete_step` returns: "Step 3 of T-012 is the person's. Call wait_for_work to be told when this task needs an agent again."
- **The worker instructions** make this a rule: after handing a step to the person, call `wait_for_work` and keep calling it.

**The task remembers who to hand back to.**
- **Setting it.** When an agent step is completed and the next step is yours, the task records `resumeWith`, the session that completed the agent step.
- **Clearing it.** It is cleared when the task's next agent step is claimed, by anyone, or released, or archived, or when that session ends.

**`wait_for_work` hands it back first.** It returns, in this order of preference:
1. a queued task assigned to the caller
2. a queued task whose `resumeWith` is the caller
3. an unassigned queued task

For the second, the text says what you did: "The person finished step 3 of T-012, “Review the PR”: https://… Note: Looks good. Call claim_step with task T-012 to continue it." The link and the note appear only when present.

**A preference, not a lock.** `resumeWith` does not reserve the task. Any worker may still claim it with `claim_step`, as before. But `wait_for_work` does not offer a task handed back to another worker while that worker is live, so that two waiting workers are never both told of the same task. An assignment, where there is one, still decides who may claim ([assigning a task to a worker](#assigning-a-task-to-a-worker)).

### Domain

| Field | On | Type | Meaning |
|---|---|---|---|
| resumeWith | Task | Session id, or empty | The worker that handed the task to you and should get it back |

There is a new invariant: `resumeWith` is set only on a task whose current step is yours and waiting, or on a queued task whose current step is an agent's.

## Output formats on agent steps

Changed on 2026-10-02, at the product owner's request. The first version put the format on user steps, which was the wrong way round.

### The rule

**An agent step may declare an output format** when it is created, in a task or in a follow-up. The format is set by whoever adds the step: the user on the board, or a session through `add_task`.
- **Completing it.** `complete_step` on that step requires an `artifact_url`: an absolute http(s) URL, at most 2,000 characters.
- **The next step receives it,** in a way that depends on who does that step:
  - **A user step:** its card in Waiting on user shows the link: "Pull request from step 1 ↗".
  - **An agent step:** the worker that claims it reads the link in `claim_step`'s text, as context: "Input from step 1: Pull request https://…". The text still lists every earlier step's summary and artifact.
- **Afterwards.** The link also stays on the task's other cards and in the task view.

**User steps cannot declare a format.** Declaring one on a user step is refused with `invalid`: "Only agent steps can declare an output format".

### Formats

| Value | Shown as |
|---|---|
| `pull_request` | Pull request |
| `ticket` | Ticket |
| `document` | Document |
| `link` | Link |

The URL must parse as an absolute `http:` or `https:` URL. The format is not checked against the URL: a pull request may live on any host.

### Domain

| Field | On | Type | Meaning |
|---|---|---|---|
| outputFormat | Step | One of the four values, or empty | Agent steps only. Set when the step is created. |
| artifactUrl | Step | URL, or empty | Set when a step with an output format is completed |

**Transitions:**
- **`complete_step` on a step with an output format** is refused with `invalid` unless a valid URL is given. Without a URL: "Step 1 of T-012 needs a pull request link (artifact_url)". With an invalid one: "That is not a web address".
- **A step with no output format** works as before. A URL given anyway is ignored.
- **Existing rows** that a user step was given under the first version keep their values. They are only shown, never required.

**Invariant:** `artifactUrl` is set only on a step that is `done` and has an `outputFormat`.

### Tools

| Tool | Change |
|---|---|
| `add_task`, `add_follow_up` and their view versions | Each step may carry `output_format` (`outputFormat` in the view's tools). Only agent steps may. |
| `complete_step` | New `artifact_url`, required when the step has an output format |
| `complete_my_step` | Loses `artifactUrl` |
| `claim_step` | Its text names the input artifact, the previous step's, first, then each earlier step's summary and artifact |
| Tool descriptions and worker instructions | When a claimed step names an output format, finish it with `complete_step` and an `artifact_url` of that kind |

### Board

| Where | What |
|---|---|
| Props | Every step carries `outputFormat` and `artifactUrl` when set. A task's cards carry `artifacts: [{stepNumber, format, url}]`. A Waiting on user item for a user step carries `input: {stepNumber, format, url}` or null: the previous step's artifact. |
| TaskEntry and the follow-up composer | An **agent** step has the "Output" select: "None", "Pull request", "Ticket", "Document", "Link". User steps do not show it. |
| Waiting on user card, for a user step | When the previous step produced an artifact, the card shows it above Mark done: "Pull request from step 1 ↗", opened through the host. Mark done has no URL field. |
| Working, Queue, Backlog and SignOffCard | One line of artifact links, as before: "Pull request · step 1 ↗" |
| Working card | For an agent step with a format, the card says what it will produce: "Produces a pull request" |

## Words on screen and for Claude

Changed on 2026-10-02, at the product owner's request: **no second person.** The board and the texts Claude reads say "user".
- **On screen,** the section "Your turn" is called **Waiting on user**. "Nothing waiting on you" becomes "Nothing waiting on the user". The owner chip reads "User". Every other on-screen string written in the second person is rewritten the same way.
- **For Claude,** every tool description, tool result, refusal sentence and instruction that said "the person" or "you" for the user now says "the user".
- **In tool input,** a step's owner is `"agent"` or `"user"`. `"you"` is still accepted as an alias, and outputs say `"user"`.
- **What stays.** Code identifiers and database values keep `you`.

## Suggestion chips

You asked for the suggestion chips in the board's chat to be removed. Desktop draws them under Claude's replies, and most of those replies were answers to the messages the view posted after each of your actions. The view no longer posts messages ([06](06-tools-and-views.md#waking-the-dedicated-session)), so the chips go with them. Chips that desktop draws under replies to your own messages are outside the server's control.
