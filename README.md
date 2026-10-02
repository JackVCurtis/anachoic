# Anachoic MCP

A board for planning work as chains of steps shared between you and your Claude sessions. It runs as a Claude desktop extension, and Claude Code sessions join it as workers. The design is in [docs/architecture](docs/architecture/01-overview.md).

## Install in Claude desktop

1. `pnpm install`, then `pnpm run pack`. It writes `anachoic.mcpb`.
2. Double-click `anachoic.mcpb`, or drag it into Settings > Extensions, and enable it.

The board's data lives in `~/Library/Application Support/Anachoic MCP`.

## Add Claude Code sessions as workers

### With the plugin (preferred)

`pnpm run pack` also builds a local Claude Code marketplace in `plugin/`. It holds the `anachoic-worker` plugin, which adds the server to every Claude Code session and removes the session from the board when it ends, through a `SessionEnd` hook. In Claude Code:

```text
/plugin marketplace add /path/to/anachoic-mcp-app/plugin
/plugin install anachoic-worker@anachoic
```

The plugin runs its own copy of the server against the same data directory as desktop, so install the `.mcpb` and the plugin from the same `pnpm run pack`.

### With `claude mcp add` and a settings snippet

Desktop installs the extension's files at:

```text
~/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic/
```

A worker runs the server from there, against the same data directory, so it always runs the same build as desktop on the same board. Print the command with that path filled in, then run it:

```bash
pnpm print-worker-command
```

It prints:

```bash
claude mcp add --scope user anachoic -e ANACHOIC_DATA_DIR="$HOME/Library/Application Support/Anachoic MCP" -- node "$HOME/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic/server/server.js"
```

- `--project` prints the `--scope project` form, which adds the server to one repository's `.mcp.json` only.
- `--dev` prints a command for `dist/server.js` with a scratch data directory, for development.
- `--hook` prints the `hooks.SessionEnd` entry to add to `~/.claude/settings.json` yourself, so a worker leaves the board when its session ends. The script never edits your settings.
- The worker's `node` must be version 24 or newer. The script warns when it is older.

`claude mcp list` then shows `anachoic` as connected. More detail is in [08. Packaging and hosts](docs/architecture/08-packaging-and-hosts.md#worker-sessions).

## Develop

| Command | What it does |
|---|---|
| `pnpm build` | Builds the views and the server into `dist/` |
| `pnpm dev` | Rebuilds both on change |
| `pnpm host` | Runs the ext-apps reference host against the dev server |
| `pnpm storybook` | Component stories |
| `pnpm test` | Unit, UI, integration and e2e suites |
| `pnpm typecheck`, `pnpm lint` | Type and lint checks |

Before a phase is called done, the views are checked by hand in desktop chat: see [docs/desktop-check.md](docs/desktop-check.md).
