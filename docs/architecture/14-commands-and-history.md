# 14. Commands and the History view

The product owner added these on 2026-10-02, after phase 3:
- calling up the board with a slash command from a regular Claude chat
- a second command for a new History view, a table of completed tasks

This document is the authority for both. It is built before phase 4.

## Slash commands are MCP prompts

A server offers commands to a chat as **MCP prompts** (`prompts/list` and `prompts/get`). Each client presents them in its own way. What is known ([MCP prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts), [desktop extensions](https://www.anthropic.com/engineering/desktop-extensions)):

| Client | How prompts appear | Verified |
|---|---|---|
| Claude Code | `/mcp__anachoic__board` and `/mcp__anachoic__history`, beside the plugin's own `/worker` | Documented |
| Claude desktop chat | Not documented. Reports say prompts are offered from the "+" menu ("Add from Anachoic") rather than as `/` commands. A `.mcpb` extension must declare its prompts in the manifest's `prompts` array, and desktop is said to compare the served text with the declared text. | To be checked by hand (todo MCP-22) |

The server offers two prompts, and the `.mcpb` manifest declares both with exactly the same text.

| Prompt | Title | Text, which becomes the user's message |
|---|---|---|
| `board` | Show the board | "Show the Anachoic board." |
| `history` | Show the history | "Show the Anachoic history." |

**What happens next.**
- **In a chat that uses this server,** Claude calls `show_board` or `show_history`. The dedicated session's instructions say to do so for these messages.
- **In any desktop chat,** the board can be called up with the prompt. Every desktop chat counts as the dedicated session ([05](05-sessions.md#identity)), so no separate chat needs to be set up.
- **Neither prompt takes arguments.**

If desktop turns out to offer prompts only from the "+" menu, typing `/board` will not work there. The prompts still save typing, and the result is recorded in [10](10-open-questions.md).

## The History view

### What it shows

**Completed tasks** are the tasks that are `done` and signed off, newest sign-off first. They come 20 to a page, in a table:

| Column | Shows |
|---|---|
| Task | The display id and title. Pressing the title opens the task view, as a board card does ([06](06-tools-and-views.md#views)). |
| Steps | "4 steps", plus the chain pips |
| Agent / User | Time spent by agents and by the user, from the task's derived times |
| Workers | The names of the sessions that completed its agent steps |
| Artifacts | Its artifact links, opened through the host, as on the cards ([11](11-assignment-and-outputs.md#board-1)) |
| Signed off | When it was signed off: "2 Oct, 14:03" in the user's time zone |

Above the table are a count, "38 completed tasks", and a filter field that matches the title or the display id. Below it, Pagination ("Page 2 of 2", Previous and Next) is copied from anachoic.

### Retention

A History view is pointless if completed tasks are deleted. The phase 4 retention rule ([04](04-persistence.md#retention), todo DOM-07) is therefore changed:
- **Signed-off tasks are kept.**
- **Retention prunes only** sessions that ended more than 7 days ago.

### Tools and props

| Tool | Kind | Input | Result |
|---|---|---|---|
| `show_history` | View tool, `ui://anachoic/history-<hash>.html` | `filter` (optional) | Text: "38 completed tasks", then the first 20 as lines: "T-012 “Fix the flaky login test” · signed off 2 Oct · 2 links". `structuredContent` holds the history props for page 1. |
| `get_history` | App-only | `page` (from 1), `filter` (optional), `sinceRevision` (optional) | `{changed: false, revision}` when nothing changed, else the history props |

**History props:**
```text
revision, now, page, pageCount, total, filter
rows: [{task, signedOffAt, finishedAt, steps (pips), agentSeconds, userSeconds, workers: [name], artifacts: [{stepNumber, format, url}]}]
```

**The view:**
- **Polling.** The History view connects, fetches, and polls like the board ([06](06-tools-and-views.md#polling)).
- **Opening a task.** It opens a task in the task panel, with "Back to history".
- **Wording.** It follows the wording rules ([11](11-assignment-and-outputs.md#words-on-screen-and-for-claude)).
- **No messages.** It posts no messages.

**The board's Done section** keeps its 10 most recently signed-off tasks, and links to the history with "Show all completed tasks". That link calls `get_history` and swaps in the History panel, the same way the task panel works.
