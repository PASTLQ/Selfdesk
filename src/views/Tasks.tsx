import { useMemo, useState } from 'react'
import { Seg, Check } from '../ui'
import { useStore, addTask, toggleTask } from '../store'
import { useActionable, useProjectOf } from '../lib/projects'
import { descendants } from '../core/tree'
import { parseQuick } from '../lib/quick'
import { today, fmtShort, durLabel, daysBetween } from '../lib/date'
import type { Task } from '../types'

export function TaskRow({ t, open }: { t: Task; open: (id: string) => void }) {
  const td = today(); const projOf = useProjectOf(); const pj = projOf(t.id); const late = !t.done && t.due && t.due < td
  const subDone = t.subs.filter(s => s.done).length
  return (
    <div className={'trow' + (t.done ? ' done' : '')}>
      <Check on={t.done} onChange={() => toggleTask(t.id)} label={`${t.title}を完了`} />
      <button className="tt" onClick={() => open(t.id)}>
        <b>{t.title}</b>
        <span className="meta">
          {t.priority > 0 && <span className="pri">{'!'.repeat(t.priority)}</span>}
          {t.due && <span className={late ? 'late' : ''}>{late ? `${daysBetween(t.due, td)}日超過` : fmtShort(t.due)}</span>}
          {t.block && <span>▪ {fmtShort(t.block.date)} {String(Math.floor(t.block.start / 60)).padStart(2, '0')}:{String(t.block.start % 60).padStart(2, '0')}</span>}
          {t.est && <span>{durLabel(t.est)}</span>}
          {t.repeat && <span>↻</span>}
          {t.subs.length > 0 && <span>{subDone}/{t.subs.length}</span>}
          {pj && <span>#{pj.title}</span>}{t.milestone && <span>◆</span>}
          {t.tags.map(x => <span key={x}>@{x}</span>)}
        </span>
      </button>
    </div>
  )
}

type F = 'open' | 'today' | 'late' | 'nodue' | 'done'
export function Tasks({ open }: { open: (id: string) => void }) {
  const all = useStore(s => s.tasks); const tasks = useActionable(); const projects = useMemo(() => all.filter(t => t.isProject && !t.done && !t.archived), [all])
  const [f, setF] = useState<F>('open'); const [proj, setProj] = useState(''); const [q, setQ] = useState(''); const [text, setText] = useState('')
  const td = today()
  const list = useMemo(() => {
    let l = tasks.filter(t => f === 'done' ? t.done : !t.done)
    if (f === 'today') l = l.filter(t => t.due === td || t.block?.date === td)
    if (f === 'late') l = l.filter(t => t.due && t.due < td)
    if (f === 'nodue') l = l.filter(t => !t.due)
    if (proj) { const ids = new Set(descendants(all, proj).map(d => d.id)); l = l.filter(t => ids.has(t.id)) }
    if (q) l = l.filter(t => (t.title + t.tags.join(' ')).toLowerCase().includes(q.toLowerCase()))
    return [...l].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.priority - a.priority)
  }, [tasks, all, f, proj, q, td])
  const add = (e: React.FormEvent) => { e.preventDefault(); if (!text.trim()) return; const p = parseQuick(text); if (p.title) addTask(p); setText('') }
  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <form className="quick" onSubmit={add}>
        <input aria-label="タスクを追加" placeholder="タスクを追加  例: 資料を作る !2 #仕事 ~45m 明日" value={text} onChange={e => setText(e.target.value)} />
        <button className="btn btn-primary" type="submit">追加</button>
      </form>
      <Seg value={f} onChange={setF} items={[['open', '未完了'], ['today', '今日'], ['late', '期限切れ'], ['nodue', '期限なし'], ['done', '完了']]} />
      <div className="chips scroll-x" role="group" aria-label="プロジェクト">
        <button className="chip" aria-pressed={!proj} onClick={() => setProj('')}>すべて</button>
        {projects.map(p => <button key={p.id} className="chip" aria-pressed={proj === p.id} onClick={() => setProj(proj === p.id ? '' : p.id)}>{p.title}</button>)}
      </div>
      <div className="field"><input type="search" aria-label="検索" placeholder="検索" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="rows">
        {list.map(t => <TaskRow key={t.id} t={t} open={open} />)}
        {!list.length && <p className="muted" style={{ padding: 'var(--s5) 0' }}>該当するタスクはありません。</p>}
      </div>
    </div>
  )
}
