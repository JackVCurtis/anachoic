# Extending Claude's interface with custom UI: agent brief

Oct 1, 2026 · @Jack

## Bottom line

The Claude desktop app has no plugin API for adding panels, sidebars or other chrome. The supported way to show custom UI inside Claude is **MCP Apps**: an official MCP extension (SEP-1865, stable since 2026-01-26, identifier `io.modelcontextprotocol/ui`) that lets an MCP server return interactive HTML views rendered inline in the conversation. Views appear per tool call, not as persistent panes.

## How MCP Apps work

1. A tool declares a view in its metadata: `_meta: { ui: { resourceUri: "ui://<server>/<view>" } }`.
2. The server registers that `ui://` resource as bundled HTML/JS with MIME type `text/html;profile=mcp-app`.
3. When the model calls the tool, the host fetches the resource and renders it in a sandboxed iframe.
4. The host passes the tool result to the view. View and host then talk JSON-RPC over `postMessage`.
5. The view can call other tools on the same server, receive fresh results pushed by the host, send a follow-up message as if the user typed it, update the model's context, open links in the browser, and log events.

Rules to follow:

- Always return a plain-text result alongside the view. Hosts without MCP Apps support fall back to it, and the model reads it.
- External scripts and assets load only from origins declared in `_meta.ui.csp`.
- Use `@modelcontextprotocol/ext-apps` (the `App` class and `PostMessageTransport` for views) and `@modelcontextprotocol/ext-apps/server` (`registerAppTool`, `registerAppResource`). The SDK is a convenience, not a requirement.
- Scaffold with the official Claude Code plugin: `/plugin install mcp-apps@modelcontextprotocol-ext-apps`.

## Where views render

| Surface | Renders MCP App views? | How to install the server |
| --- | --- | --- |
| Claude chat, web | Yes | Remote custom connector (Settings, Connectors). Needs a publicly reachable HTTPS URL. |
| Claude chat, desktop app | Yes | Remote custom connector, or a desktop extension (`.mcpb`) from Settings, Extensions |
| Claude Code sessions (CLI, VS Code, Code inside the desktop app) | No, text result only, as of the issue filed late August 2026 | `claude mcp add` |

Claude Code and the desktop chat keep separate MCP registries. Claude Code reads `~/.claude.json`. The desktop app reads `claude_desktop_config.json`. A server added in one does not appear in the other, even when Code runs inside the desktop app.

## Applying it to Anachoic

The AdonisJS process can expose an MCP endpoint (Streamable HTTP) whose tools return `ui://` views of Anachoic data. Candidate tools:

- `show_queue`: the board's queue and slot occupancy, with drag-to-reorder calling a `reorder_queue` tool.
- `open_task(id)`: a task drawer view for one task, such as T-118, with its chain and step actions.
- `your_turn`: tasks whose current step is waiting on the human.

Views should reuse the UI set's tokens and presentational components from `inertia/components/`, bundled into a single HTML file per view. Domain facts still come from the server, as in the app set.

The standalone dashboard stays. Views are per-call iframes in a chat, so the persistent board, the terminal bridge and tmux attach remain in Anachoic itself.

## Getting started

1. Scaffold a server with the `mcp-apps` plugin, or add UI to an existing server's tools with its `add-app-to-server` skill.
2. Iterate locally against the ext-apps reference host (`basic-host`) or the MCPJam Inspector before testing in Claude.
3. Test in Claude chat as a remote connector. For a local server, expose it through a tunnel such as `cloudflared`, or package it as a `.mcpb` desktop extension.

Verify before committing:

- [ ] Whether Claude Code sessions now render MCP App views. The last known state is text only.
- [ ] Whether locally configured servers in the desktop app's config file render views. One open report says they do not, and another says a server proxied through `mcp-remote` did not render on Windows.

## Sources

- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview), modelcontextprotocol.io
- [MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/), MCP blog, 2026-01-26
- [ext-apps SDK and spec repository](https://github.com/halllo/mcp-ext-apps)
- [Feature request #88881: render MCP Apps for locally configured servers](https://github.com/anthropics/claude-code/issues/88881)
- [Issue #33732: separate MCP registries in Claude Code and Claude Desktop](https://github.com/anthropics/claude-code/issues/33732)
- [ext-apps issue #671: views not rendering via mcp-remote](https://github.com/modelcontextprotocol/ext-apps/issues/671)
- [Elastic Security MCP App](https://github.com/elastic/example-mcp-app-security), a reference implementation
- [Getting started with local MCP servers on Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
