import { promises as fs } from 'node:fs'
import type { Data } from '../../src/types'
import { emptyData, normalize, sig } from '../../src/core/merge'
import { readRemote, writeRemote, ConflictError, type GhCfg } from '../../src/core/github'

/** データの置き場所。GitHub(推奨・アプリと共有)またはローカルファイル。 */
export function describeBackend(): string {
  const e = process.env
  return e.SELFDESK_FILE ? `file:${e.SELFDESK_FILE}` : `github:${e.SELFDESK_REPO}/${e.SELFDESK_PATH || 'data.json'}`
}
function ghCfg(): GhCfg {
  const e = process.env
  if (!e.SELFDESK_GITHUB_TOKEN || !e.SELFDESK_REPO) throw new Error('環境変数 SELFDESK_GITHUB_TOKEN と SELFDESK_REPO(owner/repo)を設定してください。ローカルファイルで試すだけなら SELFDESK_FILE=/path/to/data.json でも動きます')
  return { token: e.SELFDESK_GITHUB_TOKEN, repo: e.SELFDESK_REPO, path: e.SELFDESK_PATH || 'data.json', branch: e.SELFDESK_BRANCH || undefined, api: e.SELFDESK_API || undefined }
}

/** 最新データを読み、fn で変更し、変更があれば書き戻す。GitHub側で競合したら読み直して再実行する。 */
export async function mutate<T>(fn: (d: Data) => T, message = 'SelfDesk MCP'): Promise<T> {
  const file = process.env.SELFDESK_FILE
  for (let attempt = 0; attempt < 5; attempt++) {
    let data: Data, sha: string | undefined
    if (file) { try { data = normalize(JSON.parse(await fs.readFile(file, 'utf8'))) } catch (e: any) { if (e.code !== 'ENOENT') throw e; data = emptyData() } }
    else { const r = await readRemote(ghCfg()); data = r?.data ?? emptyData(); sha = r?.sha }
    const before = sig(data); const result = fn(data)
    if (sig(data) === before) return result
    if (file) { const tmp = file + '.tmp'; await fs.writeFile(tmp, JSON.stringify(data, null, 1)); await fs.rename(tmp, file); return result }
    try { await writeRemote(ghCfg(), data, sha, message); return result } catch (e) { if (e instanceof ConflictError) continue; throw e }
  }
  throw new Error('他の端末の更新と競合し続けています。少し待ってからもう一度お試しください')
}
export const read = <T>(fn: (d: Data) => T): Promise<T> => mutate(fn)
