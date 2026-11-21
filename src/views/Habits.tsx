import { useState } from 'react'
import { Sheet, Check } from '../ui'
import { useStore, addHabit, patchHabit, toggleHabit } from '../store'
import { today, addDays, dow, JA, daysBetween } from '../lib/date'
import type { Habit } from '../types'

export function streak(h: Habit, td = today()) {
  let d = h.log[td] ? td : addDays(td, -1); let n = 0
  for (let i = 0; i < 800; i++) { if (!h.days.includes(dow(d))) { d = addDays(d, -1); continue } if (h.log[d]) { n++; d = addDays(d, -1) } else break }
  return n
}
export function rate(h: Habit, days = 28, td = today()) {
  let due = 0, ok = 0; for (let i = 0; i < days; i++) { const d = addDays(td, -i); if (!h.days.includes(dow(d)) || daysBetween(h.createdAt.slice(0, 10), d) < 0) continue; due++; if (h.log[d]) ok++ }
  return due ? Math.round((ok / due) * 100) : 0
}
export function HabitChecks({ habits, date }: { habits: Habit[]; date: string }) {
  return <div className="rows">{habits.map(h => <div className="trow" key={h.id}><Check on={!!h.log[date]} onChange={() => toggleHabit(h.id, date)} label={`${h.name}を記録`} /><span className="grow">{h.name}</span><span className="small muted">連続 {streak(h)}日</span></div>)}</div>
}

export function Habits() {
  const habits = useStore(s => s.habits).filter(h => !h.archived); const td = today()
  const [edit, setEdit] = useState<string | 'new' | null>(null)
  return (
    <div className="stack" style={{ gap: 'var(--s5)' }}>
      {habits.map(h => {
        const last7 = Array.from({ length: 7 }, (_, i) => addDays(td, i - 6))
        const weeks = Array.from({ length: 16 * 7 }, (_, i) => addDays(td, i - 16 * 7 + 1))
        const start = (dow(weeks[0]) + 6) % 7; const cells = [...Array(start).fill(null), ...weeks]
        return <section key={h.id} className="plate" style={{ padding: 'var(--s4)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row"><Check on={!!h.log[td]} onChange={() => toggleHabit(h.id, td)} label={`${h.name}を今日記録`} /><b>{h.name}</b></div>
            <button className="btn btn-sm" onClick={() => setEdit(h.id)}>編集</button>
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
            <div className="dots" aria-label="直近7日">{last7.map(d => <button key={d} className={'chk-wrap'} style={{ minWidth: 28, minHeight: 36 }} onClick={() => toggleHabit(h.id, d)} aria-label={`${d} ${h.log[d] ? '記録済み' : '未記録'}`}><span className={h.log[d] ? 'on' : h.days.includes(dow(d)) ? '' : 'off'} style={{ width: 22, height: 22, borderRadius: '50%', boxShadow: h.log[d] ? 'none' : 'var(--sink-sm)', background: h.log[d] ? 'var(--ink)' : 'transparent', color: h.log[d] ? 'var(--on-ink)' : 'var(--muted)', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: h.days.includes(dow(d)) || h.log[d] ? 1 : .35 }}>{JA[dow(d)]}</span></button>)}</div>
            <span className="small muted">連続 <b style={{ color: 'var(--fg)' }}>{streak(h)}</b>日 ・ 直近28日 {rate(h)}%</span>
          </div>
          <div className="heat" style={{ marginTop: 12 }} aria-hidden>{cells.map((d, i) => d ? <i key={i} className={h.log[d] ? 'on' : ''} title={d} /> : <i key={i} style={{ visibility: 'hidden' }} />)}</div>
        </section>
      })}
      {!habits.length && <p className="muted">習慣はまだありません。</p>}
      <button className="btn btn-block" onClick={() => setEdit('new')}>習慣を追加</button>
      {edit && <HabitSheet id={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
function HabitSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const ex = useStore(s => s.habits.find(h => h.id === id))
  const [name, setName] = useState(ex?.name || ''); const [days, setDays] = useState<number[]>(ex?.days || [0, 1, 2, 3, 4, 5, 6])
  const save = () => { if (!name.trim()) return; if (ex) patchHabit(ex.id, { name: name.trim(), days }); else addHabit(name.trim(), days); onClose() }
  return <Sheet title={ex ? '習慣を編集' : '習慣を追加'} onClose={onClose}><div className="stack">
    <div className="field"><label htmlFor="hn">名前</label><input id="hn" type="text" data-autofocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} /></div>
    <div className="label">実施する曜日</div>
    <div className="chips" role="group">{[1, 2, 3, 4, 5, 6, 0].map(d => <button key={d} className="chip" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d])}>{JA[d]}</button>)}</div>
    <button className="btn btn-primary btn-block" onClick={save}>保存</button>
    {ex && <button className="btn btn-block" onClick={() => { patchHabit(ex.id, { archived: true }); onClose() }}>アーカイブ</button>}
  </div></Sheet>
}
