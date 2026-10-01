# 02. Stack and structure

## Versions

The versions are pinned in `package.json` and `.tool-versions`. Each of these was used in the spike.

| Piece | Version | Why |
|---|---|---|
| Node | 24.21.0, in `.tool-versions` and `engines` | Desktop's bundled runtime reports 24.21.0, so development matches what the `.mcpb` runs on. It also has `node:sqlite`. |
| pnpm | 11.13.1, in `packageManager` | The same as anachoic. Build scripts are allowed per package in `pnpm-workspace.yaml` (`allowBuilds: { esbuild: true }`). |
| TypeScript | ~6.0.3 | The same as anachoic |
| `@modelcontextprotocol/server` | 2.x | The split SDK that ext-apps 2 pairs with |
| `@modelcontextprotocol/ext-apps` | 2.0.3 | `registerAppTool` and `registerAppResource` on the server. `App` and the React hooks in the view. |
| zod | ^4.2 | Tool input and output schemas |
| React and react-dom | ^19.3 | The same as anachoic |
| Vite with vite-plugin-singlefile | ^8 and ^2.3 | One self-contained HTML file per view |
| esbuild | ^0.28, called through its JavaScript API | One bundled server file. The CLI shim fails under pnpm 11 ([spike notes](../spikes/mcp-apps/notes.md#3-sdk-view-and-build-pipeline)). |
| `@fontsource/barlow`, `@fontsource/barlow-condensed` | ^5.3 | Inlined into each view as `data:` fonts |
| lucide-react | ^1.48 | Only inside the Icon primitive, as in anachoic |
| Vitest, Storybook, Playwright | As anachoic: Vitest ~4.1, Storybook 10.6, Playwright 1.63 | Copied tooling ([09](09-testing-and-build-order.md)) |
| `@anthropic-ai/mcpb` | ^2.1 | Validating and packing the extension |
| `@modelcontextprotocol/client` | 2.x, development only | End-to-end tests drive the server as a real client |
| `@modelcontextprotocol/express`, `@modelcontextprotocol/node`, express, cors | 2.x, 2.x, ^5, ^2.8 | The `--http` flag for the reference host ([08](08-packaging-and-hosts.md#development-loop)). Loaded with a dynamic `import()` only when the flag is given, so the stdio path never touches them. |

The database uses `node:sqlite`, which is built into Node. `better-sqlite3` is not used, because a native module would have to be built for desktop's bundled runtime.

## Folders

```text
server/           the MCP server: entry, tool and resource registration, results, text formatting
  tools/          one file per tool or per small family of tools
  props/          builds view props from the domain (the facts)
  text/           builds each tool's text result
domain/           pure rules: types, state machines, queue order, derived facts. No I/O.
store/            SQLite: connection, migrations, repositories, services that open transactions
shared/           code imported by server and view alike: prop types, ids, constants
view/
  components/     the component library, laid out as anachoic's (07)
  css/            app.css, fonts.css, tokens.css, base.css, typography.css
  entries/        one folder per view: board/, task/. Each has index.html and main.tsx.
  bridge/         the host bridge: App connection, host context store, tool callers
tests/
  unit/           domain and store, run in Node
  integration/    server through an MCP client, several processes against one database
  e2e/            views in the reference host, driven by Playwright
docs/
  architecture/   these documents
  spikes/         spike notes and probes
todos/            the build plan, one YAML file per todo, and order.csv
```

**Dependency direction.** `view/` may import `shared/` only. `server/` may import `domain/`, `store/` and `shared/`. `domain/` imports nothing outside itself and `shared/`. Lint enforces each rule ([09](09-testing-and-build-order.md#lint)).

Inside `view/components/` the layer rules from anachoic `eslint/component_rules.js` apply unchanged. Components may not import `@modelcontextprotocol/*`, `view/bridge/` or `view/entries/`.

## The two builds

| Build | Tool | Output |
|---|---|---|
| Views | Vite, with `@vitejs/plugin-react` and `vite-plugin-singlefile`, run once per entry | `dist/views/board.html`, `dist/views/task.html`, with all script, CSS and fonts inlined |
| Server | esbuild's JavaScript API, bundled to ESM for Node 24, with a `createRequire` banner | `dist/server.js` |

The server reads each view's HTML from `dist/views/` beside itself when a host reads the `ui://` resource. The `.mcpb` packs `dist/` ([08](08-packaging-and-hosts.md)).

`pnpm build` runs both builds. `pnpm dev` rebuilds both on change, and the reference host serves them ([08](08-packaging-and-hosts.md#development-loop)).

## Copied files

Anything taken from `anachoic/` is copied, not imported. After the copy, the two repos change independently.

- Each copied file starts with a one-line comment that names its source path and the anachoic commit it was copied from, for example `// Copied from anachoic inertia/components/primitives/tag/tag.tsx at fd99e0d`. Stories, tests and CSS modules carry the same line in their own comment syntax.
- A copy may be changed after it is made. If it is changed, the comment stays but no longer means "identical".
- [07](07-ui-port.md) lists what is copied and what departs.

## Scripts

| Script | Does |
|---|---|
| `build` | Both builds |
| `dev` | Watches both builds |
| `pack` | Run as `pnpm run pack`, because `pnpm pack` is pnpm's own command. `build`, then `mcpb validate` and `mcpb pack` into `anachoic.mcpb` |
| `typecheck` | tsc on the root and on `view/` |
| `lint` | eslint |
| `test` | All suites |
| `test:unit`, `test:integration`, `test:ui`, `test:e2e` | One suite each |
| `storybook` | Storybook on 127.0.0.1:6006 |
