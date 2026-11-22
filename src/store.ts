import { useSyncExternalStore } from 'react'
import type { State, Task, Ev, Habit, Note, Settings, Review, Data, Wish, ExtItem } from './types'
import { emptyData, normalize } from './core/merge'
import { nextOrder, canMove, hasChildren } from './core/tree'
import { outlineToTasks } from './core/wbs-outline'
import { resolveRelated, sameRef } from './core/links'
import { uid, today, addDays, addMonths } from './lib/date'

const KEY = 'selfdesk.v1'
export const defaultSettings: Settings = { theme: 'auto', skin: 'quiet', accent: 'indigo', density: 'normal', fontScale: 1, customCss: '', todayOrder: [], todayHidden: [], dayStart: 7, dayEnd: 23, gClientId: '', gSync: false, ghToken: '', ghRepo: '', ghPath: 'data.json', ghBranch: '' }
const empty = (): State => ({ ...emptyData(), gEvents: [], settings: defaultSettings })

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const s = JSON.parse(raw); return { ...empty(), ...normalize(s), gEvents: s.gEvents || [], settings: { ...defaultSettings, ...s.settings } } }
  } catch { /* ignore */ }
  return empty()
}

let state: State = load()
const subs = new Set<() => void>()
const syncHooks = new Set<() => void>()
export const onLocalChange = (f: () => void) => { syncHooks.add(f); return () => { syncHooks.delete(f) } }
let timer: number | undefined
function persist() {
  clearTimeout(timer)
  timer = window.setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { console.warn('save failed', e) } }, 200)
}
/** 変更された項目に更新時刻(u)を付け、削除された項目は deleted に記録する */
function stamp(prev: State, next: State): { s: State; changed: boolean } {
  const now = Date.now(); let deleted = next.deleted; let changed = false
  const col = <T extends { id: string; u?: number }>(a: T[], b: T[]): T[] => {
    if (a === b) return b
    const pm = new Map(a.map(x => [x.id, x])); const ids = new Set(b.map(x => x.id))
    for (const x of a) if (!ids.has(x.id)) { if (deleted === next.deleted) deleted = { ...deleted }; deleted[x.id] = now; changed = true }
    return b.map(x => { if (pm.get(x.id) === x) return x; changed = true; return { ...x, u: now } })
  }
  const tasks = col(prev.tasks, next.tasks), events = col(prev.events, next.events), habits = col(prev.habits, next.habits), notes = col(prev.notes, next.notes), wishes = col(prev.wishes, next.wishes)
  let ext = next.ext
  if (prev.ext !== next.ext) ext = Object.fromEntries([...new Set([...Object.keys(prev.ext), ...Object.keys(next.ext)])].map(k => [k, col(prev.ext[k] || [], next.ext[k] || [])]))
  let reviews = next.reviews
  if (prev.reviews !== next.reviews) { reviews = Object.fromEntries(Object.entries(next.reviews).map(([k, v]) => { if (prev.reviews[k] === v) return [k, v]; changed = true; return [k, { ...v, u: now }] })) }
  return { s: { ...next, tasks, events, habits, notes, wishes, ext, reviews, deleted }, changed }
}
export function set(fn: (s: State) => State) {
  const { s, changed } = stamp(state, fn(state)); state = s; persist(); subs.forEach(f => f()); if (changed) syncHooks.forEach(f => f())
}
/** 同期で取り込んだデータの反映(更新時刻は付け直さない) */
export function applyRemote(d: Data) { state = { ...state, ...d }; persist(); subs.forEach(f => f()) }
export const syncData = (): Data => { const { tasks, events, habits, notes, wishes, ext, reviews, deleted } = state; return { version: 1, tasks, events, habits, notes, wishes, ext, reviews, projects: [], deleted } }
export const get = () => state
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, () => sel(state))
}
export const replaceAll = (s: Partial<State>) => set(cur => ({ ...cur, ...normalize(s as Data), tasks: normalize(s as Data).tasks, events: s.events || [], habits: s.habits || [], notes: s.notes || [] }))

/* ---- tasks / projects (1本の階層ツリー) ---- */
export function newTask(p: Partial<Task> & { title: string }): Task {
  return { id: uid(), notes: '', done: false, priority: 0, tags: [], repeat: null, subs: [], createdAt: new Date().toISOString(), ...p }
}
/** プロジェクトを名前で探す(無ければ作る)。クイック追加の #名前 で使う */
export function projectByName(name: string): Task {
  const ex = get().tasks.find(t => t.isProject && !t.done && t.title === name) ?? get().tasks.find(t => t.isProject && t.title === name)
  if (ex) return ex
  return addTask({ title: name, isProject: true, goal: '', doneWhen: '' })
}
export const addTask = (p: Partial<Task> & { title: string }) => {
  const { project, ...rest } = p
  if (project && !rest.parent) rest.parent = projectByName(project).id
  const t = newTask({ ...rest, order: rest.order ?? nextOrder(get().tasks, rest.parent) })
  set(s => ({ ...s, tasks: [t, ...s.tasks] })); return t
}
/** クイック追加の @名前: 同名のプロジェクト/やりたいことがあれば関連(links)として付け、無ければ自由ラベル(tags)のまま */
export function withRelatedTags(p: Partial<Task>): Partial<Task> {
  if (!p.tags?.length) return p
  const { tasks, wishes } = get(); const links = [...(p.links || [])]; const tags: string[] = []
  for (const g of p.tags) { const r = resolveRelated(tasks, wishes, g); if (!r) tags.push(g); else if (!links.some(x => sameRef(x, r))) links.push(r) }
  return { ...p, tags, links: links.length ? links : p.links }
}
export const patchTask = (id: string, p: Partial<Task>) => set(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...p } : t) }))
/** 親を付け替える。循環する場合は false */
export function moveTask(id: string, parent: string | undefined, order?: number): boolean {
  const ts = get().tasks; if (!canMove(ts, id, parent)) return false
  patchTask(id, { parent, order: order ?? nextOrder(ts.filter(t => t.id !== id), parent) }); return true
}
/** 同じ親の中で上下に動かす(d = -1 / 1) */
export function shiftTask(id: string, d: -1 | 1) {
  const ts = get().tasks; const t = ts.find(x => x.id === id); if (!t) return
  const sib = ts.filter(x => x.parent === t.parent).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.createdAt.localeCompare(b.createdAt))
  const i = sib.findIndex(x => x.id === id), j = i + d; if (j < 0 || j >= sib.length) return
  const ids = sib.map(x => x.id); [ids[i], ids[j]] = [ids[j], ids[i]]
  set(s => ({ ...s, tasks: s.tasks.map(x => ids.includes(x.id) ? { ...x, order: ids.indexOf(x.id) } : x) }))
}
/** 削除。子は1つ上の階層に付け替える(消えない) */
export const delTask = (id: string) => set(s => { const t = s.tasks.find(x => x.id === id); return { ...s, tasks: s.tasks.filter(x => x.id !== id).map(x => x.parent === id ? { ...x, parent: t?.parent } : x) } })
export const promoteProject = (id: string, goal = '', doneWhen = '') => patchTask(id, { isProject: true, goal: get().tasks.find(t => t.id === id)?.goal || goal, doneWhen: get().tasks.find(t => t.id === id)?.doneWhen || doneWhen })
export const demoteProject = (id: string) => patchTask(id, { isProject: false })
/** インデントで書いたWBSを parent の下にまとめて追加する。追加件数を返す */
export function addWbs(parent: string | undefined, text: string): number { const ts = outlineToTasks(text, parent, get().tasks); if (ts.length) set(s => ({ ...s, tasks: [...ts, ...s.tasks] })); return ts.length }
export { hasChildren }
export function toggleTask(id: string) {
  const t = get().tasks.find(x => x.id === id); if (!t) return
  if (!t.done && t.repeat) {
    const base = t.due || today()
    const nd = t.repeat === 'daily' ? addDays(base, 1) : t.repeat === 'weekly' ? addDays(base, 7) : addMonths(base, 1).replace(/-\d\d$/, base.slice(-3))
    patchTask(id, { due: nd, block: t.block ? { ...t.block, date: nd, gid: undefined } : undefined, subs: t.subs.map(x => ({ ...x, done: false })) })
    return
  }
  patchTask(id, { done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined })
}

/* ---- events ---- */
export const addEvent = (e: Partial<Ev> & { title: string; date: string }) => { const ev: Ev = { id: uid(), start: 9 * 60, dur: 60, source: 'local', ...e }; set(s => ({ ...s, events: [...s.events, ev] })); return ev }
export const patchEvent = (id: string, p: Partial<Ev>) => set(s => ({ ...s, events: s.events.map(e => e.id === id ? { ...e, ...p } : e), gEvents: s.gEvents.map(e => e.id === id ? { ...e, ...p } : e) }))
export const delEvent = (id: string) => set(s => ({ ...s, events: s.events.filter(e => e.id !== id), gEvents: s.gEvents.filter(e => e.id !== id) }))
export const setGEvents = (g: Ev[]) => set(s => ({ ...s, gEvents: g }))

/* ---- habits ---- */
export const addHabit = (name: string, days: number[] = [0, 1, 2, 3, 4, 5, 6]) => { const h: Habit = { id: uid(), name, days, log: {}, createdAt: new Date().toISOString() }; set(s => ({ ...s, habits: [...s.habits, h] })); return h }
export const patchHabit = (id: string, p: Partial<Habit>) => set(s => ({ ...s, habits: s.habits.map(h => h.id === id ? { ...h, ...p } : h) }))
export const toggleHabit = (id: string, date: string) => set(s => ({ ...s, habits: s.habits.map(h => { if (h.id !== id) return h; const log = { ...h.log }; if (log[date]) delete log[date]; else log[date] = true; return { ...h, log } }) }))

/* ---- notes ---- */
export function newNote(kind: Note['kind'], title = '', extra: Partial<Note> = {}): Note {
  const now = new Date().toISOString()
  const n: Note = { id: uid(), title, kind, body: '', tree: [], nodes: [], edges: [], strokes: [], tags: [], createdAt: now, updatedAt: now, ...extra }
  if (kind === 'tree' && !n.tree.length) n.tree = [{ id: uid(), text: title || '中心テーマ', parent: null, order: 0 }]
  return n
}
export const addNote = (n: Note) => set(s => ({ ...s, notes: [n, ...s.notes] }))
export const patchNote = (id: string, p: Partial<Note>) => set(s => ({ ...s, notes: s.notes.map(n => n.id === id ? { ...n, ...p, updatedAt: new Date().toISOString() } : n) }))
export const delNote = (id: string) => set(s => ({ ...s, notes: s.notes.filter(n => n.id !== id) }))

/* ---- wishes(やりたいこと) ---- */
export const addWish = (p: Partial<Wish> & { title: string }) => { const w: Wish = { id: uid(), note: '', status: 'someday', tags: [], createdAt: new Date().toISOString(), ...p }; set(s => ({ ...s, wishes: [w, ...s.wishes] })); return w }
export const patchWish = (id: string, p: Partial<Wish>) => set(s => ({ ...s, wishes: s.wishes.map(w => w.id === id ? { ...w, ...p } : w) }))
export const delWish = (id: string) => set(s => ({ ...s, wishes: s.wishes.filter(w => w.id !== id) }))
/** やりたいこと → プロジェクトに昇格。作ったプロジェクトを返す */
export function promoteWish(id: string): Task | undefined {
  const w = get().wishes.find(x => x.id === id); if (!w) return
  if (w.project && get().tasks.some(t => t.id === w.project)) return get().tasks.find(t => t.id === w.project)
  const p = addTask({ title: w.title, isProject: true, goal: w.title, doneWhen: '', notes: w.note, due: /^\d{4}-\d{2}-\d{2}$/.test(w.target || '') ? w.target : undefined, links: [{ kind: 'wish', id: w.id }] })
  patchWish(id, { status: 'planned', project: p.id }); return p
}
export const completeWish = (id: string, reflection?: string) => patchWish(id, { status: 'done', doneAt: new Date().toISOString(), ...(reflection !== undefined ? { reflection } : {}) })

/* ---- ext collections(ツール拡張のデータ) ---- */
export const useCollection = (id: string): ExtItem[] => useStore(s => s.ext[id]) ?? []
export const addExt = (cid: string, v: Record<string, unknown>): ExtItem => { const it: ExtItem = { id: uid(), ...v }; set(s => ({ ...s, ext: { ...s.ext, [cid]: [it, ...(s.ext[cid] || [])] } })); return it }
export const patchExt = (cid: string, id: string, v: Record<string, unknown>) => set(s => ({ ...s, ext: { ...s.ext, [cid]: (s.ext[cid] || []).map(x => x.id === id ? { ...x, ...v } : x) } }))
export const delExt = (cid: string, id: string) => set(s => ({ ...s, ext: { ...s.ext, [cid]: (s.ext[cid] || []).filter(x => x.id !== id) } }))

/* ---- misc ---- */
export const setReview = (key: string, r: Partial<Review>) => set(s => ({ ...s, reviews: { ...s.reviews, [key]: { ...({ wins: '', lessons: '', next: '', mood: 3 } as Review), ...s.reviews[key], ...r } } }))
export const setSettings = (p: Partial<Settings>) => set(s => ({ ...s, settings: { ...s.settings, ...p } }))
