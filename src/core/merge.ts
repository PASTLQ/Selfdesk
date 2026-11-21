import type { Data, Task, ExtItem } from '../types'

export const emptyData = (): Data => ({ version: 1, tasks: [], events: [], habits: [], notes: [], wishes: [], ext: {}, reviews: {}, projects: [], deleted: {} })

/** 旧プロジェクト名 → 決定的なID(どの端末で移行しても同じIDになり、重複しない) */
export function legacyProjectId(name: string): string {
  let h = 2166136261; for (const ch of name) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619) }
  return 'p_' + (h >>> 0).toString(36)
}
/** 旧 Task.project(文字列) を、親プロジェクト(parent)に移行する。何度実行しても結果は同じ。 */
function migrate(d: Data): Data {
  if (!d.tasks.some(t => t.project)) return d
  const nodes = new Map<string, Task>(); const byId = new Set(d.tasks.map(t => t.id))
  const tasks = d.tasks.map(t => {
    if (!t.project) return t
    const id = legacyProjectId(t.project)
    if (!byId.has(id) && !nodes.has(id) && d.deleted[id] === undefined) nodes.set(id, { id, title: t.project, notes: '', done: false, priority: 0, tags: [], repeat: null, subs: [], createdAt: t.createdAt, isProject: true, goal: '', doneWhen: '' })
    const { project: _p, ...rest } = t
    return d.deleted[id] === undefined ? { ...rest, parent: t.parent ?? id } : rest
  })
  return { ...d, tasks: [...tasks, ...nodes.values()] }
}
export const normalize = (d: Partial<Data> | null | undefined): Data => migrate({ ...emptyData(), ...(d || {}), version: 1, deleted: { ...(d?.deleted || {}) }, wishes: d?.wishes || [], ext: { ...(d?.ext || {}) }, projects: [] })

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
  const ext: Record<string, ExtItem[]> = {}
  for (const k of new Set([...Object.keys(a.ext || {}), ...Object.keys(b.ext || {})])) ext[k] = col(a.ext?.[k] || [], b.ext?.[k] || [], deleted)
  return {
    version: 1, deleted, reviews, ext,
    tasks: col(a.tasks, b.tasks, deleted), events: col(a.events, b.events, deleted),
    habits: col(a.habits, b.habits, deleted), notes: col(a.notes, b.notes, deleted), wishes: col(a.wishes || [], b.wishes || [], deleted),
    projects: [],
  }
}
/** 並び順に依存しない比較用の署名 */
export function sig(d: Data): string {
  const byId = <T extends { id: string }>(x: T[]) => [...x].sort((p, q) => p.id.localeCompare(q.id))
  const keys = (o: object) => Object.fromEntries(Object.entries(o).sort(([p], [q]) => p.localeCompare(q)))
  const ext = Object.fromEntries(Object.entries(d.ext || {}).sort(([p], [q]) => p.localeCompare(q)).map(([k, v]) => [k, byId(v)]))
  return JSON.stringify([byId(d.tasks), byId(d.events), byId(d.habits), byId(d.notes), byId(d.wishes || []), ext, keys(d.reviews), keys(d.deleted)])
}
