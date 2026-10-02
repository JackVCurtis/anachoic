# Desktop check

The reference host allows more than Claude desktop does ([08](architecture/08-packaging-and-hosts.md#development-loop)), so before a phase is called done its views are checked by hand in desktop **chat**, which is not the Code tab ([09](architecture/09-testing-and-build-order.md#the-manual-desktop-check)). Each step says the phase from which it applies. Run every step whose phase is the current one or earlier, then add a line to [Results](#results).

The server writes its log to `~/Library/Application Support/Anachoic MCP/logs/`. Note anything the log can't capture, such as a view that never appears or text drawn in the wrong font.

## A. Install

1. Run `pnpm run pack` on a clean working tree. It writes `anachoic.mcpb` at the root of the repository.
2. Double-click `anachoic.mcpb`, or drag it into Settings > Extensions. Install it, replacing any earlier Anachoic, then make sure it is enabled. The spike's "Anachoic probe" is a different extension and can stay.
3. Open a **new chat**.

## B. The board renders (phase 0)

1. Send `Call show_board.`
   - The board appears inline, as a light card inside the chat, with the four counts, then Your turn on a dark band, Sessions, Working, Queue, Backlog and Done.
   - In phase 0 every count is 0, and Your turn says "Nothing waiting on you".
   - Claude's reply describes the board from the text result. It begins "Board, revision 0" in phase 0.
2. Look at the view for 20 s. Its height stays put: it does not grow, shrink or flicker.

## C. Fonts load (phase 0)

1. The section titles and labels are drawn in Barlow Condensed, narrow and uppercase. Body text, such as a task title, is drawn in Barlow, not in the system font.

## D. The board survives a turn and a restart (phase 0)

1. Send `Say hello in one word.` When Claude's turn ends, the board above is drawn again, as it was.
2. Quit Claude desktop completely and reopen it. Open the same chat and scroll to the board. It is drawn again.

## E. Polling shows a worker's change (phase 1)

1. Add the server to Claude Code as [08](architecture/08-packaging-and-hosts.md#worker-sessions) says, and start a worker session in any project.
2. With the board in view, ask the worker to add a task with two agent steps and then to claim its first step.
3. Within 5 s of each call, the board shows it without a reload: the task in the queue, then in Working with the worker's session name.
4. Stop the worker. Within the dead window, the board shows the session as ended and the task back at the front of the queue.

## F. Working the board, with workers (phase 2)

Set up first:
1. Reinstall `anachoic.mcpb` (section A).
2. Install the worker plugin in Claude Code, so that each worker removes itself when its session ends ([08](architecture/08-packaging-and-hosts.md#worker-sessions)):
   - Run `/plugin marketplace add <repository>/plugin`, then `/plugin install anachoic-worker@anachoic`.
   - If an earlier `claude mcp add` entry named `anachoic` exists, remove it with `claude mcp remove anachoic -s user`.
3. Start two workers, `claude` in two different project folders. Tell each: "Join the Anachoic board and wait for work."

Then check each item. Nothing on the board may address the user as "you": the section is "Waiting on user". **Nothing may be posted into the desktop chat** at any step: no user message, and no Claude reply caused by the board.

1. **Adding and moving.**
   - Add a task to the backlog and another to the queue.
   - Reorder the queue, queue a backlog task, and move a queued task to the backlog.
   - Each change shows on the board at once.
2. **Assignment.**
   - Add a task with one agent step, assigned to the first worker in the Worker field.
   - Its card says "Assigned to …". Only that worker picks it up, and the other keeps waiting.
3. **An output, and the hand-back.**
   - Add a task with three steps: an agent step with Output "Pull request", then a user step, then another agent step.
   - A worker takes step 1. It can't complete the step without an `artifact_url`, and completes it with one.
   - The Waiting on user card for step 2 shows "Pull request from step 1 ↗", which opens in the browser.
   - Mark step 2 done with a note. **The same worker continues with step 3 without anything typed in its terminal**, and its `claim_step` text names the input link.
4. **A question.** Have a worker ask you something ("Claim the next step, then ask me which colour to use"). Answer on the board, and the worker continues with your answer.
5. **Blocked.**
   - Have a worker block a step ("Claim the next step, then block it: you need AWS credentials").
   - The board shows a Blocked card with the worker, step and reason, and no buttons. The worker's Sessions card says "Blocked on …".
   - Talk to the worker in its terminal until it unblocks. The card leaves Your turn.
6. **Park, sign off, follow-up and archive.** Park a task from Your turn. Sign off a finished task, add a follow-up to another, and archive a third.
7. **Removing workers.**
   - End one worker with `/exit`. It disappears from Sessions within one poll, and its step, if it held one, goes back to the queue.
   - Press Remove on the other worker's card. It asks first if the worker holds a step, then the card disappears.
8. **What the docs leave open.** Note the answers in [13](architecture/13-ending-sessions.md#what-claude-code-offers):
   - Did the hook remove the worker, as opposed to the 2-minute liveness check? The board would show it as "ended" if liveness did it.
   - Does deleting a session in desktop's Code tab remove it?

## G. The task view (phase 3)

Use a task with a worker step that declared Output "Pull request", then a user step, and with at least one note, one question and answer, and one block and unblock in its history. The test in section F produces one.

1. **From the board.** Press a card's title. The board is replaced by the task panel, in the same view.
   - The header shows the title, the list it is in, and "Assigned to …" when the task is assigned.
   - The timeline lists every step with its owner (the worker's name, or "User") and its status. The current step is open.
   - Opening a step shows its question and answer, its block reason, notes, summary, "Produces a pull request", its artifact link, and on a user step its input link. Each link opens in the browser.
   - The event list names who did what, and when.
   - "Back to board" returns to the board, with focus on the card that opened the task.
2. **From the chat.** Send `Open task T-0nn`. The task view appears and asks for full screen. If desktop allows it, the view fills the window. "Back to inline" returns it to the chat. Claude's reply describes the task from the text result, including the artifact links.
3. **Live.** With the task open, have a worker add a note to its current step. The note appears in the timeline within 5 s, without a reload.
4. **Park and Archive.** Each asks first in place. Escape closes the confirmation, and focus returns to its button.
   - Park moves the task to the backlog, and the view shows it there.
   - Archive takes the task off every list. In the board panel it returns to the board, and in the standalone view it says the task was archived.
5. **Nothing is posted** to the chat by any of these actions, and no text on screen says "you".

## H. Prompts and History (after phase 3)

1. **The board prompt in desktop.**
   - In a new desktop chat, type `/` and look for "Show the board" from Anachoic. If it isn't there, look under the "+" menu, at "Add from Anachoic".
   - Use it. The message "Show the Anachoic board." is sent, and the board appears.
   - Note where desktop offered the prompt. It is recorded in doc 14.
2. **The history prompt** works the same way, and the History view appears.
3. **History.**
   - It lists signed-off tasks, newest first, with their steps, times, workers, artifact links and sign-off date.
   - The filter narrows the list by title or by id. With more than 20 tasks, Previous and Next move between pages.
   - A task's title opens the task view, and "Back to history" returns to the list.
   - Artifact links open in the browser.
4. **From the board.** "Show all completed tasks" in the Done section opens History, and "Back to board" returns.
5. **In Claude Code.** `/mcp__anachoic__board` shows the board summary as text.

## I. Phase 4

1. **Icon.** Settings → Extensions shows Anachoic with its icon, at version 0.5.0.
2. **Installing over the older build keeps the board.** Every task, the history and the sessions are still there after reinstalling.
3. **The new look.** Secondary text is a little darker, and the primary button and selected options use a deeper blue. Nothing is hard to read on the dark Waiting on user band or in the task view.
4. **Screen readers,** if one is at hand. Arrows and dots are not read aloud, and a dash reads "none".

## Results

| Date | Claude desktop | Phase | Result |
|---|---|---|---|
| 2026-10-02 | Installed `anachoic.mcpb` 0.0.0 | 0 | Passed, reported by the user |
| 2026-10-02 | Installed `anachoic.mcpb` 0.0.0, a Claude Code worker | 1 | Passed, reported by the user |
| 2026-10-02 | Claude desktop 2.19675.0, `anachoic.mcpb` and `anachoic-worker` 0.2.0, two Claude Code 2.1.286 workers | 2 | Passed, reported by the user. The SessionEnd hook removed workers on exit; the log shows `session_ended` with the claimed task released. |
| 2026-10-02 | `anachoic.mcpb` and `anachoic-worker` 0.3.0 | 3 | Passed, reported by the user |
| 2026-10-02 | `anachoic.mcpb` and `anachoic-worker` 0.4.0 | H, prompts and History | Passed, reported by the user |
