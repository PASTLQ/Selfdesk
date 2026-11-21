import { useSyncExternalStore } from 'react'
import type { State, Task, Ev, Habit, Note, Settings, Review, Data } from './types'
import { emptyData, normalize } from './core/merge'
import { uid, today, addDays, addMonths } from './lib/date'

const KEY = 'selfdesk.v1'
export const defaultSettings: Settings = { theme: 'auto', dayStart: 7, dayEnd: 23, gClientId: '', gSync: false, ghToken: '', ghRepo: '', ghPath: 'data.json', ghBranch: '' }
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
  const tasks = col(prev.tasks, next.tasks), events = col(prev.events, next.events), habits = col(prev.habits, next.habits), notes = col(prev.notes, next.notes)
  let reviews = next.reviews
  if (prev.reviews !== next.reviews) { reviews = Object.fromEntries(Object.entries(next.reviews).map(([k, v]) => { if (prev.reviews[k] === v) return [k, v]; changed = true; return [k, { ...v, u: now }] })) }
  if (next.projects !== prev.projects) changed = true
  return { s: { ...next, tasks, events, habits, notes, reviews, deleted }, changed }
}
export function set(fn: (s: State) => State) {
  const { s, changed } = stamp(state, fn(state)); state = s; persist(); subs.forEach(f => f()); if (changed) syncHooks.forEach(f => f())
}
/** 同期で取り込んだデータの反映(更新時刻は付け直さない) */
export function applyRemote(d: Data) { state = { ...state, ...d }; persist(); subs.forEach(f => f()) }
export const syncData = (): Data => { const { tasks, events, habits, notes, reviews, projects, deleted } = state; return { version: 1, tasks, events, habits, notes, reviews, projects, deleted } }
export const get = () => state
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, () => sel(state))
}
export const replaceAll = (s: Partial<State>) => set(cur => ({ ...cur, ...normalize(s as Data), tasks: s.tasks || [], events: s.events || [], habits: s.habits || [], notes: s.notes || [] }))

/* ---- tasks ---- */
export function newTask(p: Partial<Task> & { title: string }): Task {
  return { id: uid(), notes: '', done: false, priority: 0, project: '', tags: [], repeat: null, subs: [], createdAt: new Date().toISOString(), ...p }
}
export const addTask = (p: Partial<Task> & { title: string }) => { const t = newTask(p); set(s => ({ ...s, tasks: [t, ...s.tasks], projects: t.project && !s.projects.includes(t.project) ? [...s.projects, t.project] : s.projects })); return t }
export const patchTask = (id: string, p: Partial<Task>) => set(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...p } : t) }))
export const delTask = (id: string) => set(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }))
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

/* ---- misc ---- */
export const setReview = (key: string, r: Partial<Review>) => set(s => ({ ...s, reviews: { ...s.reviews, [key]: { ...({ wins: '', lessons: '', next: '', mood: 3 } as Review), ...s.reviews[key], ...r } } }))
export const setSettings = (p: Partial<Settings>) => set(s => ({ ...s, settings: { ...s.settings, ...p } }))
