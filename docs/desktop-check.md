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

## F. Each action posts its message (phase 2)

Do each action in the board, and check that a user message with the sentence from [06](architecture/06-tools-and-views.md#waking-the-dedicated-session) appears in the chat, and that Claude replies to it.

1. Add a task, and add another to the queue.
2. Reorder the queue, queue a backlog task, and move a queued task to the backlog.
3. Mark one of your steps done, with a note.
4. Answer a worker's question. The worker's `wait_for_answer` returns the answer.
5. Park a task from Your turn.
6. Sign off a finished task, add a follow-up to another, and archive a third.

## G. The task view (phase 3)

1. Send `Open task T-001.` The task view appears with the whole chain.
2. Press **Open in full screen**, then **Back to inline**.

## Results

| Date | Claude desktop | Phase | Result |
|---|---|---|---|
| | | 0 | Not yet run |
