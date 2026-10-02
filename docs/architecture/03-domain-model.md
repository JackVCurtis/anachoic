# 03. Domain model

This document adapts anachoic `docs/architecture/app/04-domain-model.md`. Where the two differ, this one holds for this app. The rules live in `domain/` as pure functions. `store/` applies them inside transactions ([04](04-persistence.md)).

## Entities at a glance

```text
Board (one row) ──< Task ──< Step ──< Event
                              │
                              └── claimedBy ─ ─ ─> Session
Session ──< Event (may name the session that caused it)
```

There is one board. Every task belongs to it, and every session reads and writes it.

## Task

| Field | Type | Meaning |
|---|---|---|
| id | Whole number, shown as `T-012` | Issued in sequence and never reused. The display format is anachoic's `shared/task_id.ts`, copied unchanged: `T-` and the number padded to three digits. Tools accept `T-012`, `T-12` or `12`, because anachoic's `parseTaskId` reads any number of digits. |
| title | Text | Required, 1 to 200 characters |
| status | `backlog`, `queue`, `active` or `done` | |
| queuePosition | Whole number from 1, or empty | Set only while the task is in the queue |
| createdBy | Session id, or `you` | Who added it |
| createdAt | Instant | |
| finishedAt | Instant or empty | When the last step was completed |
| signedOffAt | Instant or empty | Empty until you sign off |
| archivedAt | Instant or empty | Set when the task is abandoned |
| assignedTo | Session id, or empty | The worker that alone may claim the task's agent steps ([11](11-assignment-and-outputs.md#assigning-a-task-to-a-worker)) |

**A task cannot be edited.** Its title is fixed when it is created. Its chain changes only by a follow-up. Its place can change: it can be queued, reordered, parked, signed off and archived.

## Step

| Field | Type | Meaning |
|---|---|---|
| id | Text, stable | Keys lists and links |
| number | Whole number from 1 | Position in the chain. **Never changes.** |
| owner | `agent` or `you` | Who does the step |
| title | Text | Required, 1 to 200 characters |
| detail | Text or empty | Instructions for whoever does the step, up to 4,000 characters |
| status | `pending`, `running`, `waiting` or `done` | |
| origin | `chain` or `follow_up` | Why the step exists |
| claimedBy | Session id, or empty | Agent steps only. The session doing the step. Set by a claim, and cleared when the step returns to `pending`. |
| question | Text or empty | Agent steps only. What the agent asked you. Set while the step waits. |
| answer | Text or empty | Your answer to the latest question, kept until the agent collects it ([05](05-sessions.md#waiting-for-your-answer)) |
| note | Text or empty | The latest progress note from the agent, or your note when you mark your step done |
| summary | Text or empty | What the agent reported when it completed the step |
| links | List of `{label, url}`, up to 10 | Pull requests, files or pages the step produced. Recorded on completion or with a note. |
| outputFormat | `pull_request`, `ticket`, `document`, `link`, or empty | Steps you own only. The artifact that completing the step requires ([11](11-assignment-and-outputs.md#output-formats-on-your-steps)). |
| artifactUrl | URL, or empty | Set when a step with an output format is marked done |
| startedAt, runningSince, waitingSince, finishedAt | Instant or empty | |
| elapsedSeconds | Whole number | Closed intervals of work. For an agent step, time `running`. For your step, time `waiting` on you. |
| waitedSeconds | Whole number | Agent steps. Closed intervals spent `waiting` on you. |

## Session

| Field | Type | Meaning |
|---|---|---|
| id | Text | `dedicated`, or a Claude Code session id, or a minted id ([05](05-sessions.md#identity)) |
| kind | `dedicated` or `worker` | |
| name | Text | A display name. For a worker, the last segment of its project directory until `join_board` sets one. For the dedicated session, "This chat". |
| projectDir | Text or empty | Workers. From `CLAUDE_PROJECT_DIR`. |
| pid | Whole number | The server process that last reported for this session |
| firstSeenAt, lastSeenAt | Instant | `lastSeenAt` is refreshed by the server process's heartbeat ([05](05-sessions.md#liveness)) |
| endedAt | Instant or empty | Set when the session is found dead and its claims are released |

## Event

Every change to a task appends an event: `{taskId, stepId?, sessionId or "you", kind, detail, at}`. Its kinds are:

- added, queued, reordered, claimed, started, noted, asked, answered, completed, parked, released, signed_off, followed_up and archived

The task view shows the events ([06](06-tools-and-views.md#views)), and they are the board's audit trail.

## The current step

As in anachoic: **the current step is the first step that is not done. If every step is done, it is the last step.**

## A chain is fixed

Nothing adds a step to a chain except a follow-up, and a step's number never changes. An agent that cannot go on asks you a question and waits where it is. It never inserts a step.

## Invariants

[11](11-assignment-and-outputs.md) adds two invariants: one for assignment and one for artifacts.

These hold after every transaction for every task that is not archived. An archived task keeps the status it had, but is held only to invariant 8. A test checks them after every operation in the domain's test suite.

1. At most one step of a task is `running` or `waiting`, and it is the current step.
2. Every step before the current step is `done`. Every step after it is `pending`.
3. A task is `active` exactly when its current step is `running` or `waiting`.
4. A task is `backlog` or `queue` only when its current step is `pending`.
5. A task is `done` exactly when every step is `done`.
6. An agent step has `claimedBy` exactly when it is `running` or `waiting`.
7. A step has a `question` only while it is an agent step that is `waiting`.
8. `signedOffAt` is set only on a task that is `done`.
9. A task has a queue position exactly when it is in the queue. Positions run from 1 to *n*, with no gap and no repeat.
10. A task in the queue has an agent step as its current step. Your steps never wait in the queue.

## The task state machine

| Transition | Who | From | To | What else changes |
|---|---|---|---|---|
| **Add** | Any session, or you | nothing | `backlog` | Steps are created, all `pending` |
| **Add to queue** | Any session, or you | nothing | `queue`, or `active` if the first step is yours | The task takes the last queue position. If the first step is yours, it starts at once (see Start). |
| **Queue** | You, or any session | `backlog` | `queue`, or `active` if the current step is yours | As above |
| **Unqueue** | You | `queue` | `backlog` | The task gives up its queue position, and the queue closes up |
| **Reorder** | You | `queue` | `queue` | The task takes the position it was dropped at, and the others close up or make room |
| **Claim** | A worker, or the dedicated session | `queue` | `active` | The current agent step becomes `running` with `claimedBy` set. The queue closes up behind the task. |
| **Start, for your step** | Automatic | `queue` or `backlog` | `active` | Your current step becomes `waiting`, with `waitingSince` set. It never passes through the queue. |
| **Complete the current step** | The claiming session for an agent step, or you for your step | `active` | see below | The step becomes `done` |
| **Park** | You | `active` | `backlog` | The current step becomes `pending`. A claim is cleared. |
| **Release** | Automatic, when the claiming session is found dead ([05](05-sessions.md#liveness)) | `active` | `queue`, at position 1 | The current agent step becomes `pending`. `claimedBy` and any unanswered question are cleared. |
| **Sign off** | You | `done` | `done` | `signedOffAt` is set |
| **Follow-up** | You, or any session | `done`, not signed off | `queue`, at the first or last position as asked, or `active` if the first new step is yours | New steps are appended with origin `follow_up`. `finishedAt` is cleared. |
| **Archive** | You | any but signed off | unchanged | `archivedAt` is set and the task leaves every list. Its queue position, any claim and any unanswered question are cleared. The worker is told on its next call. |

**Complete the current step** has three outcomes, decided by the next step in the chain:

| Next step | Task becomes | Next step becomes |
|---|---|---|
| There is none | `done`, with `finishedAt` set | |
| An agent step | `queue`, at **position 1** | stays `pending` |
| Your step | stays `active` | `waiting`, with `waitingSince` set |

**A departure from anachoic.** In anachoic, a task whose next step is an agent's goes to the **back** of the queue. Here it goes to the **front**. Work already under way is finished before new work starts, and the worker that completed the step can claim the next one at once, with its context intact, because `complete_step` offers it ([06](06-tools-and-views.md#worker-tools)). This is listed in [10](10-open-questions.md).

```text
                 Add               Queue                Claim
   (nothing) ────────► backlog ──────────► queue ────────────────► active
       │                  ▲                 ▲  ▲                    │
       │ Add to queue     │ Park            │  │ Complete, next     │ Complete, next is yours
       └──────────────────┼─────────────────┘  │ is agent (front);  │ (stays active)
                          │                    │ Release (front)    │
                          └────────────────────┼────────────────────┤
                                               │ Follow-up          │ Complete, no next step
                                               │                    ▼
                                               └──────────────── done ──► Sign off
```

## The step state machine

```text
   Your step                           An agent step

   pending                             pending ◄───────────── Park, Release
     │  ▲                                │                         │
     │  │ Park                     Claim │                         │
     ▼  │                                ▼                         │
   waiting                             running ──── ask_you ────► waiting
     │                                   │   ▲                      │
     │ Mark done                         │   └──── you answer ──────┘
     ▼                                   │ complete_step
   done                                  ▼
                                        done
```

| From | To | When |
|---|---|---|
| `pending` | `running` | A session claims the agent step |
| `pending` | `waiting` | Your step becomes current and the task is active |
| `running` | `waiting` | The claiming session calls `ask_you` with a question |
| `waiting` | `running` | Agent steps only. You answer the question. |
| `running` | `done` | The claiming session calls `complete_step` |
| `waiting` | `done` | Your step only: you mark it done. An agent step that is waiting cannot be completed until it is answered. |
| `running`, `waiting` | `pending` | Park (you) or Release (a dead session) |

A step that is `done` never changes again.

### What you can do with a waiting step

| The waiting step is | Primary | Secondary |
|---|---|---|
| Your step | **Mark done**, with an optional note. The chain moves on. | **Park**: the task goes to Backlog |
| An agent's question | **Answer**, in free text. The step is `running` again, and the agent receives the answer. | **Park**: the claim is cleared and the task goes to Backlog. The worker is told on its next call. |

Anachoic's Approve, Deny and Unblock command do not exist here. Every agent question is answered in words.

### Time on a step

As in anachoic. For a step that is running or waiting now, the props carry the instant the open interval began, and the view adds the difference to show a ticking figure.

## Derived facts

The server computes these and sends them in the props ([06](06-tools-and-views.md#board-props)). They are never stored.

| Fact | Rule |
|---|---|
| Which list a task is in | See below |
| Current step | The first step that is not done, else the last |
| Claimed by | The current step's session, with its name and whether it is live |
| Can act | For each action the view offers, whether the domain would accept it now. The view shows only actions that can act. |
| Agent seconds, your seconds | Sums over the steps, as anachoic |
| Counts | Tasks in Your turn, in the queue, active with a running step, and awaiting sign-off |
| Session activity | For each live session: the task and step it holds, if any, and whether that step is running or waiting on you |

### List membership

| List | Rule |
|---|---|
| Your turn | `active`, and the current step is `waiting`: your step, or an agent's question |
| Working | `active`, and the current step is `running` |
| Queue | `queue` |
| Backlog | `backlog` |
| Done: to sign off | `done`, and `signedOffAt` is empty |
| Done: signed off | `done`, and `signedOffAt` is set. The board shows the 10 most recent. |
| None | `archivedAt` is set |

Every task that is not archived is in exactly one list. The Sessions section is not a list of tasks. It is the live sessions, each showing the step it holds.

## Refusals

Every service checks its preconditions and refuses with a `Refusal`: a code and a sentence, written by the rules in [07](07-ui-port.md#content). A refusal changes nothing. [06](06-tools-and-views.md#errors) describes how a tool returns one.

| Code | When | Sentence |
|---|---|---|
| `not_found` | No such task or step | "T-012 does not exist" |
| `not_current` | The step is not the task's current step | "Step 3 of T-012 is not the current step" |
| `wrong_status` | The transition does not start from this status | "T-012 is in the backlog, not the queue" |
| `not_yours` | A session acts on a step another session claimed, or on your step | "Step 2 of T-012 is claimed by api-server" |
| `nothing_to_claim` | `claim_step` finds no queued task whose current step is an agent's | "Nothing in the queue needs an agent" |
| `unanswered` | `complete_step` while the step waits on you | "Step 2 of T-012 is waiting for your answer" |
| `signed_off` | Archive or follow-up on a signed-off task | "T-012 is signed off" |
| `archived` | Any action on an archived task | "T-012 was archived" |
| `invalid` | Input outside its limits | Names the field and its limit |
| `busy` | The database stayed locked past the timeout ([04](04-persistence.md#writing)) | "The board is busy. Try again." |
| `unreadable` | The database cannot be opened or fails its check ([04](04-persistence.md#recovery)) | "The board's database at <path> can't be read" |
