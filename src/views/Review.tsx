import { useState } from 'react'
import { Seg } from '../ui'
import { useStore, setReview } from '../store'
import { today, addDays, weekStart, fmtDate, fmtShort, dow } from '../lib/date'

export function Review() {
  const tasks = useStore(s => s.tasks); const habits = useStore(s => s.habits); const reviews = useStore(s => s.reviews)
  const [mode, setMode] = useState<'day' | 'week'>('day'); const [off, setOff] = useState(0)
  const td = today()
  const from = mode === 'day' ? addDays(td, off) : addDays(weekStart(td), off * 7)
  const to = mode === 'day' ? from : addDays(from, 6)
  const key = mode === 'day' ? from : 'W' + from
  const r = reviews[key] || { wins: '', lessons: '', next: '', mood: 3 }
  const inRange = (iso?: string) => { if (!iso) return false; const d = new Date(iso); const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return s >= from && s <= to }
  const done = tasks.filter(t => t.done && inRange(t.doneAt))
  const planned = tasks.filter(t => t.block && t.block.date >= from && t.block.date <= to)
  const focusMin = planned.reduce((a, t) => a + t.block!.dur, 0)
  const days = Array.from({ length: mode === 'day' ? 1 : 7 }, (_, i) => addDays(from, i))
  let due = 0, ok = 0; habits.filter(h => !h.archived).forEach(h => days.forEach(d => { if (h.days.includes(dow(d)) && d <= td) { due++; if (h.log[d]) ok++ } }))
  const label = mode === 'day' ? fmtDate(from) : `${fmtShort(from)} – ${fmtShort(to)}の週`
  const f = (k: 'wins' | 'lessons' | 'next', l: string, ph: string) => <div className="field"><label htmlFor={'r' + k}>{l}</label><textarea id={'r' + k} placeholder={ph} value={r[k]} onChange={e => setReview(key, { [k]: e.target.value })} /></div>
  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <Seg value={mode} onChange={v => { setMode(v); setOff(0) }} items={[['day', '日次'], ['week', '週次']]} />
      <div className="row" style={{ justifyContent: 'space-between' }}><button className="btn btn-sm" onClick={() => setOff(off - 1)}>← 前へ</button><b>{label}</b><button className="btn btn-sm" disabled={off >= 0} onClick={() => setOff(off + 1)}>次へ →</button></div>
      <div className="well"><div className="row" style={{ justifyContent: 'space-around', alignItems: 'flex-start' }}>
        <div><div className="hero" style={{ fontSize: 48 }}>{done.length}</div><div className="small muted">完了タスク</div></div>
        <div><div className="hero" style={{ fontSize: 48 }}>{due ? Math.round((ok / due) * 100) : 0}<small>%</small></div><div className="small muted">習慣の達成</div></div>
        <div><div className="hero" style={{ fontSize: 48 }}>{(focusMin / 60).toFixed(1)}<small>h</small></div><div className="small muted">確保した時間</div></div>
      </div></div>
      {done.length > 0 && <details><summary style={{ cursor: 'pointer', minHeight: 36 }}>完了したタスク({done.length})</summary><ul className="small" style={{ paddingLeft: 20 }}>{done.map(t => <li key={t.id}>{t.title}</li>)}</ul></details>}
      {f('wins', mode === 'day' ? '今日うまくいったこと' : '今週うまくいったこと', '小さなことでも')}
      {f('lessons', '気づき・うまくいかなかったこと', '原因は?')}
      {f('next', mode === 'day' ? '明日の最重要事項' : '来週の最重要事項', '1つだけ選ぶ')}
      <div className="field"><label>調子</label><div className="chips" role="group">{[1, 2, 3, 4, 5].map(n => <button key={n} className="chip" aria-pressed={r.mood === n} onClick={() => setReview(key, { mood: n })}>{n}</button>)}</div></div>
    </div>
  )
}
