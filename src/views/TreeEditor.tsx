import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type View } from './Canvas'
import { patchNote, addTask, get } from '../store'
import { uid } from '../lib/date'
import { treeToOutline, outlineToTree } from '../lib/outline'
import type { Note, TreeNode } from '../types'

const W = 200, GX = 90, GY = 14

export function TreeEditor({ note }: { note: Note }) {
  const tree = note.tree; const [sel, setSel] = useState(tree[0]?.id || ''); const [editing, setEditing] = useState<string | null>(null)
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 }); const [outline, setOutline] = useState<string | null>(null)
  const heights = useRef<Record<string, number>>({}); const [, force] = useState(0); const box = useRef<HTMLDivElement>(null)
  const set = (t: TreeNode[]) => patchNote(note.id, { tree: t })
  const T = () => get().notes.find(n => n.id === note.id)?.tree || tree
  const kids = (p: string | null, t = tree) => t.filter(n => n.parent === p).sort((a, b) => a.order - b.order)

  const pos = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {}; let cursor = 0
    const place = (id: string, d: number): [number, number] => {
      const n = tree.find(x => x.id === id)!; const h = heights.current[id] || 38; const ch = n.collapsed ? [] : kids(id)
      if (!ch.length) { const y = cursor; cursor += h + GY; out[id] = { x: d * (W + GX), y }; return [y, y + h] }
      const rs = ch.map(c => place(c.id, d + 1)); const mid = (rs[0][0] + rs[rs.length - 1][1]) / 2 - h / 2
      out[id] = { x: d * (W + GX), y: mid }; return [Math.min(mid, rs[0][0]), Math.max(mid + h, rs[rs.length - 1][1])]
    }
    const root = tree.find(n => n.parent === null); if (root) place(root.id, 0)
    return out
  }, [tree, heights.current]) // eslint-disable-line
  useLayoutEffect(() => { let ch = false; box.current?.querySelectorAll<HTMLElement>('[data-nid]').forEach(el => { const h = el.offsetHeight; const id = el.dataset.nid!; if (heights.current[id] !== h) { heights.current[id] = h; ch = true } }); if (ch) force(x => x + 1) })
  useEffect(() => { box.current?.focus() }, [])

  const add = (parent: string | null, after?: TreeNode) => {
    const cur = T(); const id = uid(); const sibs = kids(parent, cur)
    const order = after ? (cur.find(n => n.id === after.id)?.order ?? 0) + .5 : sibs.length
    const nt = [...cur, { id, text: '', parent, order }]
    const ord = new Map(kids(parent, nt).map((n, i) => [n.id, i]))
    set(nt.map(n => n.parent === parent ? { ...n, order: ord.get(n.id)! } : n.id === parent ? { ...n, collapsed: false } : n)); setSel(id); setEditing(id)
  }
  const remove = (id: string) => {
    const cur = T(); const n = cur.find(x => x.id === id); if (!n || n.parent === null) return
    const gone = new Set<string>([id]); let ch = true; while (ch) { ch = false; cur.forEach(t => { if (t.parent && gone.has(t.parent) && !gone.has(t.id)) { gone.add(t.id); ch = true } }) }
    set(cur.filter(t => !gone.has(t.id))); setSel(n.parent)
  }
  const setText = (id: string, text: string) => set(T().map(n => n.id === id ? { ...n, text } : n))
  const commit = (id: string, text: string) => { const t = text.trim(); const n = T().find(x => x.id === id); setEditing(null); if (!t && n && n.parent !== null && !n.text) { remove(id); return } if (t !== n?.text) setText(id, t || n?.text || ''); box.current?.focus() }

  const onKey = (e: React.KeyboardEvent) => {
    if (editing) return; const n = tree.find(x => x.id === sel); if (!n) return
    const flat = Object.entries(pos).sort((a, b) => a[1].x - b[1].x || a[1].y - b[1].y)
    if (e.key === 'Tab') { e.preventDefault(); add(n.id) }
    else if (e.key === 'Enter') { e.preventDefault(); n.parent === null ? add(n.id) : add(n.parent, n) }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(n.id) }
    else if (e.key === 'F2') { e.preventDefault(); setEditing(n.id) }
    else if (e.key === ' ') { e.preventDefault(); set(tree.map(t => t.id === n.id ? { ...t, collapsed: !t.collapsed } : t)) }
    else if (e.key === 'ArrowLeft' && n.parent) { e.preventDefault(); setSel(n.parent) }
    else if (e.key === 'ArrowRight') { const c = kids(n.id)[0]; if (c && !n.collapsed) { e.preventDefault(); setSel(c.id) } }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const same = flat.filter(([, p]) => p.x === pos[n.id].x); const i = same.findIndex(([id]) => id === n.id); const nx = same[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (nx) setSel(nx[0]) }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) setEditing(n.id)
  }
  const nodes = tree.filter(n => pos[n.id])
  const paths = nodes.filter(n => n.parent && pos[n.parent]).map(n => {
    const a = pos[n.parent!], b = pos[n.id]; const ah = heights.current[n.parent!] || 38, bh = heights.current[n.id] || 38
    const x1 = a.x + W, y1 = a.y + ah / 2, x2 = b.x, y2 = b.y + bh / 2; const mx = (x1 + x2) / 2
    return <path key={n.id} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="var(--edge)" strokeWidth={1.5} />
  })
  const selNode = tree.find(n => n.id === sel)
  const toTask = () => { if (!selNode?.text) return; addTask({ title: selNode.text, notes: `ツリー「${note.title}」より`, project: '' }); alert('タスクに追加しました') }

  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <div className="toolbar" role="toolbar" aria-label="ツリー操作">
        <button className="btn btn-sm" onClick={() => selNode && add(selNode.id)}>子を追加 (Tab)</button>
        <button className="btn btn-sm" onClick={() => selNode && (selNode.parent === null ? add(selNode.id) : add(selNode.parent, selNode))}>兄弟を追加 (Enter)</button>
        <button className="btn btn-sm" onClick={() => selNode && setEditing(selNode.id)}>編集 (F2)</button>
        <button className="btn btn-sm" onClick={() => selNode && set(tree.map(t => t.id === sel ? { ...t, collapsed: !t.collapsed } : t))}>折りたたみ (Space)</button>
        <button className="btn btn-sm" onClick={() => selNode && remove(selNode.id)} disabled={!selNode || selNode.parent === null}>削除</button>
        <button className="btn btn-sm" onClick={toTask}>タスクにする</button>
        <button className="btn btn-sm" onClick={() => setOutline(outline === null ? treeToOutline(tree) : null)}>{outline === null ? 'テキストで編集' : 'ツリーに戻る'}</button>
      </div>
      {outline !== null ? (
        <div className="field"><label htmlFor="ol">インデントで階層を表します(1行目がルート)。貼り付けにも対応。</label>
          <textarea id="ol" style={{ minHeight: '55vh', fontFamily: 'ui-monospace, monospace' }} value={outline} onChange={e => setOutline(e.target.value)} />
          <button className="btn btn-primary" onClick={() => { set(outlineToTree(outline)); setOutline(null) }}>この内容でツリーを作り直す</button></div>
      ) : (
        <div ref={box} tabIndex={0} onKeyDown={onKey} aria-label="ロジックツリー。矢印キーで移動、Tabで子を追加、Enterで兄弟を追加" style={{ outline: 'none' }}>
          <Canvas view={view} setView={setView} svg={paths}>
            {nodes.map(n => { const p = pos[n.id]; const has = kids(n.id).length > 0
              return <div key={n.id} data-nid={n.id} className={'tnode' + (n.parent === null ? ' root' : '') + (sel === n.id ? ' isel' : '')} style={{ left: p.x, top: p.y, width: W }}
                onClick={() => { setSel(n.id); box.current?.focus() }} onDoubleClick={() => setEditing(n.id)}>
                {editing === n.id ? <input autoFocus aria-label="ノードの文字" defaultValue={n.text} onFocus={e => e.target.select()} onBlur={e => commit(n.id, e.target.value)}
                  onKeyDown={e => { e.stopPropagation(); const v = (e.target as HTMLInputElement).value; if (e.key === 'Enter') { e.preventDefault(); commit(n.id, v); } else if (e.key === 'Escape') { setEditing(null); box.current?.focus() } else if (e.key === 'Tab') { e.preventDefault(); commit(n.id, v); setTimeout(() => add(n.id), 0) } }} />
                  : <span className="grow">{n.text || '(空)'}</span>}
                {has && <button className="fold btn-quiet" style={{ border: 0, background: 'none', cursor: 'pointer', minWidth: 24, minHeight: 24, color: 'inherit' }} aria-label={n.collapsed ? '展開' : '折りたたむ'} onClick={e => { e.stopPropagation(); set(tree.map(t => t.id === n.id ? { ...t, collapsed: !t.collapsed } : t)) }}>{n.collapsed ? `+${kids(n.id).length}` : '−'}</button>}
              </div> })}
          </Canvas>
        </div>
      )}
    </div>
  )
}
