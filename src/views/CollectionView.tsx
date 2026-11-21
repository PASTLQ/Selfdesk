import { useState } from 'react'
import type { CollectionDef, Field } from '../core/collections'
import { refChoices, refTitle, BUILTIN_KINDS } from '../core/collections'
import { COLLECTIONS } from '../collections'
import { useCollection, addExt, patchExt, delExt, useStore } from '../store'
import { Sheet } from '../ui'
import type { ExtItem, Ref } from '../types'

/** スキーマ(CollectionDef)から自動生成される汎用の一覧・編集画面。専用画面を作らなくても、新しいツールのデータをここで扱える。 */
export function CollectionView({ def }: { def: CollectionDef }) {
  const items = useCollection(def.id); const data = useStore(s => s); const [edit, setEdit] = useState<ExtItem | 'new' | null>(null); const [q, setQ] = useState('')
  const shown = items.filter(i => !q || JSON.stringify(i).toLowerCase().includes(q.toLowerCase()))
  const cols = def.fields.filter(f => f.key !== def.titleField).slice(0, 3)
  const show = (f: Field, v: unknown) => v === undefined || v === '' ? '' : f.type === 'bool' ? (v ? '✓' : '') : f.type === 'tags' ? (v as string[]).join(', ') : f.type === 'ref' ? (refTitle(data, COLLECTIONS, v as Ref) ?? '(削除済み)') : String(v)
  return <div className="stack" style={{ gap: 'var(--s4)' }}>
    <p className="small muted">{def.description}</p>
    <div className="row"><div className="field grow"><input type="search" aria-label="検索" placeholder="検索" value={q} onChange={e => setQ(e.target.value)} /></div><button className="btn btn-primary" onClick={() => setEdit('new')}>追加</button></div>
    <div className="rows">{shown.map(i => <button key={i.id} className="wish" onClick={() => setEdit(i)}><b>{String(i[def.titleField] ?? '(無題)')}</b><span className="meta">{cols.map(f => show(f, i[f.key]) && <span key={f.key}>{f.label}: {show(f, i[f.key])}</span>)}</span></button>)}
      {!shown.length && <p className="muted" style={{ padding: 'var(--s5) 0' }}>{items.length ? '該当なし' : 'まだデータがありません。'}</p>}</div>
    {edit && <ItemSheet def={def} item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
  </div>
}

function ItemSheet({ def, item, onClose }: { def: CollectionDef; item: ExtItem | null; onClose: () => void }) {
  const [v, setV] = useState<Record<string, unknown>>(item ? { ...item } : {}); const data = useStore(s => s)
  const set = (k: string, x: unknown) => setV(o => ({ ...o, [k]: x }))
  const missing = def.fields.filter(f => f.required && (v[f.key] === undefined || v[f.key] === ''))
  const save = () => { if (missing.length) return; const { id: _i, u: _u, ...rest } = v; item ? patchExt(def.id, item.id, rest) : addExt(def.id, rest); onClose() }
  const input = (f: Field) => {
    const x = v[f.key]; const id = 'f-' + f.key
    switch (f.type) {
      case 'longtext': return <textarea id={id} value={(x as string) ?? ''} onChange={e => set(f.key, e.target.value)} />
      case 'number': return <input id={id} type="number" value={(x as number) ?? ''} onChange={e => set(f.key, e.target.value === '' ? undefined : Number(e.target.value))} />
      case 'date': return <input id={id} type="date" value={(x as string) ?? ''} onChange={e => set(f.key, e.target.value || undefined)} />
      case 'bool': return <label className="switch-row"><span>{f.help || ''}</span><input id={id} className="switch" type="checkbox" checked={!!x} onChange={e => set(f.key, e.target.checked)} /></label>
      case 'select': return <div className="sel"><select id={id} value={(x as string) ?? ''} onChange={e => set(f.key, e.target.value || undefined)}><option value="">未選択</option>{f.options!.map(o => <option key={o}>{o}</option>)}</select></div>
      case 'tags': return <input id={id} type="text" value={((x as string[]) ?? []).join(',')} onChange={e => set(f.key, e.target.value.split(/[,、]/).map(s => s.trim()).filter(Boolean))} />
      case 'ref': { const r = (x as Ref) ?? { kind: 'project', id: '' }; const kinds = [...BUILTIN_KINDS, ...COLLECTIONS.map(c => c.id)]
        return <div className="row"><div className="sel grow"><select aria-label={f.label + 'の種類'} value={r.kind} onChange={e => set(f.key, { kind: e.target.value, id: '' })}>{kinds.map(k => <option key={k}>{k}</option>)}</select></div>
          <div className="sel grow"><select id={id} aria-label={f.label} value={r.id} onChange={e => set(f.key, e.target.value ? { kind: r.kind, id: e.target.value } : undefined)}><option value="">なし</option>{refChoices(data, COLLECTIONS, r.kind).slice(0, 500).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div></div> }
      default: return <input id={id} type="text" value={(x as string) ?? ''} onChange={e => set(f.key, e.target.value)} data-autofocus={f.key === def.titleField || undefined} />
    }
  }
  return <Sheet title={def.label} onClose={onClose}><div className="stack">
    {def.fields.map(f => <div className="field" key={f.key}><label htmlFor={'f-' + f.key}>{f.label}{f.required ? ' *' : ''}</label>{input(f)}{f.help && f.type !== 'bool' && <span className="small muted">{f.help}</span>}</div>)}
    <div className="row"><button className="btn btn-primary" disabled={missing.length > 0} onClick={save}>保存</button>{item && <button className="btn" onClick={() => { if (confirm('削除しますか?')) { delExt(def.id, item.id); onClose() } }}>削除</button>}</div>
  </div></Sheet>
}
