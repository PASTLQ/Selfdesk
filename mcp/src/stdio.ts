import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './tools'
import { nodeIO, describeBackend } from './storage'

await createServer(nodeIO()).connect(new StdioServerTransport())
console.error(`[selfdesk-mcp] ready (${describeBackend()})`)
