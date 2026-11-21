import { useEffect, useState } from 'react'
import { useStore, addNote, newNote, patchNote, delNote } from '../store'
import { Seg } from '../ui'
import { TreeEditor } from './TreeEditor'
import { Board } from './Board'
import { DocEditor } from './DocEditor'
import type { Note } from '../types'

const KIND: Record<Note['kind'], string> = { doc: 'ドキュメント', tree: 'ロジックツリー', board: 'ホワイトボード' }
const preview = (n: Note) => n.kind === 'doc' ? n.body.replace(/[#*`>\-\[\]]/g, '').slice(0, 120) : n.kind === 'tree' ? n.tree.slice(0, 6).map(t => t.text).join(' / ') : n.nodes.slice(0, 6).map(t => t.text).filter(Boolean).join(' / ')

export function Notes({ openId, setOpenId }: { openId: string | null; setOpenId: (id: string | null) => void }) {
  const notes = useStore(s => s.notes); const [q, setQ] = useState(''); const [kind, setKind] = useState<'all' | Note['kind']>('all')
  const cur = notes.find(n => n.id === openId)
  useEffect(() => { if (openId && !cur) setOpenId(null) }, [openId, cur]) // eslint-disable-line
  if (cur) return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <div className="editor-bar">
        <button className="btn btn-sm" onClick={() => setOpenId(null)}>← 一覧</button>
        <input className="title-in" aria-label="タイトル" value={cur.title} placeholder="タイトル" onChange={e => patchNote(cur.id, { title: e.target.value })} />
        <button className="btn btn-sm" aria-pressed={cur.pinned} onClick={() => patchNote(cur.id, { pinned: !cur.pinned })}>{cur.pinned ? 'ピン留め中' : 'ピン留め'}</button>
        <button className="btn btn-sm" onClick={() => { if (confirm('このメモを削除しますか?')) { delNote(cur.id); setOpenId(null) } }}>削除</button>
      </div>
      <span className="small muted">{KIND[cur.kind]} ・ 変更は自動で保存されます</span>
      {cur.kind === 'doc' && <DocEditor note={cur} openNote={setOpenId} />}
      {cur.kind === 'tree' && <TreeEditor key={cur.id} note={cur} />}
      {cur.kind === 'board' && <Board key={cur.id} note={cur} />}
    </div>
  )
  const list = notes.filter(n => (kind === 'all' || n.kind === kind) && (!q || (n.title + n.body + preview(n)).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  const mk = (k: Note['kind']) => { const n = newNote(k, ''); addNote(n); setOpenId(n.id) }
  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <div className="toolbar"><button className="btn" onClick={() => mk('doc')}>＋ ドキュメント</button><button className="btn" onClick={() => mk('tree')}>＋ ロジックツリー</button><button className="btn" onClick={() => mk('board')}>＋ ホワイトボード</button></div>
      <Seg value={kind} onChange={setKind} items={[['all', 'すべて'], ['doc', 'ドキュメント'], ['tree', 'ツリー'], ['board', 'ボード']]} />
      <input type="search" aria-label="メモを検索" placeholder="メモを検索" value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', minHeight: 44, padding: '0 16px', border: '1px solid var(--edge)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', boxShadow: 'var(--sink-sm)' }} />
      <div className="note-grid">
        {list.map(n => <button key={n.id} className="note-card" onClick={() => setOpenId(n.id)}><span className="badge" style={{ alignSelf: 'flex-start' }}>{KIND[n.kind]}{n.pinned ? ' ・ ピン' : ''}</span><b>{n.title || '無題'}</b><p>{preview(n) || '空のメモ'}</p></button>)}
      </div>
      {!list.length && <p className="muted">メモはまだありません。上のボタンから作成できます。</p>}
    </div>
  )
}
