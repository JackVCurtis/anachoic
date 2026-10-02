# 08. Packaging and hosts

## Where each session runs

| Host | Renders views | How the server gets there | Verified |
|---|---|---|---|
| Claude desktop chat | Yes | The `.mcpb` desktop extension | Yes, in the spike |
| Claude desktop, Code tab | Not relied on | The same extension also appears there, with app-only tools hidden | The tools are listed. Rendering was not tested. |
| Claude Code (CLI or Code tab) | No, text only | `claude mcp add` on stdio | Yes, in the spike |
| claude.ai on the web | Would, as a remote connector | Not supported. The server is local-only. | No |

## The desktop extension

`pnpm run pack` builds `anachoic.mcpb` from a folder laid out as:

```text
mcpb/
  manifest.json
  icon.png
  server/
    server.js        dist/server.js
    views/           dist/views/*.html
```

The manifest (version 0.3, which `mcpb validate` accepts):

| Field | Value |
|---|---|
| `name`, `display_name` | `anachoic`, "Anachoic" |
| `server.type` | `node` |
| `server.entry_point` | `server/server.js` |
| `server.mcp_config.command`, `args` | `node`, `["${__dirname}/server/server.js"]` |
| `version` | `package.json`'s version, which `pnpm run pack` writes in, and also gives the plugin and the server |
| `icon` | `icon.png`, a plain 512 × 512 PNG |
| `server.mcp_config.env` | None. The server uses its default data directory, which the worker plugin uses too. There is no `user_config`. |
| `compatibility` | `platforms: ["darwin"]`, `runtimes.node: ">=24.0.0"` |

**The runtime.** Desktop runs the server with its bundled runtime, `Claude Helper (Plugin)`, which reports Node 24.21.0. It starts the process with an empty environment and `/` as the working directory ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)). The server depends on nothing but the manifest's `env`.

**Installing and updating.** You install by double-clicking the file, or from Settings → Extensions. Installing a newer `.mcpb` replaces the extension.

**After an update.** Desktop starts the new server, which migrates the database ([04](04-persistence.md#migrations)). Any worker still running an older build then refuses to start against the newer database, and says to update.

## Worker sessions

A worker is any Claude Code session with the server added. The worker runs the server file that the extension installed, so both always run the same build on the same database.

**Where desktop installs the extension.** On macOS, desktop unpacks each installed extension into its own folder under `~/Library/Application Support/Claude/Claude Extensions/`. The folder is named `local.mcpb.<author>.<name>`, where `<author>` is the manifest's author name in lower case with spaces as hyphens. For Anachoic that is:

```text
~/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic/
  manifest.json
  server/
    server.js
    views/
```

**The preferred install: the `anachoic-worker` plugin.** `pnpm run pack` also lays out a local Claude Code marketplace in `plugin/` (git-ignored), beside `anachoic.mcpb`:

```text
plugin/
  .claude-plugin/marketplace.json     the marketplace "anachoic"
  anachoic-worker/
    .claude-plugin/plugin.json        the MCP server and the SessionEnd hook
    server/
      server.js                       dist/server.js
      views/                          dist/views/*.html
```

- **The MCP server.** `node ${CLAUDE_PLUGIN_ROOT}/server/server.js`, with no `ANACHOIC_DATA_DIR`, so the worker opens the default `board.sqlite`, the same as desktop.
- **The SessionEnd hook.** `node "${CLAUDE_PLUGIN_ROOT}/server/server.js" --session-ended`, also on the default data directory, with a `timeout` of 5 s. It removes the worker from the board when its session ends ([13](13-ending-sessions.md#the-hook)).
- **Installing.** In Claude Code, `/plugin marketplace add <repository>/plugin`, then `/plugin install anachoic-worker@anachoic`. It replaces the `claude mcp add` below. After a new `pnpm run pack`, update the plugin from `/plugin`.
- **Its build.** The plugin carries its own copy of the server, from the same `pnpm run pack` as the `.mcpb`. Install both from one pack, so the worker and desktop run the same build.

**The alternative: `claude mcp add` and a settings snippet.** `pnpm print-worker-command` prints the command, with the installed path filled in:

```bash
claude mcp add --scope user anachoic -- node "$HOME/Library/Application Support/Claude/Claude Extensions/local.mcpb.jack-curtis.anachoic/server/server.js"
```

- **The data directory.** The command sets none, so the worker opens the default `board.sqlite`, the same as desktop.
- **Not installed.** If the extension's folder is missing, the script says so in one line and exits non-zero.
- **`--project`.** Prints the `--scope project` form, which writes the server into one repository's `.mcp.json` instead of adding it for every project.
- **`--dev`.** Prints the command for `dist/server.js`, named `anachoic-dev`, with `.cache/dev-data` as its data directory. That is the board the reference host uses ([Development loop](#development-loop)).
- **`--hook`.** Prints the `hooks.SessionEnd` entry to add to `~/.claude/settings.json` by hand, beside the `claude mcp add` command, so the worker leaves the board when its session ends. With `--dev`, it points at `dist/server.js` and `.cache/dev-data`. No script ever edits your settings.

**Requirements:**
- **Node.** The worker's `node` must be version 24 or newer, for `node:sqlite`. The script warns when `node -v` on the `PATH` is older.
- **Timeouts.** No per-server `timeout` is needed. `wait_for_answer` stays within Claude Code's limits ([05](05-sessions.md#waiting-for-your-answer)).
- **After an update.** The folder name carries no version, so a newer `.mcpb` installs into the same folder and workers pick up the new build when their session next starts its server.

## Logs

- **Where.** Each process writes JSON lines to stderr and to `logs/server-YYYY-MM-DD.log` in the data directory.
- **What.** Lines carry the time, the pid, the session id, an event name and fields.
- **What is never logged.**
  - The environment. In the spike, it carried account and organisation identifiers.
  - Questions, answers or notes in full. They are truncated to 80 characters.
- **Desktop.** Desktop also captures stderr in its own MCP log.

## Development loop

| Need | How |
|---|---|
| Work on a component | `pnpm storybook` |
| Work on a view against a real server | `pnpm dev`, then the reference host. The server's `--http` flag serves Streamable HTTP on 127.0.0.1:3001, which the reference host needs. Todo PKG-03 wraps the reference host's build. |
| Try it in desktop chat | `pnpm run pack`, then install the `.mcpb` |
| Try a worker | `pnpm print-worker-command --dev` prints a `claude mcp add` command for `dist/server.js`, with `.cache/dev-data` as its data directory |

**The reference host is permissive.** The ext-apps reference host (`examples/basic-host`) allows `data:` fonts and more than desktop does, so it does not prove a view will work in desktop. Rendering, fonts, display modes and waking are checked in desktop chat before a phase is called done ([09](09-testing-and-build-order.md#the-manual-desktop-check)).
