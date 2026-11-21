import { useMemo } from 'react'
import { useStore } from '../store'
import type { Task } from '../types'
import { ancestors, isActionable, rollup, rootProjects, childrenOf } from '../core/tree'
import { today } from './date'

/** 各タスクが属するプロジェクト名(最も近い祖先プロジェクト)。tasks が変わった時だけ再計算する */
let lastTasks: Task[] | null = null; let lastMap = new Map<string, Task>()
export function projectMap(tasks: Task[]): Map<string, Task> {
  if (tasks === lastTasks) return lastMap
  const by = new Map(tasks.map(t => [t.id, t])); const m = new Map<string, Task>()
  for (const t of tasks) { let c = t.parent; const seen = new Set([t.id]); while (c && !seen.has(c)) { seen.add(c); const p = by.get(c); if (!p) break; if (p.isProject) { m.set(t.id, p); break } c = p.parent } }
  lastTasks = tasks; lastMap = m; return m
}
export const useProjectOf = () => { const tasks = useStore(s => s.tasks); return (id: string) => projectMap(tasks).get(id) }
/** 「やること」として一覧に出すタスク */
export const useActionable = () => { const tasks = useStore(s => s.tasks); return useMemo(() => tasks.filter(t => isActionable(tasks, t)), [tasks]) }
export const useProjects = () => {
  const tasks = useStore(s => s.tasks)
  return useMemo(() => { const td = today(); return rootProjects(tasks).filter(p => !p.archived).map(p => ({ p, r: rollup(tasks, p.id, td), subs: childrenOf(tasks, p.id).filter(c => c.isProject).length })) }, [tasks])
}
export const crumbs = (tasks: Task[], id: string) => ancestors(tasks, id).reverse()

/** 親の選択肢(階層をインデントで表示)。exclude とその子孫は循環するので除く */
export function parentOptions(tasks: Task[], exclude?: string): { id: string; label: string }[] {
  const skip = new Set<string>(); if (exclude) { skip.add(exclude); const grow = (id: string) => tasks.filter(t => t.parent === id).forEach(c => { skip.add(c.id); grow(c.id) }); grow(exclude) }
  const out: { id: string; label: string }[] = []
  const walk = (pid: string | undefined, depth: number) => childrenOf(tasks, pid).forEach(c => { if (skip.has(c.id) || c.done && !c.isProject) return; out.push({ id: c.id, label: '　'.repeat(depth) + (c.isProject ? '◆ ' : '') + c.title }); walk(c.id, depth + 1) })
  walk(undefined, 0); return out
}
