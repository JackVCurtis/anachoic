# Desktop checklist for the MCP Apps spike

These steps cover the parts of spikes MCP-01, MCP-02, MCP-03 and UIF-01 that need Claude desktop **chat**, which is not the Code tab. The probe logs every call, every view event and every poll to `probes/.data/calls.jsonl`, so you don't need to write anything down. Just do the steps and tell Claude when you're done. Note anything you see that the log can't capture, such as a view that never appears.

## A. Install

1. Double-click `probes/anachoic-probe.mcpb`, or drag it into Settings > Extensions. Install it, then make sure it is enabled.
2. Open a **new chat**.

## B. In that chat, send these one at a time

1. `Call probe_view with note "first".`
   - Note whether a view appears inline, or only text.
   - Note which of the four font lines are drawn in Barlow and which in a fallback.
2. `Call probe_view_csp with note "csp".`
3. `Call probe_view with note "third".`
4. In the **third** view, click **updateModelContext**, then send: `What is the secret word from the probe?`
5. In the third view, click **sendMessage**. Note whether a message is posted and whether Claude replies without you typing.
6. In the third view, click **fullscreen**, then **inline**, then **pip**, then **inline**, then **openLink**.
7. `List every tool you can call from the anachoic-probe server, by exact name.`
8. `Call probe_whoami.`
9. Scroll the first view off screen for a minute. Then switch to another chat for a minute and come back.

## C. A second chat

1. Open another new chat and send `Call probe_whoami.` The log shows whether both chats share one server process.
2. Quit Claude desktop completely and reopen it. Open the first chat again and scroll to the views. Note whether they reappear and whether they are live.

## D. Only if no view rendered in step B1

1. Disable the extension.
2. Add this entry under `mcpServers` in `~/Library/Application Support/Claude/claude_desktop_config.json`:

   ```json
   "anachoic-probe": {
     "command": "/Users/jack/.asdf/installs/nodejs/24.21.0/bin/node",
     "args": ["/Users/jack/code/personal/anachoic-mcp-app/docs/spikes/mcp-apps/probes/dist/server.js"]
   }
   ```

3. Restart Claude desktop, and repeat steps B1 to B3.
