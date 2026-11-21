import type { Data } from '../../src/types'
import { emptyData, sig } from '../../src/core/merge'
import { readRemote, writeRemote, ConflictError, type GhCfg } from '../../src/core/github'
import type { IO } from './io'

/** GitHub の data.json を読み書きする IO。Node にも Cloudflare Workers にも依存しない(fetch のみ)。 */
export function githubIO(cfg: () => GhCfg): IO {
  const mutate = async <T>(fn: (d: Data) => T, message = 'SelfDesk MCP'): Promise<T> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const c = cfg(); const r = await readRemote(c); const data = r?.data ?? emptyData()
      const before = sig(data); const result = fn(data)
      if (sig(data) === before) return result
      try { await writeRemote(c, data, r?.sha, message); return result } catch (e) { if (e instanceof ConflictError) continue; throw e }
    }
    throw new Error('他の端末の更新と競合し続けています。少し待ってからもう一度お試しください')
  }
  return { mutate, read: fn => mutate(fn) }
}
