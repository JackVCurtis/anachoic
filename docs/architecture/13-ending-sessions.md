# 13. Ending and removing sessions

Added on 2026-10-02, at the product owner's request: when a worker session is deleted, it should leave the Sessions list. The preferred way is a hook. Because a hook cannot be relied on alone, there is also a way to deregister a worker by hand.

This document is the authority for ending and removing sessions. It is built after [12](12-blocked-steps.md) and before phase 3.

## What Claude Code offers

From the Claude Code documentation ([hooks](https://code.claude.com/docs/en/hooks.md), [plugins](https://code.claude.com/docs/en/plugins/manifest-reference.md)):

- **The hook.** A `SessionEnd` hook runs a command when a session ends, with `reason` set to `clear`, `resume`, `logout`, `prompt_input_exit` or `other`. It receives JSON on stdin that includes `session_id`.
- **Not guaranteed.** In the documentation's words, SessionEnd hooks "are not guaranteed to run". They are skipped when Claude Code crashes or is killed.
- **A tight budget.** All `SessionEnd` hooks together have 1.5 s by default. A hook's own `timeout` raises the budget, up to 60 s.
- **Shipping it.** A Claude Code plugin can bundle an MCP server and hooks together, with `${CLAUDE_PLUGIN_ROOT}` in their commands.
- **Not documented:**
  - Whether deleting or archiving a session in desktop's Code tab fires `SessionEnd`.
  - Whether the hook's `session_id` equals the `CLAUDE_CODE_SESSION_ID` that the server process sees. Todo MCP-20 checks this by hand.

## Three ways a worker leaves the list

| Way | When | Shown afterwards |
|---|---|---|
| **The hook** | The worker's Claude Code session ends normally and the hook runs | Removed at once |
| **Liveness** (unchanged, [05](05-sessions.md#liveness)) | The server process stops heartbeating for 2 minutes, for example after a crash, a kill, or a deleted session that didn't fire the hook | Listed as ended for 10 minutes, with what was released, then gone |
| **Remove** | You press Remove on a worker's card, or the worker calls `leave_board` | Removed at once |

## Domain

| Field | On | Type | Meaning |
|---|---|---|---|
| removedAt | Session | Instant, or empty | Set when the session was removed by the hook, by Remove or by `leave_board`. A removed session is never listed. |

**End and remove.** One transaction does all of the following, whichever way the worker left:
- releases every step the session claimed, exactly as Release does ([03](03-domain-model.md#the-task-state-machine)), blocked steps included
- clears the session's assignments and `resumeWith`
- sets `endedAt` and `removedAt`
- records a `removed` event on each affected task

The heartbeat never revives a removed session, even if its server process is still running. A later tool call from that session's id revives it as a fresh live session, which shows on the board again.

**Who can remove whom:**
- **The hook** can remove only the session id it is given.
- **Remove on the board** works for any worker card, live or ended. On a live worker holding work, Remove asks first in an InlineConfirm: "Remove api-server? Its step on T-012 goes back to the queue."
- **The dedicated session** cannot be removed.

## The hook

- **The command.** It is `node <server.js> --session-ended`, with the hook's JSON on stdin.
- **What it does.** It opens the database, ends and removes the session named by `session_id`, then exits.
- **No server.** It speaks no MCP and starts no server.
- **Fast.** It finishes well within the 1.5 s budget, because it is one short transaction.
- **Timeout.** The hook entry sets a `timeout` of 5 s anyway, for a busy database.
- **Silent.** The command always exits 0, so it never disturbs the user's session. When it fails, it writes the reason to the server log.

### How it is installed

1. **A Claude Code plugin, `anachoic-worker`.** This is the preferred install. It replaces the plain `claude mcp add`.
   - **Contents.** A local marketplace folder that `pnpm run pack` builds beside the `.mcpb`. It holds the server, its views and a plugin manifest declaring both:
     - the MCP server, with `ANACHOIC_DATA_DIR`
     - the `SessionEnd` hook
   - **Installing.** You install it with `/plugin marketplace add <folder>`, then `/plugin install anachoic-worker@anachoic`.
   - **Workers only.** It is for worker sessions. Desktop chat keeps using the `.mcpb`.
2. **A settings snippet, for an install without the plugin.** `pnpm print-worker-command --hook` prints the `hooks.SessionEnd` entry to add to `~/.claude/settings.json` beside the `claude mcp add` command. The script never edits your settings.

## Tools and board

| Where | What |
|---|---|
| `leave_board` | A new worker tool with no input. It ends and removes the calling session: "Left the board. Your claims went back to the queue." The worker instructions say to call it before a session is closed on purpose. |
| `remove_session` | A new app-only tool, `session` (an id). It ends and removes that worker and returns the fresh board props. It refuses the dedicated session with `invalid` and an unknown session with `not_found`. |
| SessionCard | A ghost "Remove" button on every worker card. On a worker holding a step it sits behind an InlineConfirm with the question above. |
| Props | Removed sessions are never in `sessions`. Ended but not removed sessions are listed for 10 minutes, as before. |
