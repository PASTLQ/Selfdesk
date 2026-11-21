import { useState } from 'react'
import { useStore, addTask } from '../store'
import { parseQuick } from '../lib/quick'
import { today, fmtDate, hm, dow } from '../lib/date'
import { TaskRow } from './Tasks'
import { HabitChecks } from './Habits'

export function Today({ openTask, go }: { openTask: (id: string) => void; go: (v: string) => void }) {
  const tasks = useStore(s => s.tasks); const events = useStore(s => s.events); const g = useStore(s => s.gEvents); const habits = useStore(s => s.habits)
  const [text, setText] = useState('')
  const td = today()
  const list = tasks.filter(t => !t.done && ((t.due && t.due <= td) || t.block?.date === td))
  const doneToday = tasks.filter(t => t.done && t.doneAt && t.doneAt.slice(0, 10) === td || (t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString())).length
  const tl = [
    ...tasks.filter(t => t.block?.date === td).map(t => ({ k: 't' + t.id, s: t.block!.start, d: t.block!.dur, title: t.title, task: t.id, done: t.done })),
    ...[...events, ...g].filter(e => e.date === td).map(e => ({ k: 'e' + e.id, s: e.allDay ? -1 : e.start, d: e.dur, title: e.title, task: '', done: false, allDay: e.allDay })),
  ].sort((a, b) => a.s - b.s)
  const hs = habits.filter(h => !h.archived && h.days.includes(dow(td)))
  const hdone = hs.filter(h => h.log[td]).length
  const total = list.length + doneToday
  return (
    <div className="stack" style={{ gap: 'var(--s5)' }}>
      <header className="head"><h1 className="title">今日</h1><span className="aside">{fmtDate(td)}</span></header>
      <section className="well" aria-label="今日の進み具合">
        <div className="hero">{list.length}<small>件が残っています</small></div>
        <div className="track" style={{ marginTop: 16 }} role="progressbar" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={doneToday}><i style={{ width: total ? `${(doneToday / total) * 100}%` : '0%' }} /></div>
        <p className="small muted" style={{ marginTop: 8 }}>完了 {doneToday}件 ・ 習慣 {hdone}/{hs.length}</p>
      </section>
      <form className="quick" onSubmit={e => { e.preventDefault(); const t = text.trim(); if (!t) return; const p = parseQuick(t); if (p.title) addTask({ due: td, ...p }); setText('') }}>
        <input aria-label="今日のタスクを追加" placeholder="今日やることを追加  例: 資料を作る !2 ~45m" value={text} onChange={e => setText(e.target.value)} />
        <button className="btn btn-primary" style={{ minHeight: 48, fontSize: 'var(--t-md)' }} type="submit">追加</button>
      </form>
      <div className="cols two">
        <section>
          <h2 className="sec-h">タイムライン</h2>
          <div className="rows">
            {tl.map(i => <div className="trow" key={i.k} style={{ cursor: i.task ? 'pointer' : 'default' }} onClick={() => i.task && openTask(i.task)}>
              <span className="small muted" style={{ width: 92, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{i.s < 0 ? '終日' : `${hm(i.s)}–${hm(i.s + i.d)}`}</span>
              <span className="grow" style={{ textDecoration: i.done ? 'line-through' : 'none' }}>{i.title}</span>{i.task && <span className="badge">タスク</span>}
            </div>)}
            {!tl.length && <p className="muted" style={{ padding: '16px 0' }}>予定はありません。<button className="btn btn-quiet btn-sm" onClick={() => go('calendar')}>カレンダーを開く</button></p>}
          </div>
        </section>
        <section>
          <h2 className="sec-h">やること</h2>
          <div className="rows">
            {list.sort((a, b) => b.priority - a.priority).map(t => <TaskRow key={t.id} t={t} open={openTask} />)}
            {!list.length && <p className="muted" style={{ padding: '16px 0' }}>今日のタスクは片付きました。</p>}
          </div>
        </section>
      </div>
      {hs.length > 0 && <section><h2 className="sec-h">今日の習慣</h2><HabitChecks habits={hs} date={td} /></section>}
    </div>
  )
}
