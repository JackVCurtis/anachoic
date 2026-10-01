import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const client = new Client({ name: 'probe-smoke', version: '0.0.1' })
await client.connect(new StdioClientTransport({ command: 'node', args: ['dist/server.js'], stderr: 'ignore' }))
const { tools } = await client.listTools()
console.log(tools.map((t) => `${t.name} ${JSON.stringify(t._meta ?? {})}`).join('\n'))
const whoami = await client.callTool({ name: 'probe_whoami', arguments: {} })
console.log(whoami.content[0].text.slice(0, 600))
console.log(JSON.stringify(await client.callTool({ name: 'probe_view', arguments: { note: 'smoke' } })).slice(0, 300))
const res = await client.readResource({ uri: 'ui://anachoic-probe/csp-data.html' })
console.log(res.contents[0].mimeType, res.contents[0].text.length, JSON.stringify(res.contents[0]._meta))
console.log((await client.callTool({ name: 'probe_sqlite', arguments: { label: 'smoke' } })).content[0].text)
await client.close()
