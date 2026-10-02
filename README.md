# Anachoic MCP

A board for planning work as chains of steps shared between you and your Claude sessions. A task is a chain of steps, each owned by you or by an agent. Claude desktop shows the board and plans the work; Claude Code sessions join the board as workers and take the agent steps. The design is in [docs/architecture](docs/architecture/01-overview.md).

**For local use only.** The app is not published, signed or listed anywhere. You build it from this repository and install it on your own Mac.

## Install in Claude desktop

1. `pnpm install`, then `pnpm run pack`. It writes `anachoic.mcpb`, and the worker plugin's marketplace in `plugin/`.
2. Double-click `anachoic.mcpb`, or drag it into Settings → Extensions, and enable it.

**The dedicated session.** One desktop process serves every chat, so every desktop chat that uses the server counts as the dedicated session: there is nothing to set up. Keep one chat for Anachoic all the same, since a second chat that calls the tools acts as the same session.

**The views are light only.** In a dark desktop they draw as a light card inside the chat.

## The Board and History prompts

The extension offers two prompts in desktop chat: type `/` and pick "Show the board" or "Show the history" from Anachoic, or find them under the "+" menu, at "Add from Anachoic". They send "Show the Anachoic board." and "Show the Anachoic history.", and Claude draws the board or the table of completed tasks. In Claude Code the same prompts are `/mcp__anachoic__board` and `/mcp__anachoic__history`.

## Workers in Claude Code

### With the anachoic-worker plugin (preferred)

The plugin adds the server to every Claude Code session, gives it the `/worker` command, and removes the session from the board when it ends, through a `SessionEnd` hook. In Claude Code:

```text
/plugin marketplace add /path/to/anachoic-mcp-app/plugin
/plugin install anachoic-worker@anachoic
```

Then, in any project, start a worker with:

```text
/worker api-server
```

It joins the board under that name (or a name that fits the project), claims agent steps, asks you through the board when it needs you, and waits for more work when the queue is empty.

The plugin carries its own copy of the server, so install the `.mcpb` and the plugin from the same `pnpm run pack`.

### With `claude mcp add`

Without the plugin, a worker can run the server desktop installed. `pnpm print-worker-command` prints the command, with the installed path filled in:

```bash
claude mcp add --scope user anachoic -- node "$HOME/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic/server/server.js"
```

- `--project` prints the `--scope project` form, which adds the server to one repository's `.mcp.json` only.
- `--hook` prints the `hooks.SessionEnd` entry to add to `~/.claude/settings.json` yourself, so a worker leaves the board when its session ends. The script never edits your settings.
- `--dev` prints a command for `dist/server.js` with a scratch data directory, for development.
- The worker's `node` must be version 24 or newer. The script warns when it is older.

More detail is in [08. Packaging and hosts](docs/architecture/08-packaging-and-hosts.md#worker-sessions).

## Updating

After pulling changes, run `pnpm run pack` again. Every build carries the one version in `package.json`, which pack also writes into the extension's manifest and the plugin. Then update both:

1. **Desktop.** Install the new `anachoic.mcpb` over the old one, as when installing it, and restart Claude desktop. The board is kept: the new server migrates it on start.
2. **Workers.** In Claude Code, run `/plugin marketplace update anachoic`, then update `anachoic-worker` from `/plugin`, and restart each worker session.

A worker still running an older build refuses to start against a board a newer build has migrated, with a message that says to update. With `claude mcp add`, workers run desktop's installed server, so they pick up the new build when their session next starts.

## Data and logs

- **The board** is `board.sqlite`, with its `-wal` and `-shm` files, in `~/Library/Application Support/Anachoic MCP`. Desktop and every worker open that same folder, which is fixed: there is no setting for it. Sessions that ended more than 7 days ago are pruned once a day; tasks are never deleted.
- **If the database can't be read,** every tool says so and names the file. The file is never replaced automatically: move it aside yourself to start a new board.
- **Logs** are JSON lines in `logs/server-YYYY-MM-DD.log` in the same folder, one file a day for every process. Desktop also keeps the server's stderr in its own MCP log. The logs never hold the environment, and questions, answers and notes are cut to 80 characters.

## Develop

| Command | What it does |
|---|---|
| `pnpm build` | Builds the views and the server into `dist/` |
| `pnpm dev` | Rebuilds both on change |
| `pnpm host` | Runs the ext-apps reference host against the dev server |
| `pnpm storybook` | Component stories |
| `pnpm print-worker-command --dev` | Adds a worker against `dist/server.js` and the dev board in `.cache/dev-data` |
| `pnpm run pack` | Builds `anachoic.mcpb` and `plugin/` for desktop and Claude Code |
| `pnpm test` | Unit, UI, integration and e2e suites |
| `pnpm typecheck`, `pnpm lint` | Type and lint checks |

The reference host is more permissive than desktop, so before a phase is called done the views are checked by hand in desktop chat: see [docs/desktop-check.md](docs/desktop-check.md).
