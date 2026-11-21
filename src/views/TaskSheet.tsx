import { useState } from 'react'
import { Sheet } from '../ui'
import { useStore, patchTask, delTask, get } from '../store'
import { uid, hm, fromHm } from '../lib/date'
import type { Task } from '../types'

export function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useStore(s => s.tasks.find(x => x.id === id))
  const projects = useStore(s => s.projects)
  const [sub, setSub] = useState('')
  if (!t) return null
  const p = (x: Partial<Task>) => patchTask(id, x)
  return (
    <Sheet title="タスクの詳細" onClose={onClose}>
      <div className="stack">
        <div className="field"><label htmlFor="tt">タイトル</label><input id="tt" type="text" data-autofocus value={t.title} onChange={e => p({ title: e.target.value })} /></div>
        <div className="row">
          <div className="field grow"><label htmlFor="tp">優先度</label><div className="sel"><select id="tp" value={t.priority} onChange={e => p({ priority: Number(e.target.value) as Task['priority'] })}><option value={0}>なし</option><option value={1}>低</option><option value={2}>中</option><option value={3}>高</option></select></div></div>
          <div className="field grow"><label htmlFor="td">期限</label><input id="td" type="date" value={t.due || ''} onChange={e => p({ due: e.target.value || undefined })} /></div>
        </div>
        <div className="row">
          <div className="field grow"><label htmlFor="tj">プロジェクト</label><input id="tj" type="text" list="projlist" value={t.project} onChange={e => p({ project: e.target.value })} /><datalist id="projlist">{projects.map(x => <option key={x} value={x} />)}</datalist></div>
          <div className="field grow"><label htmlFor="te">見積(分)</label><input id="te" type="number" min={0} step={5} value={t.est ?? ''} onChange={e => p({ est: e.target.value ? Number(e.target.value) : undefined })} /></div>
        </div>
        <div className="row">
          <div className="field grow"><label htmlFor="tr">繰り返し</label><div className="sel"><select id="tr" value={t.repeat || ''} onChange={e => p({ repeat: (e.target.value || null) as Task['repeat'] })}><option value="">なし</option><option value="daily">毎日</option><option value="weekly">毎週</option><option value="monthly">毎月</option></select></div></div>
          <div className="field grow"><label htmlFor="tg">タグ(カンマ区切り)</label><input id="tg" type="text" value={t.tags.join(',')} onChange={e => p({ tags: e.target.value.split(/[,、]/).map(x => x.trim()).filter(Boolean) })} /></div>
        </div>
        <div className="sec-h" style={{ marginTop: 8 }}>タイムブロック(時間を確保)</div>
        <div className="row">
          <div className="field grow"><label htmlFor="bd">日付</label><input id="bd" type="date" value={t.block?.date || ''} onChange={e => e.target.value ? p({ block: { start: 9 * 60, dur: t.est || 30, ...t.block, date: e.target.value } }) : p({ block: undefined })} /></div>
          {t.block && <>
            <div className="field grow"><label htmlFor="bs">開始</label><input id="bs" type="time" step={300} value={hm(t.block.start)} onChange={e => p({ block: { ...t.block!, start: fromHm(e.target.value) } })} /></div>
            <div className="field grow"><label htmlFor="bl">長さ(分)</label><input id="bl" type="number" min={5} step={5} value={t.block.dur} onChange={e => p({ block: { ...t.block!, dur: Math.max(5, Number(e.target.value) || 5) } })} /></div>
          </>}
        </div>
        <div className="field"><label htmlFor="tn">メモ</label><textarea id="tn" value={t.notes} onChange={e => p({ notes: e.target.value })} /></div>
        <div className="sec-h">サブタスク</div>
        <div className="rows">{t.subs.map(s => (
          <div className="trow" key={s.id}>
            <button className="chk-wrap" role="checkbox" aria-checked={s.done} aria-label={s.title} onClick={() => p({ subs: t.subs.map(x => x.id === s.id ? { ...x, done: !x.done } : x) })}><span className="chk" aria-checked={s.done}>{s.done ? '✓' : ''}</span></button>
            <span className="grow" style={{ textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</span>
            <button className="btn btn-quiet btn-sm" onClick={() => p({ subs: t.subs.filter(x => x.id !== s.id) })} aria-label="削除">削除</button>
          </div>))}</div>
        <form className="quick" onSubmit={e => { e.preventDefault(); if (sub.trim()) { p({ subs: [...t.subs, { id: uid(), title: sub.trim(), done: false }] }); setSub('') } }}>
          <input aria-label="サブタスクを追加" placeholder="サブタスクを追加" value={sub} onChange={e => setSub(e.target.value)} /><button className="btn" type="submit">追加</button>
        </form>
        <hr className="rule" />
        <button className="btn" onClick={() => { if (confirm('このタスクを削除しますか?')) { delTask(id); onClose() } }}>タスクを削除</button>
      </div>
    </Sheet>
  )
}
export const projectsOf = () => get().projects
