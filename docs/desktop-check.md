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

Then check each item. **Nothing may be posted into the desktop chat** at any step: no user message, and no Claude reply caused by the board.

1. **Adding and moving.**
   - Add a task to the backlog and another to the queue.
   - Reorder the queue, queue a backlog task, and move a queued task to the backlog.
   - Each change shows on the board at once.
2. **Assignment.**
   - Add a task with one agent step, assigned to the first worker in the Worker field.
   - Its card says "Assigned to …". Only that worker picks it up, and the other keeps waiting.
3. **An output, and the hand-back.**
   - Add a task with three steps: an agent step, then your step with Output "Pull request", then another agent step.
   - A worker takes step 1, completes it, and keeps waiting.
   - On the board, Mark done stays disabled until a valid link is entered.
   - Mark it done with a link and a note. **The same worker continues with step 3 without anything typed in its terminal.**
   - The link shows on the task's card, opens in the browser, and the worker's text names it.
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

1. Send `Open task T-001.` The task view appears with the whole chain.
2. Press **Open in full screen**, then **Back to inline**.

## Results

| Date | Claude desktop | Phase | Result |
|---|---|---|---|
| 2026-10-02 | Installed `anachoic.mcpb` 0.0.0 | 0 | Passed, reported by the user |
| 2026-10-02 | Installed `anachoic.mcpb` 0.0.0, a Claude Code worker | 1 | Passed, reported by the user |
