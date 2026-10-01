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
| `server.mcp_config.env` | `ANACHOIC_DATA_DIR` from `user_config.data_dir` |
| `user_config.data_dir` | A directory, defaulting to `~/Library/Application Support/Anachoic MCP`. You can change it in the extension's settings. |
| `compatibility` | `platforms: ["darwin"]`, `runtimes.node: ">=24.0.0"` |

**The runtime.** Desktop runs the server with its bundled runtime, `Claude Helper (Plugin)`, which reports Node 24.21.0. It starts the process with an empty environment and `/` as the working directory ([spike notes](../spikes/mcp-apps/notes.md#1-49-15-and-16-claude-desktop-chat)). The server depends on nothing but the manifest's `env`.

**Installing and updating.** You install by double-clicking the file, or from Settings → Extensions. Installing a newer `.mcpb` replaces the extension.

**After an update.** Desktop starts the new server, which migrates the database ([04](04-persistence.md#migrations)). Any worker still running an older build then refuses to start against the newer database, and says to update.

## Worker sessions

A worker is any Claude Code session with the server added. The worker runs the server file that the extension installed, so both always run the same build:

```bash
claude mcp add --scope user anachoic -e ANACHOIC_DATA_DIR="$HOME/Library/Application Support/Anachoic MCP" -- node "<path to the extension>/server/server.js"
```

The README shows the exact path. Desktop keeps installed extensions under its application-support folder. Todo PKG-02 finds and records that path, and adds a `pnpm print-worker-command` script that prints the command filled in.

**Requirements:**
- **Node.** The worker's `node` must be version 24 or newer, for `node:sqlite`.
- **Per project.** `--scope user` adds the server for every project. `--scope project` writes it into one repo's `.mcp.json` instead.
- **Timeouts.** No per-server `timeout` is needed. `wait_for_answer` stays within Claude Code's limits ([05](05-sessions.md#waiting-for-your-answer)).

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
| Try a worker | `claude mcp add` pointing at `dist/server.js`, with `ANACHOIC_DATA_DIR` set to a scratch directory |

**The reference host is permissive.** The ext-apps reference host (`examples/basic-host`) allows `data:` fonts and more than desktop does, so it does not prove a view will work in desktop. Rendering, fonts, display modes and waking are checked in desktop chat before a phase is called done ([09](09-testing-and-build-order.md#the-manual-desktop-check)).
