import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, get, addTask, moveTask } from '../store'
import { layoutTree, canDropOn } from '../core/tree-layout'
import { rollup, hasChildren } from '../core/tree'
import { relatedOf } from '../core/links'
import { parseQuick } from '../lib/quick'
import { today, fmtShort } from '../lib/date'
import { openTask } from '../ui-state'
import { Seg } from '../ui'
import type { Task } from '../types'

const W = 208, H = 70, GX = 64, GY = 14, PAD = 24
type Scope = 'projects' | 'all'
interface Drag { id: string; x: number; y: number; target: string | null }

/** プロジェクト構造図: 階層(親子)を図にし、ドラッグで親を付け替え、＋で子を足せる。座標は保存せず、階層から自動で整える。 */
export function Structure() {
  const tasks = useStore(s => s.tasks); const wishes = useStore(s => s.wishes); const td = today()
  const [scope, setScope] = useState<Scope>('projects'); const [collapsed, setCollapsed] = useState<Set<string>>(new Set()); const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState<Drag | null>(null); const [adding, setAdding] = useState<string | null>(null); const [text, setText] = useState(''); const [asProj, setAsProj] = useState(false)
  const [msg, setMsg] = useState(''); const [rootText, setRootText] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  const roots = useMemo(() => tasks.filter(t => !t.parent && !t.archived && (t.isProject || (scope === 'all' && hasChildren(tasks, t.id)))).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.createdAt.localeCompare(b.createdAt)), [tasks, scope])
  const lay = useMemo(() => layoutTree(tasks, roots, { show: scope === 'projects' ? t => !!t.isProject : undefined, collapsed, nodeW: W, nodeH: H, gapX: GX, gapY: GY }), [tasks, roots, scope, collapsed])
  const info = useMemo(() => new Map(lay.nodes.map(n => [n.t.id, { r: rollup(tasks, n.t.id, td), kids: hasChildren(tasks, n.t.id), rel: relatedOf(tasks, wishes, n.t) }])), [lay, tasks, wishes, td])
  // 親子以外の「つながり」: プロジェクト同士の関連(links)を破線で
  const rels = useMemo(() => lay.nodes.flatMap(n => (n.t.links || []).filter(r => r.kind === 'project' && lay.byId.has(r.id) && r.id !== n.parent && lay.byId.get(r.id)!.parent !== n.t.id).map(r => ({ from: n, to: lay.byId.get(r.id)! }))), [lay])

  const flash = (s: string) => { setMsg(s); window.setTimeout(() => setMsg(''), 3500) }
  const toggle = (id: string) => setCollapsed(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Ctrl/⌘ + ホイールで拡大縮小
  useEffect(() => {
    const el = scroller.current; if (!el) return
    const f = (e: WheelEvent) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); setZoom(z => Math.min(1.6, Math.max(0.4, +(z - e.deltaY * 0.002).toFixed(2)))) }
    el.addEventListener('wheel', f, { passive: false }); return () => el.removeEventListener('wheel', f)
  }, [])

  const hit = (id: string, x: number, y: number): string | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const d = (el as HTMLElement).dataset; if (!d) continue
      if (d.nid && d.nid !== id) return canDropOn(get().tasks, id, d.nid) ? d.nid : null
      if (d.drop === 'root') return get().tasks.find(t => t.id === id)?.parent ? 'root' : null
    }
    return null
  }
  const onNodeDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input,label')) return
    e.stopPropagation(); const x0 = e.clientX, y0 = e.clientY; let moved = false; let target: string | null = null
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
      moved = true; target = hit(id, ev.clientX, ev.clientY); setDrag({ id, x: ev.clientX, y: ev.clientY, target })
    }
    const end = (apply: boolean) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', key); setDrag(null)
      if (!apply) return
      if (!moved) { openTask(id); return }
      const t = get().tasks.find(x => x.id === id); if (!t || !target) return
      const to = target === 'root' ? undefined : target; const name = to ? get().tasks.find(x => x.id === to)?.title : 'トップレベル'
      if (moveTask(id, to)) { if (to) setCollapsed(c => { const n = new Set(c); n.delete(to); return n }); flash(`「${t.title}」を「${name}」の下に移しました`) }
    }
    const up = () => end(true); const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') end(false) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('keydown', key)
  }
  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-nid],button,input,label,form')) return
    const el = scroller.current; if (!el) return; const x0 = e.clientX, y0 = e.clientY, sl = el.scrollLeft, st = el.scrollTop
    const mv = (ev: PointerEvent) => { el.scrollLeft = sl - (ev.clientX - x0); el.scrollTop = st - (ev.clientY - y0) }
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
  }
  const addChild = (parent: string, e: React.FormEvent) => {
    e.preventDefault(); const q = parseQuick(text); setText('')
    if (q.title) { const { project: _p, ...rest } = q; addTask({ ...rest, parent, ...(asProj ? { isProject: true, goal: '', doneWhen: '' } : {}) }); setCollapsed(c => { const n = new Set(c); n.delete(parent); return n }) }
    if (q.title && !asProj && scope === 'projects') setScope('all')   // タスクを足したら、見えるように表示範囲を広げる
    setAdding(null); setAsProj(false)
  }
  const addRoot = (e: React.FormEvent) => { e.preventDefault(); const t = rootText.trim(); if (!t) return; addTask({ title: t, isProject: true, goal: '', doneWhen: '' }); setRootText('') }
  const dragging = drag && lay.byId.get(drag.id)?.t

  const cw = lay.width + PAD * 2, ch = Math.max(lay.height, H) + PAD * 2 + 56
  return <div className="stack" style={{ gap: 'var(--s3)' }}>
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <form className="quick" style={{ flex: '1 1 260px', maxWidth: 420 }} onSubmit={addRoot}>
        <input aria-label="新しいプロジェクト名" placeholder="トップのプロジェクトを追加" value={rootText} onChange={e => setRootText(e.target.value)} /><button className="btn" type="submit">追加</button>
      </form>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Seg value={scope} onChange={setScope} items={[['projects', 'プロジェクトのみ'], ['all', 'タスクまで']]} />
        <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
          <button className="btn btn-sm" aria-label="縮小" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(2)))}>−</button>
          <button className="btn btn-sm" aria-label="拡大率を100%に戻す" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button className="btn btn-sm" aria-label="拡大" onClick={() => setZoom(z => Math.min(1.6, +(z + 0.1).toFixed(2)))}>＋</button>
        </div>
      </div>
    </div>
    <p className="small muted">項目をドラッグして別の項目に重ねると、その子になります(Esc で取り消し)。クリックで詳細、背景のドラッグで移動、Ctrl/⌘+ホイールで拡大縮小。破線はプロジェクト同士の関連です。</p>
    {msg && <div className="notice" role="status">{msg}</div>}
    {!lay.nodes.length ? <p className="muted" style={{ padding: 'var(--s5) 0' }}>プロジェクトがまだありません。上の欄からトップのプロジェクトを追加できます。</p> :
      <div className="smap" ref={scroller} onPointerDown={onBgDown} aria-label="プロジェクト構造図">
        {drag && dragging && dragging.parent && <div className={'smap-root' + (drag.target === 'root' ? ' on' : '')} data-drop="root">ここに落とすとトップレベルへ</div>}
        <div style={{ width: cw * zoom, height: ch * zoom }}>
          <div className="smap-canvas" style={{ width: cw, height: ch, transform: `scale(${zoom})` }}>
            <svg className="smap-edges" width={cw} height={ch} aria-hidden="true">
              <g transform={`translate(${PAD},${PAD})`}>
                {lay.nodes.filter(n => n.parent && lay.byId.has(n.parent)).map(n => { const p = lay.byId.get(n.parent!)!; const x1 = p.x + W, y1 = p.y + H / 2, x2 = n.x, y2 = n.y + H / 2
                  return <path key={n.t.id} d={`M${x1},${y1} C${x1 + GX / 2},${y1} ${x2 - GX / 2},${y2} ${x2},${y2}`} className="smap-edge" /> })}
                {rels.map((r, i) => { const x1 = r.from.x + W, y1 = r.from.y + H / 2, x2 = r.to.x + W, y2 = r.to.y + H / 2, b = Math.max(x1, x2) + 36
                  return <path key={i} d={`M${x1},${y1} C${b},${y1} ${b},${y2} ${x2},${y2}`} className="smap-edge rel" /> })}
              </g>
            </svg>
            <div className="smap-nodes" style={{ left: PAD, top: PAD }}>
              {lay.nodes.map(n => { const t = n.t; const i = info.get(t.id)!; const late = !t.done && t.due && t.due < td; const wish = i.rel.filter(r => r.kind === 'wish')
                return <div key={t.id} data-nid={t.id} role="button" tabIndex={0} aria-label={`${t.title}。${t.isProject ? 'プロジェクト' : 'タスク'}。進捗${i.r.pct}%`}
                  className={'smap-node' + (t.isProject ? ' proj' : '') + (t.done ? ' done' : '') + (drag?.id === t.id ? ' lift' : '') + (drag?.target === t.id ? ' drop' : '')}
                  style={{ left: n.x, top: n.y, width: W, height: H }} onPointerDown={e => onNodeDown(e, t.id)} onKeyDown={e => { if (e.key === 'Enter') openTask(t.id) }}>
                  <div className="smap-t"><span aria-hidden="true">{t.milestone ? '◆' : t.isProject ? '■' : '○'}</span> <b>{t.title}</b></div>
                  <div className="smap-m">{i.kids || t.isProject ? <span>{i.r.pct}%({i.r.done}/{i.r.leaves})</span> : <span>{t.done ? '完了' : '未完了'}</span>}{t.due && <span className={late ? 'late' : ''}>{fmtShort(t.due)}</span>}</div>
                  {wish.length > 0 && <div className="smap-w" title={wish.map(w => w.title).join('、')}>♡ {wish[0].title}{wish.length > 1 ? ` +${wish.length - 1}` : ''}</div>}
                  {(i.kids || t.isProject) && <div className="track smap-p" aria-hidden="true"><i style={{ width: i.r.pct + '%' }} /></div>}
                  {i.kids && <button className="smap-b tog" aria-label={n.hidden ? `${t.title}の子を展開` : `${t.title}の子を折りたたむ`} aria-expanded={!n.hidden} onClick={() => toggle(t.id)}>{n.hidden ? `▸${n.hidden}` : '▾'}</button>}
                  <button className="smap-b add" aria-label={`${t.title}に子を追加`} onClick={() => { setAdding(adding === t.id ? null : t.id); setText(''); setAsProj(false) }}>＋</button>
                </div> })}
              {adding && lay.byId.get(adding) && (() => { const n = lay.byId.get(adding)!; return <form className="smap-add" style={{ left: n.x, top: n.y + H + 4, width: W + 40 }} onSubmit={e => addChild(adding, e)}>
                <input autoFocus aria-label={`${n.t.title}の子の名前`} placeholder="名前  ~2h 4/30" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setAdding(null) }} />
                <label className="small"><input type="checkbox" checked={asProj} onChange={e => setAsProj(e.target.checked)} /> プロジェクトとして</label>
                <button className="btn btn-sm btn-primary" type="submit">追加</button></form> })()}
            </div>
          </div>
        </div>
      </div>}
    {drag && dragging && <div className="smap-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }} aria-hidden="true">{dragging.title}</div>}
  </div>
}
