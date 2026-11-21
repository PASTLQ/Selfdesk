import { useState } from 'react'
import { useStore, addTask } from '../store'
import { useActionable, useProjects } from '../lib/projects'
import { fmtShort } from '../lib/date'
import { parseQuick } from '../lib/quick'
import { today, hm, dow } from '../lib/date'
import { TaskRow } from '../views/Tasks'
import { HabitChecks } from '../views/Habits'
import { registerWidget } from '../registry'
import { openTask } from '../ui-state'
import { go } from '../route'
import { descendants } from '../core/tree'

/** 「今日」画面の共通データ。ウィジェットから使える(自作ウィジェットも useToday() で同じ値を取れる) */
export function useToday() {
  const tasks = useActionable(); const events = useStore(s => s.events); const g = useStore(s => s.gEvents); const habits = useStore(s => s.habits)
  const td = today()
  const list = tasks.filter(t => !t.done && ((t.due && t.due <= td) || t.block?.date === td))
  const doneToday = tasks.filter(t => t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString()).length
  const tl = [
    ...tasks.filter(t => t.block?.date === td).map(t => ({ k: 't' + t.id, s: t.block!.start, d: t.block!.dur, title: t.title, task: t.id, done: t.done })),
    ...[...events, ...g].filter(e => e.date === td).map(e => ({ k: 'e' + e.id, s: e.allDay ? -1 : e.start, d: e.dur, title: e.title, task: '', done: false })),
  ].sort((a, b) => a.s - b.s)
  const hs = habits.filter(h => !h.archived && h.days.includes(dow(td)))
  return { td, list, doneToday, tl, hs, hdone: hs.filter(h => h.log[td]).length, total: list.length + doneToday }
}

function Progress() {
  const { list, doneToday, total, hs, hdone } = useToday()
  return <div className="well" role="group" aria-label="今日の進み具合">
    <div className="hero">{list.length}<small>件が残っています</small></div>
    <div className="track" style={{ marginTop: 16 }} role="progressbar" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={doneToday}><i style={{ width: total ? `${(doneToday / total) * 100}%` : '0%' }} /></div>
    <p className="small muted" style={{ marginTop: 8 }}>完了 {doneToday}件 ・ 習慣 {hdone}/{hs.length}</p>
  </div>
}

function QuickAdd() {
  const [text, setText] = useState(''); const { td } = useToday()
  return <form className="quick" onSubmit={e => { e.preventDefault(); const t = text.trim(); if (!t) return; const p = parseQuick(t); if (p.title) addTask({ due: td, ...p }); setText('') }}>
    <input aria-label="今日のタスクを追加" placeholder="今日やることを追加  例: 資料を作る !2 ~45m" value={text} onChange={e => setText(e.target.value)} />
    <button className="btn btn-primary" type="submit">追加</button>
  </form>
}

function Timeline() {
  const { tl } = useToday()
  return <div className="rows">
    {tl.map(i => <div className="trow" key={i.k} style={{ cursor: i.task ? 'pointer' : 'default' }} onClick={() => i.task && openTask(i.task)}>
      <span className="small muted" style={{ width: 92, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{i.s < 0 ? '終日' : `${hm(i.s)}–${hm(i.s + i.d)}`}</span>
      <span className="grow" style={{ textDecoration: i.done ? 'line-through' : 'none' }}>{i.title}</span>{i.task && <span className="badge">タスク</span>}
    </div>)}
    {!tl.length && <p className="muted" style={{ padding: '12px 0' }}>予定はありません。<button className="btn btn-quiet btn-sm" onClick={() => go('calendar')}>カレンダーを開く</button></p>}
  </div>
}

function TodayTasks() {
  const { list } = useToday()
  return <div className="rows">
    {[...list].sort((a, b) => b.priority - a.priority).map(t => <TaskRow key={t.id} t={t} open={openTask} />)}
    {!list.length && <p className="muted" style={{ padding: '12px 0' }}>今日のタスクは片付きました。</p>}
  </div>
}

function TodayHabits() { const { hs, td } = useToday(); return hs.length ? <HabitChecks habits={hs} date={td} /> : <p className="muted">今日の習慣はありません。</p> }

function ProjectsWidget() {
  const ps = useProjects().filter(x => !x.p.done).slice(0, 4); const tasks = useStore(s => s.tasks)
  if (!ps.length) return <p className="muted">進行中のプロジェクトはありません。</p>
  return <div className="rows">{ps.map(({ p, r }) => { const m = tasks.filter(t => t.milestone && !t.done && t.due && descOf(tasks, p.id).has(t.id)).sort((a, b) => a.due!.localeCompare(b.due!))[0]
    return <a key={p.id} className="row-link" href={'#/projects/' + p.id}><span className="grow"><b style={{ fontWeight: 560 }}>{p.title}</b>{m && <span className="small muted"> ◆ {m.title} {fmtShort(m.due!)}</span>}<div className="track" style={{ marginTop: 6 }}><i style={{ width: r.pct + '%' }} /></div></span><span className="small muted" style={{ marginLeft: 12 }}>{r.pct}%</span></a> })}</div>
}
const descOf = (tasks: import('../types').Task[], id: string) => new Set(descendants(tasks, id).map(d => d.id))

registerWidget({ id: 'progress', title: '進み具合', span: 'full', heading: false, order: 10, component: Progress })
registerWidget({ id: 'quick', title: 'クイック追加', span: 'full', heading: false, order: 20, component: QuickAdd })
registerWidget({ id: 'timeline', title: 'タイムライン', span: 'half', order: 30, component: Timeline })
registerWidget({ id: 'tasks', title: 'やること', span: 'half', order: 40, component: TodayTasks })
registerWidget({ id: 'projects', title: 'プロジェクト', span: 'half', order: 45, component: ProjectsWidget })
registerWidget({ id: 'habits', title: '今日の習慣', span: 'full', order: 50, component: TodayHabits })
