# 15. Rejecting a step

Added on 2026-10-05, at the product owner's request: "We need a way to reject a step when the agent provides the wrong output to the user. This should kick it back to the worker to retry the step along with a note from the user."

This document is the authority for rejecting a step. It changes one rule of [03](03-domain-model.md#the-step-state-machine): **Reject** is the only transition that takes a step out of `done`.

## The rule

**The user may reject the agent step whose output is in front of them,** with a note that says what was wrong.
- **Which step.** The agent step just before the user's waiting step, when the task is active and that step is done. Or the last step of a done task that is not signed off, when that step is an agent's.
- **The note is required,** 1 to 2,000 characters.
- **The step is reopened in place.** It keeps its number and goes from `done` back to `pending`. The chain is unchanged: nothing is appended.
- **The task goes to the front of the queue,** as after Release.
- **The same worker is preferred.** The task's `resumeWith` is set to the session that completed the rejected step, as for a hand-back ([11](11-assignment-and-outputs.md#handing-work-back-to-the-worker)), unless that session has ended. It is a preference, not a lock. An assignment still decides who may claim.

## Domain

| Field | On | Type | Meaning |
|---|---|---|---|
| rejection | Step | Text, 1 to 2,000 characters, or empty | Agent steps only. The user's note from the latest rejection. Set by Reject and cleared when the step is completed again. |

**Transition:**

| Transition | Who | Rejected step | Step after it | Task | What else changes |
|---|---|---|---|---|---|
| **Reject** | The user | `done` to `pending` | The user's waiting step, if any, goes to `pending`. Its waiting time is closed. | `active` or `done` to `queue`, at position 1 | `rejection` is set. `finishedAt` and `artifactUrl` are cleared on the step, and `finishedAt` on the task. `summary`, `links` and the time worked are kept. `resumeWith` is set as above. A `rejected` event records the note. |

**Complete the current step** clears `rejection`.

**Refusals:**
- **By a session:** `not_yours`, "Only the user can reject a step of T-012".
- **Nothing to reject:** `wrong_status`, "T-012 has no agent output to reject". This includes an active task whose current step is an agent's, and a done task whose last step is the user's.
- **Signed off:** `signed_off`. **Archived:** `archived`.
- **No note, or one too long:** `invalid`.

**Invariant:** a step has a `rejection` only while it is an agent step that is not `done`.

**New event kind:** `rejected`.

## Tools

| Tool | Input | Does | Text result |
|---|---|---|---|
| `reject_step` | `task`, `note` (1–2,000 characters) | Reject. For the board view only. | "Rejected step 2 of T-012. It is back in the queue at position 1 for api-server." |

**`claim_step`** names the rejection after the step's title: "The user rejected the last attempt: The PR targets the wrong branch." When the step kept a summary, the next line is "Last attempt: …".

**`wait_for_work`** offers a rejected task to the worker it prefers, like a hand-back, with this text: "The user rejected step 2 of T-012, “Open the PR”: The PR targets the wrong branch. Call claim_step with task T-012 to redo it."

**Worker instructions** add a rule: when `claim_step` says the user rejected the last attempt, redo the step so that it addresses the note.

## Board

| Where | What |
|---|---|
| Props | A Waiting on user item and a Done item carry `canAct.reject` |
| YourTurnCard, for a user step | A "Reject" button beside Mark done. It opens a form in place of the actions: "What was wrong" (required), "Send back" and "Cancel". |
| SignOffCard | The same "Reject" button and form, beside Follow up |
| Task view | The `rejected` event reads "Rejected step 2: …" |
