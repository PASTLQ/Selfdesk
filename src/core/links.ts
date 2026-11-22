/**
 * タグ = プロジェクト・やりたいこと自体を項目に付ける(Task.links)。純粋関数(アプリと MCP の両方が使う)。
 * 階層(parent)とは別の「横のつながり」。例: 「旅費を調べる」に やりたいこと「下呂温泉に行く」を付ける。
 */
import type { Ref, Task, Wish } from '../types'

export interface RelItem { ref: Ref; title: string; kind: 'project' | 'wish'; done: boolean }
export const REL_KINDS = ['project', 'wish'] as const

export const sameRef = (a: Ref, b: Ref) => a.kind === b.kind && a.id === b.id

/** 付けられる候補: アーカイブしていないプロジェクトと、やりたいこと */
export function relatedChoices(tasks: Task[], wishes: Wish[]): RelItem[] {
  return [
    ...tasks.filter(t => t.isProject && !t.archived).map<RelItem>(t => ({ ref: { kind: 'project', id: t.id }, title: t.title, kind: 'project', done: t.done })),
    ...wishes.map<RelItem>(w => ({ ref: { kind: 'wish', id: w.id }, title: w.title, kind: 'wish', done: w.status === 'done' })),
  ]
}

/** 項目に付いている関連。指す先が消えている参照は出さない */
export function relatedOf(tasks: Task[], wishes: Wish[], t: Pick<Task, 'links'>): RelItem[] {
  const out: RelItem[] = []
  for (const r of t.links || []) {
    if (r.kind === 'project') { const p = tasks.find(x => x.id === r.id && x.isProject); if (p) out.push({ ref: r, title: p.title, kind: 'project', done: p.done }) }
    else if (r.kind === 'wish') { const w = wishes.find(x => x.id === r.id); if (w) out.push({ ref: r, title: w.title, kind: 'wish', done: w.status === 'done' }) }
  }
  return out
}

/** ID か 名前(完全一致。プロジェクト優先)から参照を作る。見つからなければ undefined */
export function resolveRelated(tasks: Task[], wishes: Wish[], key: string): Ref | undefined {
  const k = key.trim(); if (!k) return undefined
  const p = tasks.find(t => t.isProject && t.id === k) ?? tasks.find(t => t.isProject && !t.archived && t.title === k)
  if (p) return { kind: 'project', id: p.id }
  const w = wishes.find(x => x.id === k) ?? wishes.find(x => x.title === k)
  return w ? { kind: 'wish', id: w.id } : undefined
}

/** その関連が付いている項目(プロジェクト・やりたいこと側から「付いているタスク」を引く) */
export const tasksRelatedTo = (tasks: Task[], ref: Ref): Task[] => tasks.filter(t => (t.links || []).some(r => sameRef(r, ref)))

/** 付ける/外すを切り替えた新しい配列(元の配列は変えない) */
export function toggleRef(links: Ref[] | undefined, ref: Ref): Ref[] {
  const cur = links || []
  return cur.some(r => sameRef(r, ref)) ? cur.filter(r => !sameRef(r, ref)) : [...cur, { kind: ref.kind, id: ref.id }]
}

/** 関連以外の links(コレクション項目などへの参照)を保ったまま、関連だけを差し替える */
export function withRelated(links: Ref[] | undefined, related: Ref[]): Ref[] {
  return [...(links || []).filter(r => !(REL_KINDS as readonly string[]).includes(r.kind)), ...related.map(r => ({ kind: r.kind, id: r.id }))]
}
