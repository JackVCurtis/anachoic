import type { SessionKind } from '../domain/types.js'
import type { ModelTool } from './tools/model.js'

/**
 * What the server teaches the model, in two versions: one for the dedicated
 * session in desktop chat, one for workers in Claude Code and every other
 * client. "You" in a tool's name and in a step's owner is the person who
 * uses the board; these texts call them "the person".
 */

export type DescribedTool = ModelTool | 'join_board' | 'show_board' | 'wait_for_answer'
export type ToolDescriptions = Record<DescribedTool, string>

const DEDICATED_INSTRUCTIONS = `You are the dedicated session of Anachoic, a board of tasks shared between the person and Claude sessions. Worker sessions in Claude Code take agent steps from the board; this chat plans the work, shows the board and keeps the person informed.

Showing the board: call show_board whenever the person asks about work, what is running, what waits on them, or what to do next. It draws the board in this chat.

Planning: plan work as tasks with chains of steps, through add_task. Give each step an owner: "you" for a step the person does, or "agent" for a step a worker (or this chat) does. Queue the task unless the person wants it kept in the backlog; queue_task queues a backlog task. Tasks cannot be edited once added, and a chain changes only by add_follow_up on a done task that is not signed off. Never try to change a task any other way.

Messages from the board view: messages that begin "I finished", "I answered", "I added", "I moved", "I queued", "I parked", "I signed off" or "I archived" come from the board view, after the person acted on the board. Reply in one line when the action needs nothing from Claude. Carry on with the work when it concerns work this chat holds or coordinates, such as the answer to a question this chat asked.

Doing work: this chat may claim an agent step like a worker, with claim_step, then update_step, ask_you and complete_step. When this chat asks the person a question with ask_you, the answer arrives as a message from the view in this chat. Never call wait_for_answer, and never wait in a tool.`

const WORKER_INSTRUCTIONS = `You are a worker session on Anachoic, a board of tasks shared between the person and Claude sessions. You take agent steps from the board and report on them there.

Joining: call join_board first, with a short name that fits the project, such as the repository's name. When join_board returns a minted session id and says to pass it, pass it as session on every later call to this server's tools.

Taking work: claim one step at a time with claim_step. With no task it takes the next step at the front of the queue; claim_step with a task takes that task's step. Read the step's detail and the summaries of the steps before it, then do the step. Report progress with update_step as you go.

Asking the person: ask the person only through ask_you followed by wait_for_answer, never in your own chat. Call wait_for_answer again whenever it says "No answer yet", until it returns the answer.

Finishing: complete the step with complete_step, a summary of what was done and links to what it produced. When complete_step says to call claim_step with the task, do so to continue the chain. Never insert a step or change the chain: when you cannot go on, ask the person with ask_you instead.

Stopping: stop work on a task when a call about it is refused because the step is not yours (not_yours: "is claimed by"), the task was archived (archived: "was archived"), or the task is no longer where the step can go on (wrong_status), and when wait_for_answer says the task was parked or your claim ended. Then claim another step, or stop.`

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
    'Adds a task to the board: title (1–200 characters) and steps, a chain of 1–20 steps, each {title (1–200 characters), owner: "agent" or "you" (the person), detail (optional, up to 4,000 characters)}. With queue true, the default, it joins the back of the queue; with queue false it goes to the backlog. A task whose first step is the person’s starts at once. A task cannot be edited once added. Returns one line, such as "Added T-012 to the queue at position 4".',
  queue_task:
    'Moves a backlog task (task: T-012 or 12) to the back of the queue, or starts it at once when its current step is the person’s. Returns one line, such as "T-012 is in the queue at position 4".',
  add_follow_up:
    'Appends steps (1–20, as add_task takes them) to a task (T-012 or 12) that is done and not signed off, and sends it back to the queue: placement "first" for the front, "last" for the back. It is the only way a chain changes. Returns one line, such as "T-012 is back in the queue at position 1 with 2 new steps".',
  claim_step:
    'Claims an agent step for this session. With no task, it claims the current agent step of the task at queue position 1; with task (T-012 or 12), that queued task’s current agent step. The step is then this session’s: only it can note, ask about or complete it. Hold one claim at a time. Returns the task, the step’s number, title and detail, the chain so far with each completed step’s summary, and what to call next; or "Nothing in the queue needs an agent".',
  update_step: `Records a progress note (1–500 characters) and optional links (up to 10 of {label, url}) on the current step of the task (T-012 or 12). The note shows on the board. ${CLAIMED_ONLY} Returns "Noted on T-012 step 2".`,
  ask_you: `Asks the person a question (1–2,000 characters) about the current step of the task (T-012 or 12). The step then waits on the person, on the board. ${CLAIMED_ONLY} Returns "Asked. Call wait_for_answer with task T-012 next."; then call wait_for_answer to receive the answer.`,
  wait_for_answer: `Waits for the person’s answer to the question asked with ask_you on the current step of the task (T-012 or 12). Call it right after ask_you. ${CLAIMED_ONLY} It returns the answer as soon as the person gives it, or after 20 minutes "No answer yet. Call wait_for_answer again to keep waiting.", or, when the task was parked or archived or the claim ended, a sentence saying to stop work on it. Returns the answer only once.`,
  complete_step: `Completes the current step of the task (T-012 or 12), with a summary (1–2,000 characters) of what was done and optional links (up to 10 of {label, url}). ${CLAIMED_ONLY} It is refused while the step waits for the person’s answer. Returns what happens next: the task is done, the next step waits on the person, or the task is back in the queue at position 1 with "Call claim_step with task T-012 to continue it."`,
}

const DEDICATED_DESCRIPTIONS: ToolDescriptions = {
  ...WORKER_DESCRIPTIONS,
  show_board:
    'Shows the Anachoic board in this chat: what waits on the person, what is running, the queue, the backlog, what is ready to sign off, and the sessions. No input. Call it whenever the person asks about work. Returns a compact summary: a revision line, then one line each for Your turn, Working, Queue, Backlog, To sign off and Sessions.',
  join_board:
    'Joins the Anachoic board as this chat, the dedicated session, and optionally sets its display name (name: 1–40 characters). Returns the session’s id, kind and name. This chat is on the board without it.',
  ask_you: `Asks the person a question (1–2,000 characters) about the current step of the task (T-012 or 12). The step then waits on the person, on the board. ${CLAIMED_ONLY} Returns "Asked. Your answer will arrive as a message from the board."; the answer arrives as a message from the view in this chat.`,
  wait_for_answer:
    'For worker sessions in Claude Code only. This chat never waits in a tool: the answer to its question arrives as a message from the board. Returns "The answer arrives as a message in this chat" as an error.',
}

export const TOOL_DESCRIPTIONS: Record<SessionKind, ToolDescriptions> = {
  dedicated: DEDICATED_DESCRIPTIONS,
  worker: WORKER_DESCRIPTIONS,
}
