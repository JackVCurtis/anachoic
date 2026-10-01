import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  McpServer,
  type CallToolResult,
  type ServerContext,
} from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PROBE_DATA_DIR ?? path.join(HERE, "..", ".data");
const VIEW_HTML = path.join(HERE, "view.html");
const PROBE_RUN = Math.random().toString(36).slice(2, 8);
fs.mkdirSync(DATA_DIR, { recursive: true });

function log(event: string, data: Record<string, unknown> = {}) {
  const line = {
    t: new Date().toISOString(),
    run: PROBE_RUN,
    pid: process.pid,
    event,
    ...data,
  };
  fs.appendFileSync(
    path.join(DATA_DIR, "calls.jsonl"),
    JSON.stringify(line) + "\n",
  );
  console.error(JSON.stringify(line));
}

function interestingEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) =>
        /CLAUDE|MCP|SESSION|ANTHROPIC|TERM_PROGRAM|^PWD$/.test(k) &&
        !/KEY|TOKEN|SECRET/.test(k),
    ),
  );
}

async function sqliteProbe() {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    return typeof DatabaseSync === "function"
      ? "available"
      : "missing DatabaseSync";
  } catch (error) {
    return `unavailable: ${(error as Error).message}`;
  }
}

log("start", {
  node: process.version,
  execPath: process.execPath,
  ppid: process.ppid,
  argv: process.argv,
  cwd: process.cwd(),
  dataDir: DATA_DIR,
  env: interestingEnv(),
});
process.on("exit", (code) => log("exit", { code }));
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => {
    log("signal", { signal });
    process.exit(0);
  });
}

let callCount = 0;

export function createServer() {
  const server = new McpServer({ name: "anachoic-probe", version: "0.0.1" });

  function requestFacts(ctx: ServerContext) {
    return {
      requestId: ctx.mcpReq.id,
      transportSessionId: ctx.sessionId,
      meta: ctx.mcpReq._meta,
      envelope: (ctx.mcpReq as { envelope?: unknown }).envelope,
    };
  }

  function text(value: unknown): CallToolResult["content"] {
    return [
      {
        type: "text",
        text:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ];
  }

  const viewArgs = z.object({
    note: z
      .string()
      .optional()
      .describe("Free text echoed back, to tell views apart"),
  });

  for (const [toolName, uri, csp] of [
    ["probe_view", "ui://anachoic-probe/default.html", undefined],
    [
      "probe_view_csp",
      "ui://anachoic-probe/csp-data.html",
      { resourceDomains: ["data:"] },
    ],
  ] as const) {
    registerAppTool(
      server,
      toolName,
      {
        title: toolName,
        description: `Spike probe. Renders the probe view${csp ? ' with resourceDomains ["data:"] in its CSP' : " with the default CSP"}.`,
        inputSchema: viewArgs,
        _meta: { ui: { resourceUri: uri } },
      },
      async (args, ctx): Promise<CallToolResult> => {
        callCount++;
        const facts = {
          tool: toolName,
          args,
          callCount,
          node: process.version,
          client: server.server.getClientVersion(),
          ...requestFacts(ctx),
        };
        log("tool", facts);
        return {
          content: text(
            `Probe view ${callCount} rendered by server pid ${process.pid}. Note: ${args.note ?? "none"}`,
          ),
          structuredContent: facts,
        };
      },
    );

    registerAppResource(
      server,
      uri,
      uri,
      { mimeType: RESOURCE_MIME_TYPE },
      async () => {
        log("resource", { uri });
        return {
          contents: [
            {
              uri,
              mimeType: RESOURCE_MIME_TYPE,
              text: fs.readFileSync(VIEW_HTML, "utf8"),
              _meta: { ui: { prefersBorder: true, ...(csp ? { csp } : {}) } },
            },
          ],
        };
      },
    );
  }

  registerAppTool(
    server,
    "probe_poll",
    {
      title: "probe_poll",
      description:
        "Spike probe, app only. A view calls it on a timer and reports its own state.",
      inputSchema: z.object({
        viewId: z.string(),
        toolCallId: z.unknown().optional(),
        tick: z.number(),
        visibility: z.string(),
        hasFocus: z.boolean(),
        intersecting: z.boolean().nullable(),
      }),
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args, ctx): Promise<CallToolResult> => {
      log("poll", { args, ...requestFacts(ctx) });
      return {
        content: text({ pid: process.pid, now: Date.now() }),
        structuredContent: { pid: process.pid, now: Date.now() },
      };
    },
  );

  registerAppTool(
    server,
    "probe_view_event",
    {
      title: "probe_view_event",
      description:
        "Spike probe, app only. A view reports something it observed.",
      inputSchema: z.object({
        viewId: z.string(),
        kind: z.string(),
        detail: z.unknown(),
      }),
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args): Promise<CallToolResult> => {
      log("view_event", args);
      return { content: text("ok") };
    },
  );

  server.registerTool(
    "probe_whoami",
    {
      title: "probe_whoami",
      description:
        "Spike probe. Reports what the server can learn about the client, the process and the request.",
      inputSchema: z.object({}),
    },
    async (_args, ctx): Promise<CallToolResult> => {
      const facts = {
        pid: process.pid,
        ppid: process.ppid,
        node: process.version,
        execPath: process.execPath,
        sqlite: await sqliteProbe(),
        client: server.server.getClientVersion(),
        clientCapabilities: server.server.getClientCapabilities(),
        env: interestingEnv(),
        cwd: process.cwd(),
        ...requestFacts(ctx),
      };
      log("whoami", facts);
      return { content: text(facts) };
    },
  );

  server.registerTool(
    "probe_block",
    {
      title: "probe_block",
      description:
        "Spike probe. Waits the given number of seconds before returning, optionally sending progress notifications every 10 seconds.",
      inputSchema: z.object({
        seconds: z.number().int().min(1).max(3600),
        progress: z.boolean().default(false),
      }),
    },
    async (args, ctx): Promise<CallToolResult> => {
      const started = Date.now();
      const progressToken = ctx.mcpReq._meta?.progressToken;
      const signal = (ctx.mcpReq as { signal?: AbortSignal }).signal;
      log("block_start", { args, progressToken, hasSignal: Boolean(signal) });
      let cancelled = false;
      signal?.addEventListener("abort", () => {
        cancelled = true;
        log("block_aborted", { afterSeconds: (Date.now() - started) / 1000 });
      });
      for (let elapsed = 0; elapsed < args.seconds && !cancelled; elapsed++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (
          args.progress &&
          progressToken !== undefined &&
          elapsed % 10 === 9
        ) {
          await ctx.mcpReq.notify({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: elapsed + 1,
              total: args.seconds,
            },
          });
        }
      }
      const seconds = (Date.now() - started) / 1000;
      log("block_end", { seconds, cancelled });
      return {
        content: text(`Blocked for ${seconds}s (cancelled: ${cancelled})`),
      };
    },
  );

  server.registerTool(
    "probe_sqlite",
    {
      title: "probe_sqlite",
      description:
        "Spike probe. Bumps a shared revision in a SQLite database in WAL mode and records which process did it.",
      inputSchema: z.object({
        label: z.string(),
        holdMs: z.number().int().min(0).max(10000).default(0),
      }),
    },
    async (args): Promise<CallToolResult> => {
      const { openProbeDatabase, bump } = await import("./sqlite_probe.ts");
      const db = openProbeDatabase(path.join(DATA_DIR, "probe.sqlite"));
      const result = bump(db, `${args.label} pid ${process.pid}`, args.holdMs);
      db.close();
      log("sqlite", { args, result });
      return { content: text(result) };
    },
  );

  server.server.oninitialized = () => {
    log("initialized", {
      client: server.server.getClientVersion(),
      clientCapabilities: server.server.getClientCapabilities(),
    });
  };

  return server;
}

if (process.argv.includes("--http")) {
  const { createMcpExpressApp } = await import("@modelcontextprotocol/express");
  const { NodeStreamableHTTPServerTransport } =
    await import("@modelcontextprotocol/node");
  const cors = (await import("cors")).default;
  const app = createMcpExpressApp();
  app.use(cors());
  app.all("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, "127.0.0.1", () =>
    log("http", { url: `http://127.0.0.1:${port}/mcp` }),
  );
} else {
  await createServer().connect(new StdioServerTransport());
}
