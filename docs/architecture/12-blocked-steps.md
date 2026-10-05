# 12. Blocked steps

Added on 2026-10-02, at the product owner's request. A worker can declare that it cannot complete a step: the step is **blocked**. You are shown which worker is blocked, on which step, and why. You unblock it **in the worker's session**, not on the board.

This document is the authority for blocked steps. It is built after the work in [11](11-assignment-and-outputs.md) and before phase 3.

## How it differs from a question

| | A question (`ask_you`) | A block (`block_step`) |
|---|---|---|
| What the worker needs | An answer in words | Something done, or decided, with the worker in its own session |
| Where you respond | On the board | In the worker's session, a Claude Code terminal |
| What the worker does meanwhile | Waits in `wait_for_answer` | Ends its turn, and waits for you to speak to it in its session |
| What ends it | Your answer on the board | The worker calls `unblock_step` |

## Domain

A blocked step is an agent step that is `waiting` because its worker blocked it. No new status is added.

| Field | On | Type | Meaning |
|---|---|---|---|
| blockedReason | Step | Text, 1 to 250 characters ([16](16-question-forms.md)), or empty | Agent steps only. Why the worker cannot go on. Set while the step is blocked. |
| blockedAt | Step | Instant, or empty | When it was blocked |

**Transitions:**

| Transition | Who | Step | Task | What else changes |
|---|---|---|---|---|
| **Block** | The claiming session | `running` to `waiting` | Stays `active` | `blockedReason` and `blockedAt` are set, and a `blocked` event records the reason |
| **Unblock** | The claiming session | `waiting` to `running` | Stays `active` | `blockedReason` and `blockedAt` are cleared, and an `unblocked` event records the worker's optional note |
| **Release, Park, Archive** | As before | As before | As before | `blockedReason` and `blockedAt` are cleared |

**Refusals**, all with `wrong_status`:
- **Blocking a step that is not `running`:** "Step 2 of T-012 is not running". This includes a step already blocked, or waiting on a question.
- **`unblock_step` on a step that is not blocked:** "Step 2 of T-012 is not blocked".
- **`complete_step`, `ask_you` or `update_step` on a blocked step:** "Step 2 of T-012 is blocked. Call unblock_step first."
- **`answer_question` on a blocked step**, which has no question: the same sentence. The board offers no answer field on a blocked card anyway.

**Invariants:**
- A step has a `blockedReason` only while it is an agent step that is `waiting`.
- A waiting agent step has exactly one of `form` and `blockedReason`.

**List membership.** A blocked step is waiting on you, so its task is in **Your turn** ([03](03-domain-model.md#list-membership)), and it counts towards the Your turn count.

**What you can do on the board.** Nothing. A blocked card offers no action, so anything that might set the block aside goes through the worker. If the worker's session ends, the claim is released as usual ([05](05-sessions.md#liveness)).

## Tools

| Tool | Input | Does | Text result |
|---|---|---|---|
| `block_step` | `task`, `reason` (1–250 characters) | Block | "Blocked. The person will unblock this in this session. End your turn now and wait for them here; when they have resolved it, call unblock_step with task T-012." |
| `unblock_step` | `task`, `note` (optional, up to 500 characters) | Unblock | "Unblocked. Carry on with step 2 of T-012." |

Both are worker tools ([06](06-tools-and-views.md#worker-tools)). The dedicated session may use them too, on steps it claimed.

**Worker instructions.** The worker instructions add this rule:
- **When to block.** When you cannot complete a step and need the person to act with you rather than answer a question, call `block_step` with a clear reason, then end your turn.
- **When to unblock.** When the person comes to this session and the cause is resolved, call `unblock_step` and carry on.

`claim_step` and `open_task` texts mention a past block in the step's history: "blocked 14m: needs AWS credentials".

## Board

| Where | What |
|---|---|
| Props | A Your turn item carries `blocked: {reason, since}` or null. Its `session` is the blocked worker. |
| YourTurnCard | A third kind of card, beside your step and an agent's question. It has a "Blocked" Tag, the worker's name, the step number and title, the reason in full, the time blocked ("Blocked 14m"), and the line "Unblock it in api-server's session". It has no buttons. |
| Sessions section | The blocked worker's card says "Blocked on T-012 step 2" |
| Working section | A blocked task is not in Working. It is in Your turn. |
| Text summary | "T-012 step 2 “Deploy” is blocked (api-server): needs AWS credentials" in the Your turn line |
| Announcement | A task that a poll brings into Your turn as blocked is announced: "T-012 is blocked in api-server" |
