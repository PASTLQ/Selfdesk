/**
 * リモート版 MCP サーバー(Cloudflare Workers)。
 * claude.ai / スマホアプリの「カスタムコネクタ」から使える。URL は https://<worker>/<SELFDESK_MCP_SECRET>/mcp
 * 認証はURL内の秘密文字列(推測不能な長いランダム値)。漏れたら SELFDESK_MCP_SECRET を変えて再デプロイする。
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createServer } from './tools'
import { githubIO } from './github-io'

interface Env { SELFDESK_GITHUB_TOKEN: string; SELFDESK_REPO: string; SELFDESK_MCP_SECRET: string; SELFDESK_PATH?: string; SELFDESK_BRANCH?: string; SELFDESK_API?: string }

const same = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0 }
const text = (s: string, status: number) => new Response(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const secret = env.SELFDESK_MCP_SECRET
    if (!secret || secret.length < 24) return text('SELFDESK_MCP_SECRET が未設定、または短すぎます(24文字以上)', 500)
    const [, key, tail] = new URL(req.url).pathname.split('/')
    if (!key || tail !== 'mcp' || !same(key, secret)) return text('Not found', 404)   // 秘密が違うときは存在を明かさない
    if (req.method !== 'POST') return text('POST のみ対応(ステートレス)', 405)
    if (!env.SELFDESK_GITHUB_TOKEN || !env.SELFDESK_REPO) return text('SELFDESK_GITHUB_TOKEN / SELFDESK_REPO が未設定です', 500)
    const io = githubIO(() => ({ token: env.SELFDESK_GITHUB_TOKEN, repo: env.SELFDESK_REPO, path: env.SELFDESK_PATH || 'data.json', branch: env.SELFDESK_BRANCH || undefined, api: env.SELFDESK_API || undefined }))
    const server = createServer(io); const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    try { return await transport.handleRequest(req) } finally { await transport.close().catch(() => {}); await server.close().catch(() => {}) }
  },
}
