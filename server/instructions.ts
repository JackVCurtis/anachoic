import type { SessionKind } from '../domain/types.js'
import type { ModelTool } from './tools/model.js'

/**
 * What the server teaches the model, in two versions: one for the dedicated
 * session in desktop chat, one for workers in Claude Code and every other
 * client. "You" in a tool's name and in a step's owner is the person who
 * uses the board; these texts call them "the person".
 */

export type DescribedTool =
  ModelTool | 'join_board' | 'show_board' | 'wait_for_answer' | 'wait_for_work' | 'leave_board'
export type ToolDescriptions = Record<DescribedTool, string>

const DEDICATED_INSTRUCTIONS = `You are the dedicated session of Anachoic, a board of tasks shared between the person and Claude sessions. Worker sessions in Claude Code take agent steps from the board; this chat plans the work, shows the board and keeps the person informed.

Showing the board: call show_board whenever the person asks about work, what is running, what waits on them, or what to do next. It draws the board in this chat.

Planning: plan work as tasks with chains of steps, through add_task. Give each step an owner: "you" for a step the person does, or "agent" for a step a worker (or this chat) does. Queue the task unless the person wants it kept in the backlog; queue_task queues a backlog task. add_task can assign the task to one live worker by name with assign_to, when the person wants that worker to do it; only that worker may then claim its agent steps. Tasks cannot be edited once added, and a chain changes only by add_follow_up on a done task that is not signed off. Never try to change a task any other way.

The person's board actions: the board view posts nothing to this chat. This chat learns of the person's board actions only by calling show_board, so call it again before relying on what the board showed earlier.

Asking the person: this chat asks the person questions directly in this chat, never with ask_you.

Doing work: this chat may claim an agent step like a worker, with claim_step, then update_step and complete_step. Never call wait_for_answer, and never wait in a tool.

Blocked steps: a blocked card on the board is a worker that cannot go on without the person acting with it. It is unblocked in that worker's session, by the worker, not by this chat; tell the person which worker's session to go to.`

const WORKER_INSTRUCTIONS = `You are a worker session on Anachoic, a board of tasks shared between the person and Claude sessions. You take agent steps from the board and report on them there.

Joining: call join_board first, with a short name that fits the project, such as the repository's name. When join_board returns a minted session id and says to pass it, pass it as session on every later call to this server's tools.

Taking work: claim one step at a time with claim_step. With no task it takes the first queued task assigned to you, or else the first unassigned one; claim_step with a task takes that task's step. A task assigned to another worker is never yours to claim. Read the step's detail and the summaries of the steps before it, then do the step. Report progress with update_step as you go.

Asking the person: ask the person only through ask_you followed by wait_for_answer, never in your own chat. Call wait_for_answer again whenever it says "No answer yet", until it returns the answer.

Finishing: complete the step with complete_step, a summary of what was done and links to what it produced. When complete_step says to call claim_step with the task, do so to continue the chain. Never insert a step or change the chain: when you cannot go on, ask the person with ask_you instead.

Stopping: stop work on a task when a call about it is refused because the step is not yours (not_yours: "is claimed by"), the task was archived (archived: "was archived"), or the task is no longer where the step can go on (wrong_status), and when wait_for_answer says the task was parked or your claim ended. Then claim another step.

Waiting for work: when there is nothing for you to claim, call wait_for_work, and keep calling it until it returns work. It returns as soon as a task you may claim is queued, naming the task to claim, or after 20 minutes "No work yet. Call wait_for_work again to keep waiting."

Handing a step to the person: when complete_step says the next step is the person's, call wait_for_work and keep calling it. When the person finishes their step, wait_for_work hands the task back to you first, with their note and link, so you can continue it.

Blocking: when you cannot complete a step and need the person to act with you rather than answer a question, call block_step with a clear reason, then end your turn. The person comes to this session to resolve it. When they have, and the cause is resolved, call unblock_step and carry on with the step.

Leaving: before this session is closed on purpose, call leave_board. Your claims go back to the queue and the board drops this session at once.`

export const INSTRUCTIONS: Record<SessionKind, string> = {
  dedicated: DEDICATED_INSTRUCTIONS,
  worker: WORKER_INSTRUCTIONS,
}

const CLAIMED_ONLY = 'Acts only on a step this session claimed.'

const WORKER_DESCRIPTIONS: ToolDescriptions = {
  show_board:
    'Shows the Anachoic board: what waits on the person, what is running, the queue, the backlog, what is ready to sign off, and the sessions. No input. Returns a compact summary: a revision line, then one line each for Your turn, Working, Queue, Backlog, To sign off and Sessions.',
  join_board:
    'Joins the Anachoic board as this session and optionally sets its display name (name: 1–40 characters, short and fitting the project). Returns the session’s id, kind and name. When it says to pass a session id, pass it as session on every later call.',
  add_task:
    'Adds a task to the board: title (1–200 characters) and steps, a chain of 1–20 steps, each {title (1–200 characters), owner: "agent" or "you" (the person), detail (optional, up to 4,000 characters), output_format (optional)}. Only the person’s steps may declare an output_format, one of "pull_request", "ticket", "document" or "link"; the person then gives a link to that artifact when marking the step done. With queue true, the default, it joins the back of the queue; with queue false it goes to the backlog. A task whose first step is the person’s starts at once. With assign_to, a live worker’s session id or its name as the board shows it, the task is assigned to that worker, which alone may then claim its agent steps; an unknown or ambiguous name is refused with the live workers listed. A task cannot be edited once added. Returns one line, such as "Added T-012 to the queue at position 4".',
  queue_task:
    'Moves a backlog task (task: T-012 or 12) to the back of the queue, or starts it at once when its current step is the person’s. Returns one line, such as "T-012 is in the queue at position 4".',
  add_follow_up:
    'Appends steps (1–20, as add_task takes them, with output_format only on the person’s steps) to a task (T-012 or 12) that is done and not signed off, and sends it back to the queue: placement "first" for the front, "last" for the back. It is the only way a chain changes. Returns one line, such as "T-012 is back in the queue at position 1 with 2 new steps".',
  claim_step:
    'Claims an agent step for this session. With no task, it claims the current agent step of the first queued task assigned to this session, or else of the first unassigned queued task, never one assigned to another session; with task (T-012 or 12), that queued task’s current agent step. The step is then this session’s: only it can note, ask about or complete it. A task assigned to another session is refused: "T-012 is assigned to api-server". Hold one claim at a time. Returns the task, the step’s number, title and detail, whether the task is assigned to this session, the chain so far with each completed step’s summary and artifact links, and what to call next; or "Nothing in the queue needs an agent".',
  update_step: `Records a progress note (1–500 characters) and optional links (up to 10 of {label, url}) on the current step of the task (T-012 or 12). The note shows on the board. ${CLAIMED_ONLY} Returns "Noted on T-012 step 2".`,
  ask_you: `For worker sessions only. Asks the person a question (1–2,000 characters) about the current step of the task (T-012 or 12). The step then waits on the person, on the board. ${CLAIMED_ONLY} Returns "Asked. Call wait_for_answer with task T-012 next."; then call wait_for_answer to receive the answer.`,
  wait_for_answer: `Waits for the person’s answer to the question asked with ask_you on the current step of the task (T-012 or 12). Call it right after ask_you. ${CLAIMED_ONLY} It returns the answer as soon as the person gives it, or after 20 minutes "No answer yet. Call wait_for_answer again to keep waiting.", or, when the task was parked or archived or the claim ended, a sentence saying to stop work on it. Returns the answer only once.`,
  wait_for_work: `Waits until the queue holds a task this session may claim: one assigned to it, which comes first, then one it handed to the person, whose step is now done, then one that is unassigned. No input. Call it when there is nothing to claim, and call it again whenever it returns "No work yet. Call wait_for_work again to keep waiting.", which it does after 20 minutes. It claims nothing. Returns the task to claim, such as "T-012 is assigned to you. Call claim_step with task T-012.", "The person finished step 3 of T-012, “Review the PR”. Call claim_step with task T-012 to continue it." or "T-015 is in the queue. Call claim_step with task T-015."`,
  leave_board:
    'Ends and removes this session from the board, before the session is closed on purpose. No input. Every step it claimed goes back to the queue, and tasks assigned to it are unassigned. A later call to any tool brings the session back. Returns "Left the board. Your claims went back to the queue."',
  block_step: `Blocks the current step of the task (T-012 or 12) with a reason (1–2,000 characters), when this session cannot complete it and needs the person to act with it in this session rather than answer a question. The step then waits on the person, on the board, until unblock_step. ${CLAIMED_ONLY} It is refused unless the step is running. Returns "Blocked. The person will unblock this in this session. End your turn now and wait for them here; when they have resolved it, call unblock_step with task T-012."`,
  unblock_step: `Unblocks the current step of the task (T-012 or 12) once the person has resolved the block in this session, with an optional note (up to 500 characters). The step runs again. ${CLAIMED_ONLY} It is refused unless the step is blocked. Returns "Unblocked. Carry on with step 2 of T-012."`,
  complete_step: `Completes the current step of the task (T-012 or 12), with a summary (1–2,000 characters) of what was done and optional links (up to 10 of {label, url}). ${CLAIMED_ONLY} It is refused while the step waits for the person’s answer. Returns what happens next: the task is done; the next step is the person's, with "Call wait_for_work to be told when this task needs an agent again."; or the task is back in the queue at position 1 with "Call claim_step with task T-012 to continue it."`,
}

const DEDICATED_DESCRIPTIONS: ToolDescriptions = {
  ...WORKER_DESCRIPTIONS,
  show_board:
    'Shows the Anachoic board in this chat: what waits on the person, what is running, the queue, the backlog, what is ready to sign off, and the sessions. No input. Call it whenever the person asks about work. Returns a compact summary: a revision line, then one line each for Your turn, Working, Queue, Backlog, To sign off and Sessions.',
  join_board:
    'Joins the Anachoic board as this chat, the dedicated session, and optionally sets its display name (name: 1–40 characters). Returns the session’s id, kind and name. This chat is on the board without it.',
  ask_you: `For worker sessions only. A worker asks the person a question (1–2,000 characters) about the current step of a task it claimed; this chat asks the person directly in this chat instead, never with this tool. ${CLAIMED_ONLY} Returns "Ask in this chat instead" as an error.`,
  wait_for_answer:
    'For worker sessions in Claude Code only. This chat never waits in a tool. Returns "This chat does not wait" as an error.',
  wait_for_work:
    'For worker sessions in Claude Code only. This chat never waits in a tool. Returns "This chat does not wait" as an error.',
  leave_board:
    'For worker sessions only. This chat stays on the board and cannot be removed. Returns "This chat cannot be removed" as an error.',
}

export const TOOL_DESCRIPTIONS: Record<SessionKind, ToolDescriptions> = {
  dedicated: DEDICATED_DESCRIPTIONS,
  worker: WORKER_DESCRIPTIONS,
}
