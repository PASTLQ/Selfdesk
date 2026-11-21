import { useEffect, useRef, useState } from 'react'
import { Canvas, toWorld, type View } from './Canvas'
import { patchNote, addTask } from '../store'
import { uid } from '../lib/date'
import type { BNode, Note } from '../types'

type Tool = 'select' | 'sticky' | 'text' | 'rect' | 'ellipse' | 'arrow' | 'pen' | 'erase'
const TOOLS: [Tool, string][] = [['select', '選択'], ['sticky', '付箋'], ['text', 'テキスト'], ['rect', '四角'], ['ellipse', '楕円'], ['arrow', '矢印'], ['pen', 'ペン'], ['erase', '消しゴム']]

function edgePoint(n: BNode, tx: number, ty: number): [number, number] {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2, dx = tx - cx, dy = ty - cy
  if (!dx && !dy) return [cx, cy]
  const s = Math.min((n.w / 2) / (Math.abs(dx) || 1e-9), (n.h / 2) / (Math.abs(dy) || 1e-9)); return [cx + dx * s, cy + dy * s]
}

export function Board({ note }: { note: Note }) {
  const [tool, setTool] = useState<Tool>('select'); const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 })
  const [sel, setSel] = useState<string | null>(null); const [editing, setEditing] = useState<string | null>(null); const [link, setLink] = useState<string | null>(null)
  const [drag, setDrag] = useState<Record<string, Partial<BNode>>>({}); const [live, setLive] = useState<[number, number][] | null>(null)
  const el = useRef<HTMLDivElement | null>(null); const vr = useRef(view); vr.current = view
  const nr = useRef(note); nr.current = note
  const nodes = note.nodes.map(n => ({ ...n, ...(drag[n.id] || {}) }))
  const byId = new Map(nodes.map(n => [n.id, n]))
  const upd = (p: Partial<Note>) => patchNote(note.id, p)
  const world = (cx: number, cy: number) => toWorld(el.current!, vr.current, cx, cy)

  useEffect(() => { const k = (e: KeyboardEvent) => { if (editing || (e.target as HTMLElement).closest('input,textarea')) return; if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); delNode(sel) } if (e.key === 'Escape') { setSel(null); setLink(null); setTool('select') } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }) // eslint-disable-line
  const delNode = (id: string) => { const n = nr.current; upd({ nodes: n.nodes.filter(x => x.id !== id), edges: n.edges.filter(e => e.from !== id && e.to !== id) }); setSel(null) }

  const create = (kind: BNode['kind'], x: number, y: number) => {
    const sz = kind === 'sticky' ? [170, 120] : kind === 'text' ? [160, 40] : kind === 'ellipse' ? [150, 100] : [150, 90]
    const n: BNode = { id: uid(), kind, x: x - sz[0] / 2, y: y - sz[1] / 2, w: sz[0], h: sz[1], text: '', color: kind === 'sticky' ? 1 : 0 }
    upd({ nodes: [...nr.current.nodes, n] }); setSel(n.id); setEditing(n.id); setTool('select')
  }
  const onBgDown = (e: React.PointerEvent<HTMLDivElement>, w: [number, number]) => {
    setSel(null); setLink(null)
    if (tool === 'sticky' || tool === 'text' || tool === 'rect' || tool === 'ellipse') { create(tool, w[0], w[1]); return true }
    if (tool === 'pen') {
      const pts: [number, number][] = [w]; setLive(pts); const c = e.currentTarget; c.setPointerCapture(e.pointerId)
      const mv = (ev: PointerEvent) => { pts.push(world(ev.clientX, ev.clientY)); setLive([...pts]) }
      const up = () => { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); setLive(null); if (pts.length > 1) upd({ strokes: [...nr.current.strokes, { id: uid(), pts: pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1) }] }) }
      c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); return true
    }
    return false
  }
  const nodeDown = (e: React.PointerEvent, n: BNode) => {
    e.stopPropagation()
    if (editing === n.id) return
    if (tool === 'erase') { delNode(n.id); return }
    if (tool === 'arrow') { if (!link) setLink(n.id); else if (link !== n.id) { upd({ edges: [...nr.current.edges, { id: uid(), from: link, to: n.id }] }); setLink(null) } return }
    if (tool !== 'select') return
    setSel(n.id); const x0 = e.clientX, y0 = e.clientY; let moved = false
    const mv = (ev: PointerEvent) => { const dx = (ev.clientX - x0) / vr.current.k, dy = (ev.clientY - y0) / vr.current.k; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; setDrag({ [n.id]: { x: n.x + dx, y: n.y + dy } }) }
    const up = (ev: PointerEvent) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up)
      if (moved) { const dx = (ev.clientX - x0) / vr.current.k, dy = (ev.clientY - y0) / vr.current.k; upd({ nodes: nr.current.nodes.map(m => m.id === n.id ? { ...m, x: Math.round(n.x + dx), y: Math.round(n.y + dy) } : m) }) }
      setDrag({}) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
  }
  const resizeDown = (e: React.PointerEvent, n: BNode) => {
    e.stopPropagation(); const x0 = e.clientX, y0 = e.clientY
    const mv = (ev: PointerEvent) => setDrag({ [n.id]: { w: Math.max(60, n.w + (ev.clientX - x0) / vr.current.k), h: Math.max(30, n.h + (ev.clientY - y0) / vr.current.k) } })
    const up = (ev: PointerEvent) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); upd({ nodes: nr.current.nodes.map(m => m.id === n.id ? { ...m, w: Math.round(Math.max(60, n.w + (ev.clientX - x0) / vr.current.k)), h: Math.round(Math.max(30, n.h + (ev.clientY - y0) / vr.current.k)) } : m) }); setDrag({}) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
  }
  const setNode = (id: string, p: Partial<BNode>) => upd({ nodes: nr.current.nodes.map(n => n.id === id ? { ...n, ...p } : n) })
  const selNode = sel ? byId.get(sel) : undefined

  const svg = <>
    <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--fg)" /></marker></defs>
    {note.edges.map(ed => { const a = byId.get(ed.from), b = byId.get(ed.to); if (!a || !b) return null
      const p1 = edgePoint(a, b.x + b.w / 2, b.y + b.h / 2), p2 = edgePoint(b, a.x + a.w / 2, a.y + a.h / 2)
      return <line key={ed.id} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="var(--fg)" strokeWidth={1.8} markerEnd="url(#arr)" style={{ pointerEvents: tool === 'erase' ? 'stroke' : 'none', cursor: 'pointer' }} onPointerDown={e => { if (tool === 'erase') { e.stopPropagation(); upd({ edges: nr.current.edges.filter(x => x.id !== ed.id) }) } }} /> })}
    {note.strokes.map(s => <path key={s.id} d={'M' + s.pts.map(p => p.join(',')).join(' L')} fill="none" stroke="var(--fg)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: tool === 'erase' ? 'stroke' : 'none', cursor: 'pointer' }} onPointerDown={e => { if (tool === 'erase') { e.stopPropagation(); upd({ strokes: nr.current.strokes.filter(x => x.id !== s.id) }) } }} />)}
    {live && <path d={'M' + live.map(p => p.join(',')).join(' L')} fill="none" stroke="var(--fg)" strokeWidth={2.4} strokeLinecap="round" />}
  </>
  const toTask = () => { if (selNode?.text) { addTask({ title: selNode.text, notes: `ボード「${note.title}」より` }); alert('タスクに追加しました') } }
  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <div className="toolbar" role="toolbar" aria-label="ボードのツール">
        {TOOLS.map(([t, l]) => <button key={t} className="chip" aria-pressed={tool === t} onClick={() => { setTool(t); setLink(null) }}>{l}</button>)}
        <span style={{ flex: 1 }} />
        {selNode && <>
          {(selNode.kind === 'sticky' || selNode.kind === 'rect' || selNode.kind === 'ellipse') && <button className="btn btn-sm" onClick={() => setNode(selNode.id, { color: (selNode.color + 1) % 5 })}>色を変える</button>}
          <button className="btn btn-sm" onClick={toTask}>タスクにする</button>
          <button className="btn btn-sm" onClick={() => delNode(selNode.id)}>削除</button>
        </>}
      </div>
      {tool === 'arrow' && <p className="small muted">{link ? '矢印の終点にする図形をクリック' : '矢印の始点にする図形をクリック'}</p>}
      <Canvas view={view} setView={setView} svg={svg} onBgDown={onBgDown} className={tool === 'pen' ? 'pen' : ''} innerRef={e => { el.current = e }}>
        {nodes.map(n => (
          <div key={n.id} className={`bn k-${n.kind} c${n.color}` + (sel === n.id ? ' isel' : '') + (link === n.id ? ' isel' : '')} style={{ left: n.x, top: n.y, width: n.w, height: n.h, cursor: tool === 'select' ? 'move' : 'pointer' }}
            onPointerDown={e => nodeDown(e, n)} onDoubleClick={() => { setEditing(n.id); setTool('select') }}>
            {editing === n.id ? <textarea ref={t => { if (t && document.activeElement !== t) setTimeout(() => t.focus(), 30) }} aria-label="テキスト" defaultValue={n.text} onFocus={e => e.target.select()} onPointerDown={e => e.stopPropagation()}
              onBlur={e => { setNode(n.id, { text: e.target.value }); setEditing(null) }} onKeyDown={e => { if (e.key === 'Escape') (e.target as HTMLElement).blur() }} /> : n.text}
            {sel === n.id && !editing && <span className="rzh" onPointerDown={e => resizeDown(e, n)} />}
          </div>))}
      </Canvas>
      <p className="small muted">ダブルクリックで文字を編集 / 背景ドラッグで移動 / Ctrl+ホイールで拡大縮小 / Deleteで削除</p>
    </div>
  )
}
