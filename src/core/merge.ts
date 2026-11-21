import type { Data } from '../types'

export const emptyData = (): Data => ({ version: 1, tasks: [], events: [], habits: [], notes: [], reviews: {}, projects: ['仕事', '個人'], deleted: {} })
export const normalize = (d: Partial<Data> | null | undefined): Data => ({ ...emptyData(), ...(d || {}), version: 1, deleted: { ...(d?.deleted || {}) } })

function col<T extends { id: string; u?: number }>(a: T[], b: T[], del: Record<string, number>): T[] {
  const m = new Map<string, T>()
  for (const x of [...a, ...b]) { const y = m.get(x.id); if (!y || (x.u || 0) > (y.u || 0)) m.set(x.id, x) }
  return [...m.values()].filter(x => !(del[x.id] !== undefined && del[x.id] >= (x.u || 0)))
}
/** 端末AとBのデータを、項目ごとの更新時刻(u)が新しい方を採用して統合する。削除は deleted に時刻を残して伝播する。 */
export function mergeData(a: Data, b: Data): Data {
  const deleted: Record<string, number> = { ...a.deleted }
  for (const [k, v] of Object.entries(b.deleted || {})) deleted[k] = Math.max(deleted[k] || 0, v)
  const reviews: Data['reviews'] = { ...a.reviews }
  for (const [k, v] of Object.entries(b.reviews || {})) if (!reviews[k] || (v.u || 0) > (reviews[k].u || 0)) reviews[k] = v
  return {
    version: 1, deleted, reviews,
    tasks: col(a.tasks, b.tasks, deleted), events: col(a.events, b.events, deleted),
    habits: col(a.habits, b.habits, deleted), notes: col(a.notes, b.notes, deleted),
    projects: [...new Set([...a.projects, ...b.projects])],
  }
}
/** 並び順に依存しない比較用の署名 */
export function sig(d: Data): string {
  const byId = <T extends { id: string }>(x: T[]) => [...x].sort((p, q) => p.id.localeCompare(q.id))
  const keys = (o: object) => Object.fromEntries(Object.entries(o).sort(([p], [q]) => p.localeCompare(q)))
  return JSON.stringify([byId(d.tasks), byId(d.events), byId(d.habits), byId(d.notes), keys(d.reviews), [...d.projects].sort(), keys(d.deleted)])
}
