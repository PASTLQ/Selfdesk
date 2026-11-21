import type { Data } from '../types'
import { normalize } from './merge'

export interface GhCfg { token: string; repo: string; path: string; branch?: string; api?: string }
export class ConflictError extends Error { constructor() { super('conflict') } }

const b64enc = (s: string) => { const u = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(bin) }
const b64dec = (s: string) => { const bin = atob(s.replace(/\n/g, '')); const u = Uint8Array.from(bin, c => c.charCodeAt(0)); return new TextDecoder().decode(u) }
const url = (c: GhCfg, tail: string) => `${c.api || 'https://api.github.com'}/repos/${c.repo}${tail ? '/' + tail : ''}`
const hdr = (c: GhCfg) => ({ Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' })
const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/')

async function fail(r: Response, what: string): Promise<never> {
  let m = ''; try { m = (await r.json()).message } catch { /* */ }
  if (r.status === 401) throw new Error('GitHubトークンが無効です(401)')
  if (r.status === 403) throw new Error('GitHubへのアクセスが拒否されました(403)。トークンの権限と、レート制限を確認してください')
  if (r.status === 404) throw new Error('リポジトリが見つかりません(404)。リポジトリ名と、トークンがそのリポジトリに許可されているかを確認してください')
  throw new Error(`${what}に失敗しました (${r.status}) ${m}`)
}
export function validate(c: GhCfg) {
  if (!c.token) throw new Error('GitHubトークンが未設定です'); if (!/^[\w.-]+\/[\w.-]+$/.test(c.repo)) throw new Error('リポジトリは「owner/repo」の形式で指定してください')
}
/** data.json を読む。無ければ null。 */
export async function readRemote(c: GhCfg): Promise<{ data: Data; sha: string } | null> {
  validate(c)
  const q = c.branch ? `?ref=${encodeURIComponent(c.branch)}` : ''
  const r = await fetch(url(c, `contents/${enc(c.path)}${q}`), { headers: hdr(c), cache: 'no-store' })
  if (r.status === 404) {
    // リポジトリ自体の存在確認(ファイルだけ無いのか、リポジトリが無いのか)
    const rr = await fetch(url(c, ''), { headers: hdr(c), cache: 'no-store' }); if (!rr.ok) return fail(rr, 'リポジトリの確認')
    return null
  }
  if (!r.ok) return fail(r, '読み込み')
  const j = await r.json(); let text: string
  if (j.content && j.encoding === 'base64') text = b64dec(j.content)
  else { const br = await fetch(url(c, `git/blobs/${j.sha}`), { headers: { ...hdr(c), Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' }); if (!br.ok) return fail(br, '大きなファイルの読み込み'); text = await br.text() }
  return { data: normalize(JSON.parse(text)), sha: j.sha }
}
export async function writeRemote(c: GhCfg, data: Data, sha: string | undefined, message: string): Promise<string> {
  validate(c)
  const body: any = { message, content: b64enc(JSON.stringify(data, null, 1)) }; if (sha) body.sha = sha; if (c.branch) body.branch = c.branch
  const r = await fetch(url(c, `contents/${enc(c.path)}`), { method: 'PUT', headers: { ...hdr(c), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (r.status === 409 || r.status === 422) throw new ConflictError()
  if (!r.ok) return fail(r, '書き込み')
  return (await r.json()).content.sha
}
