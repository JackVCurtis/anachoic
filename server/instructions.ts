import type { ModelTool } from './tools/model.js'

/**
 * The description of every tool the model sees. "You" in a tool's name and
 * in a step's owner is the person who uses the board.
 */
export type ToolDescriptions = Record<ModelTool | 'join_board' | 'show_board', string>

export const TOOL_DESCRIPTIONS: ToolDescriptions = {
  show_board:
    'Shows the Anachoic board: what waits on the person, what is running, the queue, the backlog, what is ready to sign off, and the sessions. Hosts that render views draw it. Returns a compact summary: a revision line, then one line each for Your turn, Working, Queue, Backlog, To sign off and Sessions.',
  join_board:
    'Joins the Anachoic board as this session and optionally sets its display name (name: 1–40 characters, short and fitting the project). Returns the session’s id, kind and name. When it says to pass a session id, pass it as session on every later call.',
  add_task:
    'Adds a task to the board: title (1–200 characters) and steps, a chain of 1–20 steps, each {title (1–200 characters), owner: "agent" or "you" (the person), detail (optional, up to 4,000 characters)}. With queue true, the default, it joins the back of the queue; with queue false it goes to the backlog. A task whose first step is the person’s starts at once. A task cannot be edited once added. Returns one line, such as "Added T-012 to the queue at position 4".',
  queue_task:
    'Moves a backlog task (task: T-012 or 12) to the back of the queue, or starts it at once when its current step is the person’s. Returns one line, such as "T-012 is in the queue at position 4".',
  add_follow_up:
    'Appends steps (1–20, as add_task takes them) to a task that is done and not signed off, and sends it back to the queue: placement "first" for the front, "last" for the back. It is the only way a chain changes. Returns one line, such as "T-012 is back in the queue at position 1 with 2 new steps".',
  claim_step:
    'Claims an agent step for this session. With no task, it claims the current agent step of the task at queue position 1; with task (T-012 or 12), that queued task’s current agent step. Hold one claim at a time. Returns the task, the step’s number, title and detail, the chain so far with each completed step’s summary, and what to call next; or "Nothing in the queue needs an agent".',
  update_step:
    'Records a progress note (1–500 characters) and optional links (up to 10 of {label, url}) on the step this session claimed on the task. The note shows on the board. Acts only on a step this session claimed. Returns "Noted on T-012 step 2".',
  ask_you:
    'Asks the person a question (1–2,000 characters) about the step this session claimed on the task. The step then waits on the person, on the board. Acts only on a step this session claimed. Returns "Asked. Call wait_for_answer with task T-012 next."',
  complete_step:
    'Completes the step this session claimed on the task, with a summary (1–2,000 characters) of what was done and optional links (up to 10 of {label, url}). Acts only on a step this session claimed, and is refused while the step waits for the person’s answer. Returns what happens next: the task is done, the next step waits on the person, or the task is back in the queue at position 1 with "Call claim_step with task T-012 to continue it."',
}
