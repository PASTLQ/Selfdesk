/**
 * プロジェクト / タスク の階層ツリー(純粋関数。アプリと MCP の両方が使う)
 * 考え方: プロジェクト・タスク・Todoの境界は見る時間尺度で変わる主観なので、すべて同じ「項目」を親子でつなぐ。
 *   - プロジェクト = isProject な項目(目標 goal と完了条件 doneWhen を持つ)。昇格・降格は isProject の切替だけ。
 *   - 子を持つ項目は「作業のまとまり(WBSの親)」、子を持たない項目が実際に手を動かす「葉」。
 *   - 葉の中の細かい手順は Task.subs(Todo)で表す。
 */
import type { Task } from '../types'

export const childrenOf = (tasks: Task[], id: string | undefined): Task[] =>
  tasks.filter(t => (t.parent ?? undefined) === id).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.createdAt.localeCompare(b.createdAt))
export const hasChildren = (tasks: Task[], id: string) => tasks.some(t => t.parent === id)
/** 親をたどった祖先(近い順) */
export function ancestors(tasks: Task[], id: string): Task[] {
  const m = new Map(tasks.map(t => [t.id, t])); const out: Task[] = []; const seen = new Set([id])
  let cur = m.get(id)?.parent
  while (cur && !seen.has(cur)) { seen.add(cur); const p = m.get(cur); if (!p) break; out.push(p); cur = p.parent }
  return out
}
export function descendants(tasks: Task[], id: string): Task[] {
  const by = new Map<string | undefined, Task[]>(); for (const t of tasks) { const k = t.parent; by.set(k, [...(by.get(k) || []), t]) }
  const out: Task[] = []; const walk = (x: string) => { for (const c of by.get(x) || []) { out.push(c); walk(c.id) } }; walk(id); return out
}
/** その項目が属する最も近いプロジェクト(自分自身は含まない) */
export const projectOf = (tasks: Task[], id: string): Task | undefined => ancestors(tasks, id).find(a => a.isProject)
/** 親にしてよいか(自分や子孫を親にすると循環する) */
export const canMove = (tasks: Task[], id: string, newParent: string | undefined) => !newParent || (newParent !== id && !descendants(tasks, id).some(d => d.id === newParent))
/** 一覧に「やること」として出すか。プロジェクトと、子を持つまとまりは WBS 側で扱うので除く。 */
export const isActionable = (tasks: Task[], t: Task) => !t.isProject && !hasChildren(tasks, t.id)

export interface Rollup { leaves: number; done: number; pct: number; estMin: number; remainMin: number; start?: string; end?: string; overdue: number }
/** 子孫の葉を集計した進捗・見積・期間(葉が無ければ自分自身の完了状態) */
export function rollup(tasks: Task[], id: string, today: string): Rollup {
  const self = tasks.find(t => t.id === id); const ds = descendants(tasks, id)
  const kids = new Set(tasks.map(t => t.parent).filter(Boolean))
  const leaves = ds.filter(d => !kids.has(d.id))
  const items = leaves.length ? leaves : self ? [self] : []
  const done = items.filter(t => t.done).length
  const dates = [...ds, ...(self ? [self] : [])].flatMap(t => [t.start, t.due].filter(Boolean) as string[]).sort()
  return {
    leaves: items.length, done, pct: items.length ? Math.round((done / items.length) * 100) : 0,
    estMin: items.reduce((s, t) => s + (t.est || 0), 0), remainMin: items.filter(t => !t.done).reduce((s, t) => s + (t.est || 0), 0),
    start: dates[0], end: dates[dates.length - 1], overdue: items.filter(t => !t.done && t.due && t.due < today).length,
  }
}
export interface WbsRow { t: Task; depth: number; code: string }
/** WBS(深さ優先)。code は 1.2.3 形式の番号。collapsed に含まれる項目の子は出さない */
export function wbs(tasks: Task[], rootId: string, collapsed: Set<string> = new Set()): WbsRow[] {
  const out: WbsRow[] = []
  const walk = (pid: string, depth: number, prefix: string) => childrenOf(tasks, pid).forEach((c, i) => {
    const code = prefix ? `${prefix}.${i + 1}` : String(i + 1); out.push({ t: c, depth, code })
    if (!collapsed.has(c.id)) walk(c.id, depth + 1, code)
  })
  walk(rootId, 0, ''); return out
}
/** 同じ親の中で末尾に置く order */
export const nextOrder = (tasks: Task[], parent: string | undefined) => Math.max(-1, ...childrenOf(tasks, parent).map(t => t.order ?? 0)) + 1
/** トップレベルのプロジェクト(親プロジェクトを持たない isProject) */
export const rootProjects = (tasks: Task[]) => tasks.filter(t => t.isProject && !projectOf(tasks, t.id))
