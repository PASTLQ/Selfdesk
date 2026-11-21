import { promises as fs } from 'node:fs'
import type { Data } from '../../src/types'
import { emptyData, normalize, sig } from '../../src/core/merge'
import type { GhCfg } from '../../src/core/github'
import { githubIO } from './github-io'
import type { IO } from './io'

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
function fileIO(file: string): IO {
  const mutate = async <T>(fn: (d: Data) => T): Promise<T> => {
    let data: Data; try { data = normalize(JSON.parse(await fs.readFile(file, 'utf8'))) } catch (e: any) { if (e.code !== 'ENOENT') throw e; data = emptyData() }
    const before = sig(data); const result = fn(data)
    if (sig(data) !== before) { const tmp = file + '.tmp'; await fs.writeFile(tmp, JSON.stringify(data, null, 1)); await fs.rename(tmp, file) }
    return result
  }
  return { mutate, read: fn => mutate(fn) }
}
export const nodeIO = (): IO => process.env.SELFDESK_FILE ? fileIO(process.env.SELFDESK_FILE) : githubIO(ghCfg)
