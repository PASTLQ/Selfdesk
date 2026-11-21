import { useState } from 'react'
import { Seg } from '../ui'
import { patchNote, addTask, get, addNote, newNote } from '../store'
import { renderMd } from '../lib/md'
import type { Note } from '../types'

export function DocEditor({ note, openNote }: { note: Note; openNote: (id: string) => void }) {
  const [mode, setMode] = useState<'edit' | 'split' | 'view'>(window.innerWidth > 900 ? 'split' : 'edit')
  const setBody = (b: string) => patchNote(note.id, { body: b })
  const wiki = (t: string) => { const n = get().notes.find(x => x.title === t); if (n) openNote(n.id); else if (confirm(`「${t}」を新しいメモとして作成しますか?`)) { const nn = newNote('doc', t); addNote(nn); openNote(nn.id) } }
  const toggle = (ln: number) => { const L = note.body.split('\n'); L[ln] = L[ln].includes('[ ]') ? L[ln].replace('[ ]', '[x]') : L[ln].replace('[x]', '[ ]'); setBody(L.join('\n')) }
  const toTasks = () => {
    const L = note.body.split('\n'); let n = 0
    const out = L.map(l => { const m = l.match(/^(\s*[-*]\s+)\[ \]\s+(.*)/); if (m && m[2].trim()) { addTask({ title: m[2].trim(), notes: `メモ「${note.title}」より` }); n++; return `${m[1]}[x] ${m[2]} (タスク化済)` } return l })
    if (n) { setBody(out.join('\n')); alert(`${n}件をタスクにしました`) } else alert('未完了のチェックリスト行(- [ ] ...)がありません')
  }
  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div style={{ minWidth: 240 }}><Seg value={mode} onChange={setMode} items={[['edit', '編集'], ['split', '分割'], ['view', '表示']]} /></div>
        <div className="toolbar"><button className="btn btn-sm" onClick={toTasks}>チェック項目をタスク化</button></div>
      </div>
      <div className={'doc-ed' + (mode === 'split' ? ' split' : '')}>
        {mode !== 'view' && <textarea aria-label="本文" value={note.body} placeholder={'# 見出し\n- [ ] チェックリスト\n[[他のメモへのリンク]]'} onChange={e => setBody(e.target.value)} />}
        {mode !== 'edit' && <div className="md well" style={{ padding: 0 }}>{renderMd(note.body, wiki, toggle)}</div>}
      </div>
    </div>
  )
}
