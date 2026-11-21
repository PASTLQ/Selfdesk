import { useEffect, useMemo, useRef, useState } from 'react'
import { Seg, Sheet } from '../ui'
import { useStore, patchTask, patchEvent, addEvent, delEvent, get } from '../store'
import { today, addDays, addMonths, weekStart, parse, JA, fmtDate, hm, fromHm, monthGrid, dstr } from '../lib/date'
import * as G from '../lib/gcal'
import type { Ev, Task } from '../types'

const PX = 48 // px per hour
type Mode = 'week' | 'day' | 'month'
interface Item { key: string; kind: 'task' | 'event'; id: string; title: string; date: string; start: number; dur: number; done?: boolean; google?: boolean; allDay?: boolean }

function layout(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.dur - a.dur)
  const res = new Map<string, { col: number; cols: number }>(); let cluster: Item[] = []; let end = -1
  const flush = () => { const colEnds: number[] = []; const asg: [Item, number][] = []
    for (const it of cluster) { let c = colEnds.findIndex(e => e <= it.start); if (c < 0) { c = colEnds.length; colEnds.push(0) } colEnds[c] = it.start + it.dur; asg.push([it, c]) }
    asg.forEach(([it, c]) => res.set(it.key, { col: c, cols: colEnds.length })); cluster = [] }
  for (const it of sorted) { if (cluster.length && it.start >= end) { flush(); end = -1 } cluster.push(it); end = Math.max(end, it.start + it.dur) }
  flush(); return res
}

export function Calendar({ openTask }: { openTask: (id: string) => void }) {
  const tasks = useStore(s => s.tasks); const events = useStore(s => s.events); const gEvents = useStore(s => s.gEvents); const st = useStore(s => s.settings)
  const [mode, setMode] = useState<Mode>(() => window.innerWidth < 700 ? 'day' : 'week')
  const [anchor, setAnchor] = useState(today()); const [evId, setEvId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ date: string; start: number } | null>(null)
  const [rz, setRz] = useState<{ key: string; dur: number } | null>(null)
  const [hover, setHover] = useState<string | null>(null); const [msg, setMsg] = useState('')
  const scroller = useRef<HTMLDivElement>(null); const td = today()
  const h0 = Math.min(st.dayStart, 22), h1 = Math.max(st.dayEnd, h0 + 2)
  const days = mode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i)) : [anchor]
  const range: [string, string] = mode === 'month' ? [monthGrid(anchor)[0], monthGrid(anchor)[41]] : [days[0], days[days.length - 1]]

  useEffect(() => { if (G.isConnected()) G.fetchRange(range[0], range[1]).then(() => setMsg('')).catch(e => setMsg(String(e.message || e))) }, [range[0], range[1]]) // eslint-disable-line
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = Math.max(0, (new Date().getHours() - 1 - h0) * PX) }, [mode]) // eslint-disable-line

  const items = useMemo(() => {
    const out: Item[] = []
    for (const t of tasks) if (t.block) out.push({ key: 't' + t.id, kind: 'task', id: t.id, title: t.title, date: t.block.date, start: t.block.start, dur: t.block.dur, done: t.done })
    for (const e of [...events, ...gEvents]) out.push({ key: 'e' + e.id, kind: 'event', id: e.id, title: e.title, date: e.date, start: e.start, dur: e.dur, google: e.source === 'google' || !!e.gid, allDay: e.allDay })
    return out
  }, [tasks, events, gEvents])
  const unscheduled = tasks.filter(t => !t.done && !t.block).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.priority - a.priority).slice(0, 60)

  const snap = (m: number) => Math.round(m / 15) * 15
  const moveTo = (data: { k: string; id: string }, date: string, start: number) => {
    start = Math.max(0, Math.min(snap(start), 1440 - 15))
    if (data.k === 'task') { const t = get().tasks.find(x => x.id === data.id); if (!t) return; patchTask(t.id, { block: { dur: t.est || 30, ...t.block, date, start } }); G.autoPushBlock(t.id) }
    else { patchEvent(data.id, { date, start }); const e = [...get().events, ...get().gEvents].find(x => x.id === data.id); if (e?.gid && G.isConnected()) G.updateEvent(e.gid, { ...e, date, start }).catch(x => setMsg(x.message)) }
  }
  const onDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault(); setHover(null); let data: any; try { data = JSON.parse(e.dataTransfer.getData('text/plain')) } catch { return }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const y = e.clientY - r.top
    moveTo(data, date, h0 * 60 + (y / PX) * 60 - (data.off || 0))
  }
  const startResize = (e: React.PointerEvent, it: Item) => {
    e.stopPropagation(); e.preventDefault(); const y0 = e.clientY; const d0 = it.dur; let cur = d0
    const mv = (ev: PointerEvent) => { cur = Math.max(15, snap(d0 + ((ev.clientY - y0) / PX) * 60)); setRz({ key: it.key, dur: cur }) }
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); setRz(null)
      if (it.kind === 'task') { const t = get().tasks.find(x => x.id === it.id); if (t?.block) { patchTask(t.id, { block: { ...t.block, dur: cur } }); G.autoPushBlock(t.id) } }
      else { patchEvent(it.id, { dur: cur }); const ev = [...get().events, ...get().gEvents].find(x => x.id === it.id); if (ev?.gid && G.isConnected()) G.updateEvent(ev.gid, { ...ev, dur: cur }).catch(x => setMsg(x.message)) } }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
  }
  const title = mode === 'month' ? `${parse(anchor).getFullYear()}年${parse(anchor).getMonth() + 1}月` : mode === 'day' ? fmtDate(anchor) : `${fmtDate(days[0])} – ${fmtDate(days[6])}`
  const step = (n: number) => setAnchor(mode === 'month' ? addMonths(anchor, n) : addDays(anchor, n * (mode === 'week' ? 7 : 1)))
  const totalH = (h1 - h0) * PX

  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row"><button className="btn btn-sm" onClick={() => step(-1)} aria-label="前へ">←</button><button className="btn btn-sm" onClick={() => setAnchor(td)}>今日</button><button className="btn btn-sm" onClick={() => step(1)} aria-label="次へ">→</button><b style={{ marginLeft: 8 }}>{title}</b></div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <div style={{ minWidth: 220 }}><Seg value={mode} onChange={setMode} items={[['day', '日'], ['week', '週'], ['month', '月']]} /></div>
          <button className="btn btn-sm" onClick={() => setDraft({ date: anchor, start: 9 * 60 })}>予定を追加</button>
        </div>
      </div>
      {msg && <div className="notice" role="alert">Google: {msg}</div>}
      {mode === 'month' ? (
        <div>
          <div className="month" style={{ marginBottom: 6 }}>{JA.map((d, i) => <div key={d} className="small muted" style={{ textAlign: 'center' }}>{JA[(i + 1) % 7]}</div>)}</div>
          <div className="month">{monthGrid(anchor).map(d => {
            const its = items.filter(i => i.date === d).sort((a, b) => a.start - b.start); const inM = parse(d).getMonth() === parse(anchor).getMonth()
            return <button key={d} className={'mcell' + (inM ? '' : ' out') + (d === td ? ' today' : '')} onClick={() => { setAnchor(d); setMode('day') }} aria-label={fmtDate(d) + ` ${its.length}件`}>
              <span>{parse(d).getDate()}</span>{its.slice(0, 3).map(i => <i key={i.key}>{i.allDay ? '' : hm(i.start) + ' '}{i.title}</i>)}{its.length > 3 && <i>+{its.length - 3}</i>}</button>
          })}</div>
        </div>
      ) : (
        <div className="cal">
          <aside className="cal-side well" style={{ padding: 'var(--s3)' }} aria-label="未配置のタスク">
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="sec-h" style={{ margin: 0 }}>未配置タスク</span><span className="badge">{unscheduled.length}</span></div>
            <p className="small muted">ドラッグして時間枠に置くとタイムブロックになります。タッチ端末はタスク詳細から時間を設定できます。</p>
            {unscheduled.map(t => <div key={t.id} className="chip-task" draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ k: 'task', id: t.id }))} onClick={() => openTask(t.id)}>{t.priority > 0 && <b>{'!'.repeat(t.priority)} </b>}{t.title}<small>{t.est ? t.est + '分' : '見積なし'}{t.due ? ' ・期限 ' + t.due.slice(5).replace('-', '/') : ''}</small></div>)}
            {!unscheduled.length && <p className="small muted">すべて配置済みです。</p>}
          </aside>
          <div className="grid-wrap">
            <div className="grid-head" style={{ ['--cols' as any]: days.length }}>
              <div />{days.map(d => { const ad = items.filter(i => i.date === d && i.allDay); return <div key={d} className={d === td ? 'today' : ''}>{mode === 'week' ? `${parse(d).getDate()}(${JA[parse(d).getDay()]})` : fmtDate(d)}{ad.map(a => <div key={a.key} className="badge" style={{ display: 'block', margin: '2px 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>)}</div> })}
            </div>
            <div className="grid-scroll" ref={scroller}>
              <div className="grid" style={{ ['--cols' as any]: days.length }}>
                <div className="hours">{Array.from({ length: h1 - h0 }, (_, i) => <div key={i}>{h0 + i}:00</div>)}</div>
                {days.map(d => {
                  const its = items.filter(i => i.date === d && !i.allDay); const lay = layout(its)
                  const now = new Date(); const nowM = now.getHours() * 60 + now.getMinutes()
                  return <div key={d} className={'daycol' + (d === td ? ' today' : '') + (hover === d ? ' drop-hint' : '')} style={{ height: totalH }}
                    onDragOver={e => { e.preventDefault(); setHover(d) }} onDragLeave={() => setHover(null)} onDrop={e => onDrop(e, d)}
                    onClick={e => { if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('slot')) return; const r = e.currentTarget.getBoundingClientRect(); setDraft({ date: d, start: Math.floor((h0 * 60 + ((e.clientY - r.top) / PX) * 60) / 30) * 30 }) }}>
                    {Array.from({ length: h1 - h0 }, (_, i) => <div key={i} className="slot" />)}
                    {d === td && nowM >= h0 * 60 && nowM <= h1 * 60 && <div className="nowline" style={{ top: ((nowM - h0 * 60) / 60) * PX }} />}
                    {its.map(it => { const l = lay.get(it.key) || { col: 0, cols: 1 }; const dur = rz?.key === it.key ? rz.dur : it.dur
                      return <div key={it.key} role="button" tabIndex={0} className={'blk ' + it.kind + (it.google ? ' google' : '') + (it.done ? ' done' : '')}
                        style={{ top: ((it.start - h0 * 60) / 60) * PX, height: Math.max(18, (dur / 60) * PX - 2), left: `calc(${(l.col / l.cols) * 100}% + 3px)`, width: `calc(${100 / l.cols}% - 6px)`, right: 'auto' }}
                        draggable onDragStart={e => { const r = e.currentTarget.getBoundingClientRect(); e.dataTransfer.setData('text/plain', JSON.stringify({ k: it.kind, id: it.id, off: ((e.clientY - r.top) / PX) * 60 })) }}
                        onClick={e => { e.stopPropagation(); it.kind === 'task' ? openTask(it.id) : setEvId(it.id) }}
                        onKeyDown={e => { if (e.key === 'Enter') it.kind === 'task' ? openTask(it.id) : setEvId(it.id) }}>
                        <b>{it.title}</b><div>{hm(it.start)}–{hm(it.start + dur)}</div><span className="rz" onPointerDown={e => startResize(e, it)} />
                      </div> })}
                  </div>
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {(draft || evId) && <EventSheet id={evId} draft={draft} onClose={() => { setEvId(null); setDraft(null) }} />}
    </div>
  )
}

function EventSheet({ id, draft, onClose }: { id: string | null; draft: { date: string; start: number } | null; onClose: () => void }) {
  const ex = useStore(s => [...s.events, ...s.gEvents].find(e => e.id === id))
  const [f, setF] = useState<Partial<Ev> & { title: string; date: string }>(() => ex ? { ...ex } : { title: '', date: draft?.date || today(), start: draft?.start ?? 540, dur: 60, source: 'local' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const up = (p: Partial<Ev>) => setF(x => ({ ...x, ...p }))
  const save = async () => {
    if (!f.title.trim()) return; setBusy(true); setErr('')
    try {
      if (ex) { patchEvent(ex.id, f); if (ex.gid && G.isConnected()) await G.updateEvent(ex.gid, { ...ex, ...f } as Ev) }
      else { const ev = addEvent(f); if (get().settings.gSync && G.isConnected()) await G.pushLocalEvent(ev.id) }
      onClose()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const del = async () => { if (!ex || !confirm('この予定を削除しますか?')) return; try { if (ex.gid && G.isConnected()) await G.removeEvent(ex.gid); delEvent(ex.id); onClose() } catch (e: any) { setErr(e.message) } }
  const push = async () => { if (!ex) return; try { await G.pushLocalEvent(ex.id); onClose() } catch (e: any) { setErr(e.message) } }
  return (
    <Sheet title={ex ? '予定を編集' : '予定を追加'} onClose={onClose}>
      <div className="stack">
        <div className="field"><label htmlFor="et">タイトル</label><input id="et" type="text" data-autofocus value={f.title} onChange={e => up({ title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') save() }} /></div>
        <div className="row">
          <div className="field grow"><label htmlFor="ed">日付</label><input id="ed" type="date" value={f.date} onChange={e => up({ date: e.target.value || f.date })} /></div>
          <div className="field grow"><label htmlFor="es">開始</label><input id="es" type="time" step={300} disabled={f.allDay} value={hm(f.start ?? 0)} onChange={e => up({ start: fromHm(e.target.value) })} /></div>
          <div className="field grow"><label htmlFor="el">長さ(分)</label><input id="el" type="number" min={5} step={5} disabled={f.allDay} value={f.dur} onChange={e => up({ dur: Math.max(5, Number(e.target.value) || 5) })} /></div>
        </div>
        <label className="switch-row"><span><b>終日</b></span><input className="switch" type="checkbox" checked={!!f.allDay} onChange={e => up({ allDay: e.target.checked })} /></label>
        <div className="field"><label htmlFor="ep">場所</label><input id="ep" type="text" value={f.place || ''} onChange={e => up({ place: e.target.value })} /></div>
        {ex?.source === 'google' && <p className="small muted">Googleカレンダーの予定です。変更は Google にも反映されます。</p>}
        {err && <div className="notice" role="alert">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy} onClick={save}>保存</button>
        {ex && !ex.gid && <button className="btn btn-block" onClick={push}>Googleカレンダーにも作成</button>}
        {ex && <button className="btn btn-block" onClick={del}>削除</button>}
      </div>
    </Sheet>
  )
}
export type { Task }
export { dstr }
